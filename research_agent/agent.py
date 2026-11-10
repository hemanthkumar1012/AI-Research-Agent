"""The research loop: plan -> search -> read -> (fill gaps) -> write -> verify citations."""
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Callable

from . import prompts
from .config import Config
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
                "claims": [asdict(c) for c in self.claims]}


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

        self.emit("status", {"message": f"Writing report from {len(sources)} sources"})
        body = self.write(question, sources)
        self.emit("status", {"message": "Verifying citations"})
        claims = self.verify(body, sources)
        report = Report(question, self.annotate(body, claims, sources), sources, claims)
        self.emit("done", {"score": report.score})
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
            passages = top_passages(text, f"{question} {sub_q}",
                                    self.cfg.passages_per_source, self.cfg.passage_chars)
            return r, passages

        with ThreadPoolExecutor(max_workers=8) as pool:
            for r, passages in pool.map(read, candidates):
                if passages and len(sources) < self.cfg.max_sources:
                    src = Source(len(sources) + 1, r.title or r.url, r.url, passages)
                    sources.append(src)
                    self.emit("source", {"id": src.id, "title": src.title, "url": src.url})

    def find_gaps(self, question: str, sources: list[Source]) -> list[str]:
        try:
            data = self.llm.generate_json(prompts.GAPS.format(
                question=question, titles="; ".join(s.title for s in sources), n=2),
                self.cfg.fast_model)
            return [q for q in data.get("queries", []) if q][:2]
        except Exception:
            return []

    def write(self, question: str, sources: list[Source]) -> str:
        block = "\n\n".join(f"[{s.id}] {s.title} ({s.url})\n" + "\n---\n".join(s.passages)
                            for s in sources)
        return self.llm.generate(prompts.WRITE.format(question=question, sources=block),
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
        lines += ["", "## Sources"] + [f"{x.id}. [{x.title}]({x.url})" for x in sources]
        return "\n".join(lines)


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
