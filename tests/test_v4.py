import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer

from research_agent import server
from research_agent.agent import ResearchAgent
from research_agent.config import Config
from research_agent.evaluate import evaluate
from research_agent.fetch import extract_text, pdf_text, read_local
from research_agent.search import SearchResult, parse_arxiv
from research_agent.store import ReportStore
from tests.test_agent import PAGE, FakeLLM, FakeSearch
from tests.test_v3 import ARXIV


def make_pdf(text: str) -> bytes:
    """Hand-built single-page PDF containing `text`."""
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
            b"/Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offs = bytearray(b"%PDF-1.4\n"), []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % x for x in offs)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % (len(objs) + 1, xref)
    return bytes(out)


LOCAL = ("Internal memo: rooftop solar capacity in our state reached 4 gigawatts this year "
         "according to the ministry report and our own survey of installers. ") * 3


def test_pdf_text_and_local_files(tmp_path):
    assert "rooftop solar" in pdf_text(make_pdf("rooftop solar capacity memo"))
    (tmp_path / "memo.pdf").write_bytes(make_pdf("rooftop solar capacity memo"))
    (tmp_path / "notes.md").write_text(LOCAL)
    assert "rooftop solar" in read_local(str(tmp_path / "memo.pdf"))
    assert read_local(str(tmp_path / "notes.md")).startswith("Internal memo")


def test_user_documents_become_first_sources(tmp_path):
    f = tmp_path / "notes.md"
    f.write_text(LOCAL)
    agent = ResearchAgent(FakeLLM(), FakeSearch(), Config(max_rounds=1, max_revisions=0),
                          fetcher=lambda url, timeout=20: extract_text(PAGE))
    rep = agent.run("rooftop solar capacity?", files=[str(f)])
    assert rep.sources[0].credibility == "user" and rep.sources[0].title == "notes.md"
    assert rep.sources[0].id == 1 and len(rep.sources) == 2


def test_arxiv_full_paper_preferred():
    r = parse_arxiv(ARXIV)[0]
    assert r.pdf_url == "https://arxiv.org/pdf/2401.00001v1"
    fetched = []

    class ArxivSearch:
        def search(self, q, k=4, kind="web"):
            return [r]

    def fetcher(url, timeout=20):
        fetched.append(url)
        return "FULL PAPER rooftop solar lithium anodes discussion. " * 100

    ResearchAgent(FakeLLM(), ArxivSearch(), Config(max_rounds=1, max_revisions=0),
                  fetcher=fetcher).run("q")
    assert fetched == [r.pdf_url]


def test_eval_judge_scores():
    class JudgeLLM(FakeLLM):
        def generate_json(self, prompt, model, **kw):
            if "grading a research report" in prompt:
                return {"coverage": 8, "depth": 6, "balance": 7, "clarity": 9, "comment": "ok"}
            return super().generate_json(prompt, model, **kw)

    make = lambda: ResearchAgent(JudgeLLM(), FakeSearch(), Config(max_rounds=1),
                                 fetcher=lambda url, timeout=20: extract_text(PAGE))
    res = evaluate(make, ["q"])
    assert res["rows"][0]["quality"] == 7.5 and res["summary"]["avg_quality"] == 7.5


def test_upload_then_research(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "UPLOADS", str(tmp_path / "up"))
    seen = {}

    class Spy(ResearchAgent):
        def run(self, question, files=None):
            seen["files"] = files
            return super().run(question, files=files)

    server.Handler.agent_factory = staticmethod(lambda cfg, emit: Spy(
        FakeLLM(), FakeSearch(), Config(max_rounds=1), emit,
        fetcher=lambda url, timeout=20: extract_text(PAGE)))
    server.Handler.store = ReportStore(str(tmp_path / "rep"))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"
    op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        bad = urllib.request.Request(base + "/api/upload", data=b"x", headers={"X-Filename": "a.exe"})
        try:
            op.open(bad)
            raise AssertionError("expected 400")
        except urllib.error.HTTPError as e:
            assert e.code == 400
        req = urllib.request.Request(base + "/api/upload", data=LOCAL.encode(),
                                     headers={"X-Filename": "notes.md"})
        tok = json.loads(op.open(req).read())["token"]
        op.open(f"{base}/api/research?q=solar&files={tok},../../etc/passwd", timeout=10).read()
        assert len(seen["files"]) == 1 and seen["files"][0].endswith("notes.md")
    finally:
        httpd.shutdown()
        server.Handler.store = None
