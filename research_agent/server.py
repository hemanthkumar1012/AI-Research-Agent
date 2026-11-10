"""Zero-dependency web UI: streams agent events over Server-Sent Events, stores reports,
and answers follow-up questions about them."""
import json
import os
import queue
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .agent import Report, build_agent
from .config import PRESETS, Config, apply_preset
from .store import ReportStore

STATIC = os.path.join(os.path.dirname(__file__), "static", "index.html")


def make_agent(cfg, emit=None):
    return build_agent(cfg, emit)


class Handler(BaseHTTPRequestHandler):
    agent_factory = staticmethod(make_agent)
    store = None

    def log_message(self, *a):
        pass

    @classmethod
    def get_store(cls) -> ReportStore:
        if cls.store is None:
            cls.store = ReportStore(os.getenv("REPORTS_DIR", "reports"))
        return cls.store

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        qs = parse_qs(url.query)
        if url.path == "/":
            with open(STATIC, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(body)
        elif url.path == "/api/research":
            self.stream(qs.get("q", [""])[0].strip(), qs.get("depth", ["standard"])[0])
        elif url.path == "/api/history":
            self.send_json(self.get_store().list())
        elif url.path == "/api/report":
            try:
                self.send_json(self.get_store().load(qs.get("id", [""])[0]))
            except KeyError:
                self.send_json({"error": "not found"}, 404)
        else:
            self.send_error(404)

    def do_POST(self):
        if urlparse(self.path).path != "/api/ask":
            return self.send_error(404)
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            report = Report.from_dict(self.get_store().load(req["id"]))
            agent = self.agent_factory(Config.from_env(), None)
            self.send_json(agent.ask(report, req["question"], req.get("history", [])))
        except KeyError:
            self.send_json({"error": "unknown report or missing field"}, 400)
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def stream(self, question: str, depth: str):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        events: queue.Queue = queue.Queue()

        def work():
            try:
                if not question:
                    raise ValueError("Empty question")
                cfg = apply_preset(Config.from_env(), depth if depth in PRESETS else "standard")
                report = self.agent_factory(cfg, lambda k, d: events.put((k, d))).run(question)
                data = report.to_dict()
                self.get_store().save(data)
                events.put(("report", data))
            except Exception as e:  # surface errors to the UI
                events.put(("error", {"message": str(e)}))
            events.put(None)

        threading.Thread(target=work, daemon=True).start()
        while (item := events.get()) is not None:
            kind, data = item
            try:
                self.wfile.write(f"event: {kind}\ndata: {json.dumps(data)}\n\n".encode())
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                return


def main():
    port = int(os.getenv("PORT", 8000))
    print(f"AI Research Agent running at http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
