"""Follow-up question endpoint for Vercel Python runtime."""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from research_agent.agent import Report, build_agent
from research_agent.config import Config
from research_agent.store import ReportStore

_store = None

def get_store():
    global _store
    if _store is None:
        _store = ReportStore(os.getenv("REPORTS_DIR", "/tmp/reports"))
    return _store


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b"{}"
            req = json.loads(body)
            if isinstance(req.get("report"), dict):
                report = Report.from_dict(req["report"])
            else:
                report = Report.from_dict(get_store().load(req["id"]))
            cfg = Config.from_env()
            cfg.llm_timeout = 25
            cfg.llm_retries = 2
            agent = build_agent(cfg, None)
            result = agent.ask(report, req["question"], req.get("history", []))
            data = json.dumps(result).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except KeyError:
            data = json.dumps({"error": "unknown report or missing field"}).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            data = json.dumps({"error": str(e)}).encode()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
