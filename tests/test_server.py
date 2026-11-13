import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer

from research_agent import server
from research_agent.agent import ResearchAgent
from research_agent.config import Config
from research_agent.fetch import extract_text
from research_agent.store import ReportStore
from tests.test_agent import PAGE, FakeLLM, FakeSearch

OPEN = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def test_stream_history_and_followup(tmp_path):
    server.Handler.agent_factory = staticmethod(lambda cfg, emit: ResearchAgent(
        FakeLLM(), FakeSearch(), Config(max_rounds=1), emit,
        fetcher=lambda url, timeout=20: extract_text(PAGE)))
    server.Handler.store = ReportStore(str(tmp_path))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"
    try:
        body = OPEN.open(base + "/api/research?q=solar&depth=quick", timeout=10).read().decode()
        kinds = [l[7:] for l in body.splitlines() if l.startswith("event: ")]
        assert kinds[0] == "status" and kinds[-1] == "report"
        data = json.loads(body.strip().splitlines()[-1][6:])
        assert data["score"]["claims"] == 2 and data["id"]

        hist = json.loads(OPEN.open(base + "/api/history").read())
        assert hist[0]["id"] == data["id"]
        saved = json.loads(OPEN.open(base + "/api/report?id=" + data["id"]).read())
        assert saved["question"] == "solar"

        req = urllib.request.Request(base + "/api/ask", method="POST",
                                     data=json.dumps({"id": data["id"], "question": "why?"}).encode(),
                                     headers={"Content-Type": "application/json"})
        ans = json.loads(OPEN.open(req).read())
        assert "answer" in ans and "score" in ans
        assert "Nyna AI" in OPEN.open(base + "/").read().decode()
    finally:
        httpd.shutdown()
        server.Handler.store = None
