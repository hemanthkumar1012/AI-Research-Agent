from research_agent.agent import ResearchAgent
from research_agent.config import Config
from research_agent.evaluate import evaluate, to_markdown
from research_agent.fetch import extract_text
from tests.test_agent import PAGE, FakeLLM, FakeSearch


def test_evaluate_aggregates():
    make = lambda: ResearchAgent(FakeLLM(), FakeSearch(), Config(max_rounds=1),
                                 fetcher=lambda url, timeout=20: extract_text(PAGE))
    res = evaluate(make, ["q1", "q2"])
    assert res["summary"]["succeeded"] == 2
    assert res["summary"]["citation_precision"] == 0.5
    assert "| Metric |" in to_markdown(res)
