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
from .fetch import fetch_doc, read_local, top_passages
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
    date: str = ""


@dataclass
class Claim:
    id: int
    text: str
    cites: list[int]
    label: str = "unchecked"
    reason: str = ""
    facts: list[dict] = field(default_factory=list)   # atomic facts with evidence quotes


@dataclass
class Report:
    question: str
    markdown: str
    sources: list[Source]
    claims: list[Claim]
    revisions: int = 0
    history: list[dict] = field(default_factory=list)   # score after each draft
    usage: dict = field(default_factory=dict)
    conflicts: list[dict] = field(default_factory=list)
    plan: list[dict] = field(default_factory=list)
    body: str = ""                                       # report without appendix
    time_sensitive: bool = False

    @property
    def score(self) -> dict:
        n = len(self.claims) or 1
        c = {k: sum(cl.label == k for cl in self.claims)
             for k in ("supported", "partial", "unsupported")}
        c["citation_precision"] = round((c["supported"] + 0.5 * c["partial"]) / n, 3)
        c["claims"] = len(self.claims)
        facts = [f for cl in self.claims for f in cl.facts]
        c["facts"] = len(facts)
        c["fact_precision"] = round(sum(bool(f.get("supported")) for f in facts) / len(facts), 3) \
            if facts else None
        return c

    def to_dict(self) -> dict:
        return {"question": self.question, "markdown": self.markdown, "score": self.score,
                "sources": [asdict(s) for s in self.sources],
                "claims": [asdict(c) for c in self.claims], "revisions": self.revisions,
                "history": self.history, "usage": self.usage, "conflicts": self.conflicts,
                "plan": self.plan, "body": self.body, "time_sensitive": self.time_sensitive}

    @classmethod
    def from_dict(cls, d: dict) -> "Report":
        return cls(d["question"], d["markdown"], [Source(**s) for s in d.get("sources", [])],
                   [Claim(**c) for c in d.get("claims", [])], d.get("revisions", 0),
                   d.get("history", []), d.get("usage", {}), d.get("conflicts", []),
                   d.get("plan", []), d.get("body", ""), d.get("time_sensitive", False))


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
                 fetcher=fetch_doc):
        self.llm, self.searcher, self.cfg = llm, searcher, config
        self.emit = on_event or (lambda kind, data: None)
        self._fetcher = fetcher
        self.time_sensitive = False

    def fetch(self, url: str, timeout: int = 20) -> tuple[str, str]:
        """Accept fetchers returning either text or (text, date)."""
        out = self._fetcher(url, timeout=timeout)
        return out if isinstance(out, tuple) else (out or "", "")

    def over_budget(self) -> bool:
        used = getattr(self.llm, "tokens_used", 0)
        return bool(self.cfg.max_tokens) and isinstance(used, int) and used >= self.cfg.max_tokens

    def _skip_for_budget(self, step: str) -> bool:
        if self.over_budget():
            self.emit("budget", {"message": f"Token budget reached; skipping {step}",
                                 "used": self.llm.tokens_used, "limit": self.cfg.max_tokens})
            return True
        return False

    # ---------- public ----------
    def run(self, question: str, files: list[str] | None = None) -> Report:
        self.emit("status", {"message": "Planning research"})
        plan = self.plan(question)
        self.emit("plan", {"subquestions": plan, "time_sensitive": self.time_sensitive})

        sources: list[Source] = []
        seen: set[str] = set()
        if files:
            self.add_local(files, question, plan, sources, seen)
        queries = [(p["question"], p["query"], p.get("source", "web")) for p in plan]
        for rnd in range(self.cfg.max_rounds):
            self.gather(queries, question, sources, seen)
            if rnd == self.cfg.max_rounds - 1 or len(sources) >= self.cfg.max_sources:
                break
            if self._skip_for_budget("gap filling"):
                break
            gaps = self.find_gaps(question, sources)
            if not gaps:
                break
            self.emit("gaps", {"queries": gaps})
            queries = [(question, q, "web") for q in gaps]

        if not sources:
            raise RuntimeError("No usable sources found. Try rephrasing the question.")

        sources = self.finalize_sources(question, sources)
        conflicts = (self.find_conflicts(question, sources)
                     if self.cfg.detect_conflicts and not self._skip_for_budget("conflict analysis")
                     else [])

        self.emit("status", {"message": f"Writing report from {len(sources)} sources"})
        body = self.write(question, sources, conflicts)
        self.emit("status", {"message": "Verifying citations"})
        claims = self.verify(body, sources)
        history = [Report("", "", sources, claims).score]

        revisions = 0
        while revisions < self.cfg.max_revisions:
            flagged = [c for c in claims if c.label in ("partial", "unsupported")]
            if not flagged or self._skip_for_budget("self-correction"):
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
                        revisions, history, dict(getattr(self.llm, "usage", {})), conflicts,
                        plan, body, self.time_sensitive)
        self.emit("done", {"score": report.score, "revisions": revisions, "history": history})
        return report

    # ---------- steps ----------
    def plan(self, question: str) -> list[dict]:
        data = self.llm.generate_json(prompts.PLAN.format(
            n=self.cfg.max_subquestions, question=question, today=date.today()),
            self.cfg.fast_model)
        self.time_sensitive = bool(data.get("time_sensitive"))
        subs = [s for s in data.get("subquestions", []) if s.get("query")]
        for sq in subs:
            if sq.get("source") not in ("web", "academic", "encyclopedic"):
                sq["source"] = "web"
        return (subs[: self.cfg.max_subquestions]
                or [{"question": question, "query": question, "source": "web"}])

    def gather(self, queries, question, sources: list[Source], seen: set[str]) -> None:
        candidates = []
        def run_search(item):
            sub_q, query, kind = item
            self.emit("search", {"query": query, "kind": kind})
            try:
                return sub_q, self.searcher.search(query, self.cfg.results_per_query, kind=kind)
            except TypeError:   # searchers without provider routing
                return sub_q, self.searcher.search(query, self.cfg.results_per_query)

        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(run_search, queries))
        for sub_q, hits in results:
            for r in hits:
                if r.url not in seen:
                    seen.add(r.url)
                    candidates.append((sub_q, r))
        room = self.cfg.max_sources - len(sources)
        candidates = candidates[: room * 2]

        def read(item):
            sub_q, r = item
            text, date = "", getattr(r, "date", "")
            if r.pdf_url and self.cfg.read_full_papers:
                text, _ = self.fetch(r.pdf_url, timeout=self.cfg.request_timeout * 2)
                if len(text) > 2000:
                    self.emit("status", {"message": f"Read full paper: {r.title[:60]}"})
                    text = (r.content + "\n" + text) if r.content else text
                else:
                    text = ""
            if not text and r.content:
                text = r.content
            if not text:
                text, page_date = self.fetch(r.url, timeout=self.cfg.request_timeout)
                date = date or page_date
            if len(text) < 200:
                text = (text + "\n" + r.snippet).strip()
            k = self.cfg.candidate_passages if self._can_embed() else self.cfg.passages_per_source
            passages = top_passages(text, f"{question} {sub_q}", k, self.cfg.passage_chars)
            return r, passages, date

        with ThreadPoolExecutor(max_workers=8) as pool:
            for r, passages, date in pool.map(read, candidates):
                if passages and len(sources) < self.cfg.max_sources:
                    src = Source(len(sources) + 1, r.title or r.url, r.url, passages,
                                 credibility(r.url), date=date)
                    sources.append(src)
                    self.emit("source", {"id": src.id, "title": src.title, "url": src.url,
                                         "credibility": src.credibility, "date": src.date})

    def add_local(self, files, question, plan, sources: list[Source], seen: set[str]) -> None:
        """User-supplied documents become first-class sources (credibility: user)."""
        query = question + " " + " ".join(p["question"] for p in plan)
        k = self.cfg.candidate_passages if self._can_embed() else self.cfg.passages_per_source
        for path in files:
            try:
                text = read_local(path)
            except OSError as e:
                self.emit("status", {"message": f"Could not read {path}: {e}"})
                continue
            passages = top_passages(text, query, k + 2, self.cfg.passage_chars)
            if not passages:
                continue
            url = "file://" + path.replace("\\", "/")
            seen.add(url)
            src = Source(len(sources) + 1, path.replace("\\", "/").split("/")[-1], url, passages, "user")
            sources.append(src)
            self.emit("source", {"id": src.id, "title": src.title, "url": src.url,
                                 "credibility": "user"})

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
                sources = [s for s in sources if s.relevance >= best * 0.6
                           or s.credibility == "user"] or sources
            except Exception as e:
                self.emit("status", {"message": f"Embedding rerank skipped ({e})"})
                for s in sources:
                    s.passages = s.passages[: self.cfg.passages_per_source]
        if self.time_sensitive:
            # newest first within each credibility tier; undated sources last
            sources.sort(key=lambda s: (RANK.get(s.credibility, 2),
                                        -int(s.date.replace("-", "") or 0)))
        else:
            sources.sort(key=lambda s: RANK.get(s.credibility, 2))
        for i, s in enumerate(sources, 1):
            s.id = i
        return sources

    def find_conflicts(self, question: str, sources: list[Source]) -> list[dict]:
        if len(sources) < 2:
            return []
        self.emit("status", {"message": "Cross-checking sources for contradictions"})
        try:
            data = self.llm.generate_json(prompts.CONFLICTS.format(
                question=question, sources=self._source_block(sources)), self.cfg.fast_model)
        except Exception:
            return []
        ids = {s.id for s in sources}
        out = []
        for c in data.get("conflicts", [])[:5]:
            pos = [p for p in c.get("positions", []) if isinstance(p.get("source"), int)
                   and p["source"] in ids]
            if c.get("topic") and len(pos) >= 2:
                out.append({"topic": c["topic"], "positions": pos,
                            "assessment": c.get("assessment", "")})
        if out:
            self.emit("conflicts", {"conflicts": out})
        return out

    def ask(self, report: "Report", followup: str, history: list[dict] | None = None) -> dict:
        """Answer a follow-up question grounded in the report's sources, with verified citations."""
        hist = "\n".join(f"{m['role']}: {m['content']}" for m in (history or [])[-6:]) or "(none)"
        answer = self.llm.generate(prompts.ASK.format(
            question=report.question, report=report.body or report.markdown,
            sources=self._source_block(report.sources), history=hist, followup=followup),
            self.cfg.fast_model, system=prompts.ASK_SYSTEM).strip()
        claims = self.verify(answer, report.sources)
        return {"answer": answer, "claims": [asdict(c) for c in claims],
                "score": Report("", "", report.sources, claims).score}

    def revise(self, body: str, flagged: list[Claim], sources: list[Source]) -> str:
        items = "\n".join(f"- ({c.label}) \"{c.text}\" cites {c.cites}: {c.reason}" for c in flagged)
        return self._compose(prompts.REVISE.format(
            flagged=items, sources=self._source_block(sources), report=body), "revision")

    def _source_block(self, sources: list[Source]) -> str:
        return "\n\n".join(f"[{s.id}] {s.title} ({s.url}) — credibility: {s.credibility}"
                            + (f", published {s.date}" if s.date else "") + "\n"
                            + "\n---\n".join(s.passages) for s in sources)

    def find_gaps(self, question: str, sources: list[Source]) -> list[str]:
        try:
            data = self.llm.generate_json(prompts.GAPS.format(
                question=question, titles="; ".join(s.title for s in sources), n=2),
                self.cfg.fast_model)
            return [q for q in data.get("queries", []) if q][:2]
        except Exception:
            return []

    def _compose(self, prompt: str, phase: str) -> str:
        """Writer call; streams tokens to listeners when the client supports it."""
        stream = getattr(self.llm, "stream", None)
        if self.cfg.stream and callable(stream):
            self.emit("writing", {"phase": phase})
            chunks = []
            for chunk in stream(prompt, self.cfg.writer_model, system=prompts.WRITE_SYSTEM):
                chunks.append(chunk)
                self.emit("token", {"text": chunk})
            return "".join(chunks).strip()
        return self.llm.generate(prompt, self.cfg.writer_model, system=prompts.WRITE_SYSTEM).strip()

    def write(self, question: str, sources: list[Source], conflicts: list[dict] | None = None) -> str:
        cblock = ""
        if conflicts:
            cblock = "\nDetected disagreements between sources (address these explicitly):\n" + "\n".join(
                f"- {c['topic']}: " + "; ".join(f"[{p['source']}] {p['says']}" for p in c["positions"])
                + (f" (assessment: {c['assessment']})" if c.get("assessment") else "")
                for c in conflicts) + "\n"
        return self._compose(prompts.WRITE.format(question=question,
                                                  sources=self._source_block(sources),
                                                  conflicts=cblock), "draft")

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
                    c.facts = clean_facts(r.get("facts"), c.cites)
                    if c.facts:   # derive the label from atomic facts for consistency
                        ok = sum(f["supported"] for f in c.facts)
                        c.label = ("supported" if ok == len(c.facts) and c.label != "partial"
                                   else "unsupported" if ok == 0 else "partial")
            self.emit("verify", {"checked": min(start + 12, len(claims)), "total": len(claims)})
        return claims

    def annotate(self, body: str, claims: list[Claim], sources: list[Source]) -> str:
        s = Report("", "", sources, claims).score
        lines = [body, "",
                 "## Citation check",
                 f"{s['supported']} supported · {s['partial']} partial · "
                 f"{s['unsupported']} unsupported out of {s['claims']} cited claims "
                 f"(citation precision **{s['citation_precision']:.0%}**"
                 + (f", atomic-fact precision **{s['fact_precision']:.0%}** over {s['facts']} facts"
                    if s.get("fact_precision") is not None else "") + ").", ""]
        flagged = [c for c in claims if c.label in ("partial", "unsupported")]
        for c in flagged:
            lines.append(f"- ⚠️ *{c.label}*: “{c.text[:160]}” — {c.reason}")
        lines += ["", "## Sources"] + [f"{x.id}. [{x.title}]({x.url}) · _{x.credibility} credibility_"
                                       for x in sources]
        return "\n".join(lines)


def clean_facts(raw, cites: list[int]) -> list[dict]:
    """Validate the verifier's atomic facts; drop malformed entries."""
    out = []
    for f in raw or []:
        if not isinstance(f, dict) or not str(f.get("fact", "")).strip():
            continue
        src = f.get("source")
        out.append({"fact": str(f["fact"]).strip()[:300], "supported": bool(f.get("supported")),
                    "source": src if isinstance(src, int) and src in cites else None,
                    "quote": str(f.get("quote") or "")[:300]})
    return out[:6]


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
