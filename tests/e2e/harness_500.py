"""Static server whose API always fails — exercises frontend error paths."""
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATIC = os.path.join(ROOT, "research_agent", "static")


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=STATIC, **k)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith("/api/history"):
            self.send_response(200); self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", "2"); self.end_headers(); self.wfile.write(b"[]"); return
        if self.path.startswith("/api/"):
            self.send_response(500); self.send_header("Content-Length", "0"); self.end_headers(); return
        if self.path == "/":
            self.path = "/index.html"
        if self.path.startswith("/static/"):
            self.path = self.path[len("/static"):]
        super().do_GET()

    def do_POST(self):
        self.send_response(500); self.send_header("Content-Length", "0"); self.end_headers()


print("e2e failing backend on 8898", flush=True)
ThreadingHTTPServer(("", 8898), H).serve_forever()
