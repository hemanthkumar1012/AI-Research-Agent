"""Real backend server for e2e tests: real handlers, fake LLM/search."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from http.server import ThreadingHTTPServer
from research_agent import server as srv
from research_agent.agent import ResearchAgent
from research_agent.config import Config
from research_agent.fetch import extract_text
from research_agent.search import SearchResult
from research_agent.store import ReportStore
from tests.test_agent import PAGE, FakeLLM, FakeSearch


class RichSearch(FakeSearch):
    def search(self, q, k=4, kind="web"):
        return [SearchResult("Solar report", "https://example.com/solar", "snippet"),
                SearchResult("Capacity statistics", "https://stats.example.org/capacity", "snippet"),
                SearchResult("Policy overview", "https://policy.example.net/overview", "snippet")]


class RichLLM(FakeLLM):
    def generate(self, prompt, model, **kw):
        self.calls.append("gen")
        return ("## Summary\nIndia has significant rooftop solar capacity [1]. "
                "Growth is driven by subsidies [2]. Policy support continues [3].\n\n"
                "## Details\nCapacity expanded rapidly across states [1][2]. "
                "New policy frameworks encourage adoption [3].")

    def generate_json(self, prompt, model, **kw):
        self.calls.append("json")
        if "research planner" in prompt:
            return {"subquestions": [{"question": "What is rooftop solar capacity?",
                                      "query": "india rooftop solar capacity"}]}
        if "fact-checker" in prompt:
            return {"results": [{"id": i, "label": l, "reason": "checked"} for i, l in
                                [(1, "supported"), (2, "supported"), (3, "partial"),
                                 (4, "supported"), (5, "unsupported")]]}
        return {"queries": []}


srv.Handler.agent_factory = staticmethod(lambda cfg, emit: ResearchAgent(
    RichLLM(), RichSearch(), Config(max_rounds=1), emit,
    fetcher=lambda url, timeout=20: extract_text(PAGE)))
srv.Handler.store = ReportStore(os.environ.get("E2E_STORE", "/tmp/verity-e2e-store"))
print("e2e real backend on 8899", flush=True)
ThreadingHTTPServer(("", 8899), srv.Handler).serve_forever()
