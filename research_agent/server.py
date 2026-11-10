"""Zero-dependency web UI: streams agent events over Server-Sent Events, stores reports,
and answers follow-up questions about them."""
import json
import os
import queue
import re
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .agent import Report, build_agent
from .config import PRESETS, Config, apply_preset
from .store import ReportStore

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
UPLOADS = os.getenv("UPLOADS_DIR", "uploads")
ALLOWED = (".pdf", ".txt", ".md", ".html", ".htm")
MAX_UPLOAD = 25 * 1024 * 1024


def upload_path(token: str) -> str | None:
    """Map an upload token back to its file, refusing anything outside the uploads folder."""
    if not re.fullmatch(r"[a-f0-9]{32}__[\w\-. ]+", token or ""):
        return None
    path = os.path.join(UPLOADS, token)
    return path if os.path.isfile(path) else None


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

    def serve_static(self, filename: str):
        """Serve a file from the static directory with correct MIME type."""
        safe = os.path.basename(filename)
        path = os.path.join(STATIC_DIR, safe)
        if not os.path.isfile(path):
            return self.send_error(404)
        ext = os.path.splitext(safe)[1].lower()
        mime = self.MIME.get(ext, "application/octet-stream")
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    # MIME types for static file serving
    MIME = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
        ".map": "application/json",
    }

    def do_GET(self):
        url = urlparse(self.path)
        qs = parse_qs(url.query)
        if url.path == "/":
            return self.serve_static("index.html")
        if url.path.startswith("/static/"):
            fname = url.path[len("/static/"):]
            return self.serve_static(fname)
        if url.path == "/api/research":
            files = [p for t in qs.get("files", [""])[0].split(",") if (p := upload_path(t))]
            self.stream(qs.get("q", [""])[0].strip(), qs.get("depth", ["standard"])[0], files)
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
        path = urlparse(self.path).path
        if path == "/api/upload":
            return self.upload()
        if path != "/api/ask":
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

    def upload(self):
        name = os.path.basename(self.headers.get("X-Filename", "")).strip()
        size = int(self.headers.get("Content-Length", 0))
        if not name.lower().endswith(ALLOWED):
            return self.send_json({"error": f"Unsupported file type. Use {', '.join(ALLOWED)}"}, 400)
        if not 0 < size <= MAX_UPLOAD:
            return self.send_json({"error": "File empty or larger than 25 MB"}, 400)
        os.makedirs(UPLOADS, exist_ok=True)
        safe = re.sub(r"[^\w\-. ]", "_", name)[:100]
        token = f"{uuid.uuid4().hex}__{safe}"
        with open(os.path.join(UPLOADS, token), "wb") as f:
            f.write(self.rfile.read(size))
        self.send_json({"token": token, "name": safe})

    def stream(self, question: str, depth: str, files: list[str] | None = None):
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
                agent = self.agent_factory(cfg, lambda k, d: events.put((k, d)))
                report = agent.run(question, files=files) if files else agent.run(question)
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
