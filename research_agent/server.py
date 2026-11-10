"""Zero-dependency web UI: streams agent events to the browser over Server-Sent Events."""
import json
import os
import queue
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .agent import ResearchAgent
from .config import Config
from .llm import GeminiClient
from .search import Searcher

STATIC = os.path.join(os.path.dirname(__file__), "static", "index.html")


def make_agent(cfg, emit):
    return ResearchAgent(GeminiClient(cfg.gemini_api_key), Searcher(cfg.tavily_api_key), cfg, emit)


class Handler(BaseHTTPRequestHandler):
    agent_factory = staticmethod(make_agent)

    def log_message(self, *a):
        pass

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/":
            with open(STATIC, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(body)
        elif url.path == "/api/research":
            q = parse_qs(url.query).get("q", [""])[0].strip()
            self.stream(q)
        else:
            self.send_error(404)

    def stream(self, question: str):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        events: queue.Queue = queue.Queue()

        def work():
            try:
                if not question:
                    raise ValueError("Empty question")
                cfg = Config.from_env()
                report = self.agent_factory(cfg, lambda k, d: events.put((k, d))).run(question)
                events.put(("report", report.to_dict()))
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
