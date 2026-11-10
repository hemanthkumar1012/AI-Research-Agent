from research_agent.agent import ResearchAgent, extract_claims
from research_agent.config import Config
from research_agent.fetch import extract_text, top_passages
from research_agent.llm import parse_json
from research_agent.search import SearchResult, parse_ddg_html

PAGE = "<html><body><nav>menu</nav><article>" + "".join(
    f"<p>Paragraph {i} about solar panels efficiency and photovoltaic cells in India, "
    f"with filler text number {i} to make it long enough.</p>" for i in range(30)
) + "<p>Rooftop solar capacity in India crossed many gigawatts according to the ministry report.</p></article></body></html>"


class FakeLLM:
    def __init__(self):
        self.calls = []

    def generate_json(self, prompt, model, **kw):
        self.calls.append("json")
        if "research planner" in prompt:
            return {"subquestions": [{"question": "What is rooftop solar capacity?",
                                      "query": "india rooftop solar capacity"}]}
        if "fact-checker" in prompt:
            return {"results": [{"id": 1, "label": "supported", "reason": "stated"},
                                {"id": 2, "label": "unsupported", "reason": "not in source"}]}
        return {"queries": []}

    def generate(self, prompt, model, **kw):
        return ("## Summary\nRooftop solar capacity in India crossed many gigawatts [1]. "
                "It will double by next year [1].\n\n## Open questions\nNone.")


class FakeSearch:
    def search(self, q, k=4):
        return [SearchResult("Solar report", "https://example.com/solar", "snippet")]


def test_end_to_end_with_fakes():
    events = []
    agent = ResearchAgent(FakeLLM(), FakeSearch(), Config(max_rounds=1),
                          on_event=lambda k, d: events.append(k),
                          fetcher=lambda url, timeout=20: extract_text(PAGE))
    rep = agent.run("How much rooftop solar does India have?")
    assert len(rep.sources) == 1
    assert [c.label for c in rep.claims] == ["supported", "unsupported"]
    assert rep.score["citation_precision"] == 0.5
    assert "## Sources" in rep.markdown and "⚠️" in rep.markdown
    assert events[0] == "status" and events[-1] == "done"


def test_extract_claims_ignores_headings_and_bad_ids():
    body = "## Head [1]\nFirst real claim here [1][2]. Uncited sentence here. Bad cite claim [9]."
    claims = extract_claims(body, 2)
    assert len(claims) == 1 and claims[0].cites == [1, 2]


def test_top_passages_prefers_relevant_chunk():
    text = extract_text(PAGE)
    assert "menu" not in text
    best = top_passages(text, "rooftop solar capacity ministry", k=1, size=300)
    assert "ministry report" in best[0]


def test_parse_json_with_fence():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_parse_ddg_unwraps_redirects():
    html = ('<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg='
            'https%3A%2F%2Fexample.org%2Fx&rut=1">Title</a>'
            '<a class="result__snippet">Snip</a></div>')
    r = parse_ddg_html(html)
    assert r[0].url == "https://example.org/x" and r[0].snippet == "Snip"
