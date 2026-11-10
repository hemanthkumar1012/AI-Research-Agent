import pytest

from research_agent.agent import Report, ResearchAgent
from research_agent.config import Config, apply_preset
from research_agent.fetch import extract_text
from research_agent.search import SearchResult, Searcher, parse_arxiv
from research_agent.store import ReportStore
from tests.test_agent import PAGE, FakeLLM

ARXIV = """<feed xmlns="http://www.w3.org/2005/Atom"><entry>
<id>http://arxiv.org/abs/2401.00001v1</id><published>2024-01-02T00:00:00Z</published>
<title>Solid  State
 Batteries</title><summary>We study lithium metal anodes.</summary>
<author><name>A. Author</name></author></entry></feed>"""


class ConflictLLM(FakeLLM):
    def __init__(self):
        super().__init__()
        self.prompts = []

    def generate_json(self, prompt, model, **kw):
        if "research planner" in prompt:
            return {"subquestions": [{"question": "papers?", "query": "q1", "source": "academic"},
                                     {"question": "bg?", "query": "q2", "source": "bogus"}]}
        if "genuine factual" in prompt:
            return {"conflicts": [
                {"topic": "capacity", "positions": [{"source": 1, "says": "10 GW"},
                                                    {"source": 2, "says": "12 GW"}],
                 "assessment": "gov source"},
                {"topic": "invalid", "positions": [{"source": 1, "says": "x"},
                                                   {"source": 99, "says": "y"}]}]}
        return super().generate_json(prompt, model, **kw)

    def generate(self, prompt, model, **kw):
        self.prompts.append(prompt)
        return super().generate(prompt, model, **kw)


class KindSearch:
    def __init__(self):
        self.kinds = []

    def search(self, q, k=4, kind="web"):
        self.kinds.append(kind)
        return [SearchResult(f"{kind} {q}", f"https://example.com/{kind}/{q}")]


def make(llm, search, **cfg):
    return ResearchAgent(llm, search, Config(max_rounds=1, max_revisions=0, **cfg),
                         fetcher=lambda url, timeout=20: extract_text(PAGE))


def test_planner_routes_source_types_and_conflicts_reach_writer():
    llm, search = ConflictLLM(), KindSearch()
    rep = make(llm, search).run("q")
    assert sorted(search.kinds) == ["academic", "web"]       # bogus -> web
    assert len(rep.conflicts) == 1 and rep.conflicts[0]["topic"] == "capacity"
    assert "Detected disagreements" in llm.prompts[0] and "10 GW" in llm.prompts[0]


def test_conflicts_can_be_disabled():
    rep = make(ConflictLLM(), KindSearch(), detect_conflicts=False).run("q")
    assert rep.conflicts == []


def test_report_roundtrip_and_followup(tmp_path):
    rep = make(FakeLLM(), KindSearch()).run("solar?")
    store = ReportStore(str(tmp_path))
    rid = store.save(rep.to_dict())
    loaded = Report.from_dict(store.load(rid))
    assert loaded.sources[0].url == rep.sources[0].url and loaded.body
    res = make(FakeLLM(), KindSearch()).ask(loaded, "follow up?")
    assert res["answer"] and res["score"]["claims"] == 2
    assert store.list()[0]["id"] == rid
    with pytest.raises(KeyError):
        store.load("../etc/passwd")


def test_presets():
    cfg = apply_preset(Config(), "deep")
    assert cfg.max_rounds == 3 and cfg.max_revisions == 2
    assert apply_preset(Config(), "quick").detect_conflicts is False
    with pytest.raises(ValueError):
        apply_preset(Config(), "insane")


def test_parse_arxiv():
    r = parse_arxiv(ARXIV)[0]
    assert r.title == "Solid State Batteries (arXiv 2024)"
    assert r.url == "https://arxiv.org/abs/2401.00001v1" and "lithium" in r.content


def test_searcher_mixes_providers(monkeypatch):
    s = Searcher()
    monkeypatch.setattr(s, "_arxiv", lambda q, k: [SearchResult("paper", "https://arxiv.org/x")] * k)
    monkeypatch.setattr(s, "_web", lambda q, k: [SearchResult("web", "https://w.com")] * k)
    out = s.search("q", 4, kind="academic")
    assert [r.title for r in out] == ["paper"] * 3 + ["web"]
    assert all(r.title == "web" for r in s.search("q", 2))
