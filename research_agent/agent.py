"""The research loop: plan -> search -> read -> (fill gaps) -> write -> verify citations."""
import math
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Callable

from . import prompts
from .config import Config
from .credibility import RANK, credibility
from .fetch import fetch_text, top_passages
from .search import Searcher

Event = Callable[[str, dict], None]
CITE = re.compile(r"\[(\d+)\]")


@dataclass
class Source:
    id: int
    title: str
    url: str
    passages: list[str] = field(default_factory=list)
    credibility: str = "medium"
    relevance: float = 0.0


@dataclass
class Claim:
    id: int
    text: str
    cites: list[int]
    label: str = "unchecked"
    reason: str = ""


@dataclass
class Report:
    question: str
    markdown: str
    sources: list[Source]
    claims: list[Claim]
    revisions: int = 0
    history: list[dict] = field(default_factory=list)   # score after each draft
    usage: dict = field(default_factory=dict)

    @property
    def score(self) -> dict:
        n = len(self.claims) or 1
        c = {k: sum(cl.label == k for cl in self.claims)
             for k in ("supported", "partial", "unsupported")}
        c["citation_precision"] = round((c["supported"] + 0.5 * c["partial"]) / n, 3)
        c["claims"] = len(self.claims)
        return c

    def to_dict(self) -> dict:
        return {"question": self.question, "markdown": self.markdown, "score": self.score,
                "sources": [asdict(s) for s in self.sources],
                "claims": [asdict(c) for c in self.claims], "revisions": self.revisions,
                "history": self.history, "usage": self.usage}


def build_agent(cfg: Config, on_event: Event | None = None) -> "ResearchAgent":
    """Wire up the real Gemini client, search and caches from config."""
    from .cache import Cache, NullCache
    from .fetch import set_cache
    from .llm import GeminiClient
    cache = Cache() if cfg.use_cache else NullCache()
    set_cache(cache if cfg.use_cache else None)
    return ResearchAgent(GeminiClient(cfg.gemini_api_key, cache=cache), Searcher(cfg.tavily_api_key),
                         cfg, on_event)


class ResearchAgent:
    def __init__(self, llm, searcher: Searcher, config: Config, on_event: Event | None = None,
                 fetcher=fetch_text):
        self.llm, self.searcher, self.cfg = llm, searcher, config
        self.emit = on_event or (lambda kind, data: None)
        self.fetch = fetcher

    # ---------- public ----------
    def run(self, question: str) -> Report:
        self.emit("status", {"message": "Planning research"})
        plan = self.plan(question)
        self.emit("plan", {"subquestions": plan})

        sources: list[Source] = []
        seen: set[str] = set()
        queries = [(p["question"], p["query"]) for p in plan]
        for rnd in range(self.cfg.max_rounds):
            self.gather(queries, question, sources, seen)
            if rnd == self.cfg.max_rounds - 1 or len(sources) >= self.cfg.max_sources:
                break
            gaps = self.find_gaps(question, sources)
            if not gaps:
                break
            self.emit("gaps", {"queries": gaps})
            queries = [(question, q) for q in gaps]

        if not sources:
            raise RuntimeError("No usable sources found. Try rephrasing the question.")

        sources = self.finalize_sources(question, sources)

        self.emit("status", {"message": f"Writing report from {len(sources)} sources"})
        body = self.write(question, sources)
        self.emit("status", {"message": "Verifying citations"})
        claims = self.verify(body, sources)
        history = [Report("", "", sources, claims).score]

        revisions = 0
        while revisions < self.cfg.max_revisions:
            flagged = [c for c in claims if c.label in ("partial", "unsupported")]
            if not flagged:
                break
            revisions += 1
            self.emit("revise", {"round": revisions, "flagged": len(flagged)})
            new_body = self.revise(body, flagged, sources)
            new_claims = self.verify(new_body, sources)
            new_score = Report("", "", sources, new_claims).score
            history.append(new_score)
            # keep the revision only if it didn't make things worse
            if new_score["citation_precision"] >= history[-2]["citation_precision"]:
                body, claims = new_body, new_claims
            else:
                break

        report = Report(question, self.annotate(body, claims, sources), sources, claims,
                        revisions, history, dict(getattr(self.llm, "usage", {})))
        self.emit("done", {"score": report.score, "revisions": revisions, "history": history})
        return report

    # ---------- steps ----------
    def plan(self, question: str) -> list[dict]:
        data = self.llm.generate_json(prompts.PLAN.format(
            n=self.cfg.max_subquestions, question=question, today=date.today()),
            self.cfg.fast_model)
        subs = [s for s in data.get("subquestions", []) if s.get("query")]
        return subs[: self.cfg.max_subquestions] or [{"question": question, "query": question}]

    def gather(self, queries, question, sources: list[Source], seen: set[str]) -> None:
        candidates = []
        for sub_q, query in queries:
            self.emit("search", {"query": query})
            for r in self.searcher.search(query, self.cfg.results_per_query):
                if r.url not in seen:
                    seen.add(r.url)
                    candidates.append((sub_q, r))
        room = self.cfg.max_sources - len(sources)
        candidates = candidates[: room * 2]

        def read(item):
            sub_q, r = item
            text = r.content or self.fetch(r.url, timeout=self.cfg.request_timeout)
            if len(text) < 200:
                text = (text + "\n" + r.snippet).strip()
            k = self.cfg.candidate_passages if self._can_embed() else self.cfg.passages_per_source
            passages = top_passages(text, f"{question} {sub_q}", k, self.cfg.passage_chars)
            return r, passages

        with ThreadPoolExecutor(max_workers=8) as pool:
            for r, passages in pool.map(read, candidates):
                if passages and len(sources) < self.cfg.max_sources:
                    src = Source(len(sources) + 1, r.title or r.url, r.url, passages,
                                 credibility(r.url))
                    sources.append(src)
                    self.emit("source", {"id": src.id, "title": src.title, "url": src.url,
                                         "credibility": src.credibility})

    def _can_embed(self) -> bool:
        return self.cfg.use_embeddings and callable(getattr(self.llm, "embed", None))

    def finalize_sources(self, question: str, sources: list[Source]) -> list[Source]:
        """Semantic rerank of passages (hybrid with BM25), drop weak sources, renumber
        so stronger sources come first."""
        if self._can_embed():
            try:
                self.emit("status", {"message": "Semantic reranking of passages"})
                flat = [(s, i, p) for s in sources for i, p in enumerate(s.passages)]
                vecs = self.llm.embed([question] + [p for _, _, p in flat])
                qv = vecs[0]
                by_src: dict[int, list] = {}
                for (src, bm25_rank, p), v in zip(flat, vecs[1:]):
                    # reciprocal-rank style fusion of BM25 order and cosine similarity
                    score = cosine(qv, v) + 0.05 / (1 + bm25_rank)
                    by_src.setdefault(src.id, []).append((score, bm25_rank, p))
                for src in sources:
                    ranked = sorted(by_src.get(src.id, []), reverse=True)
                    src.passages = [p for _, _, p in sorted(ranked[: self.cfg.passages_per_source],
                                                            key=lambda x: x[1])]
                    src.relevance = ranked[0][0] if ranked else 0.0
                # drop sources that are clearly off-topic
                best = max(s.relevance for s in sources)
                sources = [s for s in sources if s.relevance >= best * 0.6] or sources
            except Exception as e:
                self.emit("status", {"message": f"Embedding rerank skipped ({e})"})
                for s in sources:
                    s.passages = s.passages[: self.cfg.passages_per_source]
        sources.sort(key=lambda s: RANK.get(s.credibility, 1))
        for i, s in enumerate(sources, 1):
            s.id = i
        return sources

    def revise(self, body: str, flagged: list[Claim], sources: list[Source]) -> str:
        items = "\n".join(f"- ({c.label}) \"{c.text}\" cites {c.cites}: {c.reason}" for c in flagged)
        return self.llm.generate(prompts.REVISE.format(
            flagged=items, sources=self._source_block(sources), report=body),
            self.cfg.writer_model, system=prompts.WRITE_SYSTEM).strip()

    def _source_block(self, sources: list[Source]) -> str:
        return "\n\n".join(f"[{s.id}] {s.title} ({s.url}) — credibility: {s.credibility}\n"
                            + "\n---\n".join(s.passages) for s in sources)

    def find_gaps(self, question: str, sources: list[Source]) -> list[str]:
        try:
            data = self.llm.generate_json(prompts.GAPS.format(
                question=question, titles="; ".join(s.title for s in sources), n=2),
                self.cfg.fast_model)
            return [q for q in data.get("queries", []) if q][:2]
        except Exception:
            return []

    def write(self, question: str, sources: list[Source]) -> str:
        return self.llm.generate(prompts.WRITE.format(question=question,
                                                      sources=self._source_block(sources)),
                                 self.cfg.writer_model, system=prompts.WRITE_SYSTEM).strip()

    def verify(self, body: str, sources: list[Source]) -> list[Claim]:
        claims = extract_claims(body, len(sources))
        if not claims:
            return []
        by_id = {s.id: s for s in sources}
        for start in range(0, len(claims), 12):   # batch to keep prompts small
            batch = claims[start:start + 12]
            items = "\n\n".join(
                f"Claim {c.id}: {c.text}\n" + "\n".join(
                    f"  Source [{i}] passages: " + " … ".join(by_id[i].passages)[:2500]
                    for i in c.cites)
                for c in batch)
            try:
                data = self.llm.generate_json(prompts.VERIFY.format(items=items), self.cfg.fast_model)
                results = {int(r["id"]): r for r in data.get("results", [])}
            except Exception:
                results = {}
            for c in batch:
                r = results.get(c.id)
                if r and r.get("label") in ("supported", "partial", "unsupported"):
                    c.label, c.reason = r["label"], r.get("reason", "")
            self.emit("verify", {"checked": min(start + 12, len(claims)), "total": len(claims)})
        return claims

    def annotate(self, body: str, claims: list[Claim], sources: list[Source]) -> str:
        s = Report("", "", sources, claims).score
        lines = [body, "",
                 "## Citation check",
                 f"{s['supported']} supported · {s['partial']} partial · "
                 f"{s['unsupported']} unsupported out of {s['claims']} cited claims "
                 f"(citation precision **{s['citation_precision']:.0%}**).", ""]
        flagged = [c for c in claims if c.label in ("partial", "unsupported")]
        for c in flagged:
            lines.append(f"- ⚠️ *{c.label}*: “{c.text[:160]}” — {c.reason}")
        lines += ["", "## Sources"] + [f"{x.id}. [{x.title}]({x.url}) · _{x.credibility} credibility_"
                                       for x in sources]
        return "\n".join(lines)


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def extract_claims(body: str, n_sources: int) -> list[Claim]:
    """Split the report into sentences and keep the ones that carry citations."""
    text = re.sub(r"^#+ .*$", "", body, flags=re.M)
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z\-*•])|\n+", text)
    claims = []
    for sent in sentences:
        cites = sorted({int(x) for x in CITE.findall(sent) if 1 <= int(x) <= n_sources})
        clean = CITE.sub("", sent).strip(" -*•\t")
        if cites and len(clean) > 15:
            claims.append(Claim(len(claims) + 1, clean, cites))
    return claims
