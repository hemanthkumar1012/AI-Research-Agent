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
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        self.close_connection = True

        events = queue.Queue()

        def work():
            t0 = __import__("time").time()
            try:
                cfg = apply_preset(Config.from_env(), depth if depth in PRESETS else "standard")
                if not cfg.gemini_api_key:
                    raise RuntimeError("GEMINI_API_KEY is not set on the server")
                # Serverless functions are capped at ~60s: use a fast pipeline
                cfg.max_rounds = 1
                cfg.max_revisions = 0
                cfg.read_full_papers = False
                cfg.use_embeddings = False
                cfg.detect_conflicts = depth != "standard"
                cfg.request_timeout = 6
                cfg.use_cache = False
                cfg.max_subquestions = min(cfg.max_subquestions, 2 if depth == "standard" else 3)
                cfg.results_per_query = min(cfg.results_per_query, 3)
                cfg.max_sources = min(cfg.max_sources, 5 if depth == "standard" else 7)
                cfg.passages_per_source = 2
                cfg.passage_chars = 700
                cfg.llm_timeout = 25      # one Gemini call may use at most 25s
                cfg.llm_retries = 2   # one retry absorbs transient 503s
                cfg.wall_deadline = __import__("time").time() + 40  # skip optional stages past 40s
                def _ev(k, d):
                    print(f"[research +{__import__('time').time()-t0:5.1f}s] {k}: {str(d)[:140]}", flush=True)
                    events.put((k, d))
                agent = build_agent(cfg, _ev)
                report = agent.run(question)
                data = report.to_dict()
                events.put(("report", data))
            except Exception as e:
                print(f"[research +{__import__('time').time()-t0:5.1f}s] FAILED: {e}", flush=True)
                events.put(("error", {"message": str(e)}))
            events.put(None)

        import time
        threading.Thread(target=work, daemon=True).start()
        deadline = time.time() + 50
        while True:
            try:
                item = events.get(timeout=max(0.1, deadline - time.time()))
            except queue.Empty:
                item = ("error", {"message": "Research took too long for the server time limit. Try a shorter, more specific question."})
                try:
                    self.wfile.write(f"event: {item[0]}\ndata: {json.dumps(item[1])}\n\n".encode())
                    self.wfile.flush()
                except Exception:
                    pass
                return
            if item is None:
                return
            kind, data = item
            if time.time() > deadline and kind not in ("report", "error", "done"):
                item = ("error", {"message": "Research took too long for the server time limit. Try a shorter, more specific question."})
                try:
                    self.wfile.write(f"event: {item[0]}\ndata: {json.dumps(item[1])}\n\n".encode())
                    self.wfile.flush()
                except Exception:
                    pass
                return
            try:
                self.wfile.write(f"event: {kind}\ndata: {json.dumps(data)}\n\n".encode())
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                return
