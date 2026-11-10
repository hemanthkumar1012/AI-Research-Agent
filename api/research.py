"""SSE streaming research endpoint for Vercel Python runtime."""
import json
import os
import sys
import queue
import threading
from http.server import BaseHTTPRequestHandler

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from research_agent.agent import build_agent
from research_agent.config import PRESETS, Config, apply_preset


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        from urllib.parse import parse_qs, urlparse
        url = urlparse(self.path)
        qs = parse_qs(url.query)

        question = qs.get("q", [""])[0].strip()
        depth = qs.get("depth", ["standard"])[0]

        if not question:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Empty question"}).encode())
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        events = queue.Queue()

        def work():
            try:
                cfg = apply_preset(Config.from_env(), depth if depth in PRESETS else "standard")
                agent = build_agent(cfg, lambda k, d: events.put((k, d)))
                report = agent.run(question)
                data = report.to_dict()
                events.put(("report", data))
            except Exception as e:
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
