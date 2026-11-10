import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer

from research_agent import server
from research_agent.agent import ResearchAgent
from research_agent.config import Config
from research_agent.fetch import extract_text
from tests.test_agent import PAGE, FakeLLM, FakeSearch


def test_sse_stream_emits_report():
    server.Handler.agent_factory = staticmethod(lambda cfg, emit: ResearchAgent(
        FakeLLM(), FakeSearch(), Config(max_rounds=1), emit,
        fetcher=lambda url, timeout=20: extract_text(PAGE)))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        port = httpd.server_address[1]
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        body = opener.open(f"http://127.0.0.1:{port}/api/research?q=solar", timeout=10).read().decode()
        kinds = [l[7:] for l in body.splitlines() if l.startswith("event: ")]
        assert kinds[0] == "status" and kinds[-1] == "report"
        data = json.loads(body.strip().splitlines()[-1][6:])
        assert data["score"]["claims"] == 2
        assert "AI Research Agent" in opener.open(f"http://127.0.0.1:{port}/").read().decode()
    finally:
        httpd.shutdown()
