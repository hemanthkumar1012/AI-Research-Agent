from research_agent.agent import ResearchAgent, cosine
from research_agent.cache import Cache
from research_agent.config import Config
from research_agent.credibility import credibility
from research_agent.fetch import extract_text
from research_agent.search import SearchResult
from tests.test_agent import PAGE, FakeLLM

GOOD = "## Summary\nRooftop solar capacity in India crossed many gigawatts [1]."


class RevisingLLM(FakeLLM):
    """First draft has a bad claim; the revision removes it."""
    def generate(self, prompt, model, **kw):
        if "fact-checker found problems" in prompt:
            return GOOD
        return super().generate(prompt, model, **kw)

    def generate_json(self, prompt, model, **kw):
        if "fact-checker" in prompt and "double" not in prompt:
            return {"results": [{"id": 1, "label": "supported", "reason": "ok"}]}
        return super().generate_json(prompt, model, **kw)


class EmbedLLM(FakeLLM):
    def embed(self, texts):
        # pretend vectors: relevance = mentions of "ministry"
        return [[1.0, float("ministry" in t or "solar" in t.split()[0:1])] for t in texts]


class TwoSites:
    def search(self, q, k=4):
        return [SearchResult("Forum", "https://www.reddit.com/r/x"),
                SearchResult("Gov", "https://mnre.gov.in/solar")]


def make(llm, search=TwoSites(), **cfg):
    return ResearchAgent(llm, search, Config(max_rounds=1, **cfg),
                         fetcher=lambda url, timeout=20: extract_text(PAGE))


def test_self_correction_improves_precision():
    rep = make(RevisingLLM()).run("q")
    assert rep.revisions == 1
    assert [h["citation_precision"] for h in rep.history] == [0.5, 1.0]
    assert rep.score["unsupported"] == 0


def test_revision_disabled():
    rep = make(RevisingLLM(), max_revisions=0).run("q")
    assert rep.revisions == 0 and rep.score["unsupported"] == 1


def test_credibility_ordering_and_labels():
    assert credibility("https://mnre.gov.in/x") == "high"
    assert credibility("https://reddit.com/r/a") == "low"
    assert credibility("https://example.com") == "medium"
    rep = make(FakeLLM(), max_revisions=0).run("q")
    assert rep.sources[0].url.startswith("https://mnre.gov.in") and rep.sources[0].id == 1


def test_embedding_rerank_trims_passages():
    rep = make(EmbedLLM(), max_revisions=0, passages_per_source=2).run("q")
    assert all(len(s.passages) <= 2 for s in rep.sources)
    assert abs(cosine([1, 0], [1, 0]) - 1) < 1e-9


def test_cache_roundtrip(tmp_path):
    c = Cache(str(tmp_path / "c.sqlite"))
    k = c.key("gen", "m", {"a": 1})
    assert c.get(k) is None
    c.set(k, "hello")
    assert c.get(k) == "hello"
