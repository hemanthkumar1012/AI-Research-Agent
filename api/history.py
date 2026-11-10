"""History endpoint for Vercel Python runtime."""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from research_agent.store import ReportStore

_store = None

def get_store():
    global _store
    if _store is None:
        _store = ReportStore(os.getenv("REPORTS_DIR", "/tmp/reports"))
    return _store


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        data = json.dumps(get_store().list()).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
