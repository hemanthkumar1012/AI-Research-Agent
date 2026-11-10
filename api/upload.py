"""File upload endpoint for Vercel Python runtime."""
import json
import os
import re
import sys
import uuid
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

UPLOADS = os.getenv("UPLOADS_DIR", "/tmp/uploads")
ALLOWED = (".pdf", ".txt", ".md", ".html", ".htm")
MAX_UPLOAD = 25 * 1024 * 1024


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        name = os.path.basename(self.headers.get("X-Filename", "")).strip()

        if not name.lower().endswith(ALLOWED):
            data = json.dumps({"error": f"Unsupported file type. Use {', '.join(ALLOWED)}"}).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""

        if not 0 < len(body) <= MAX_UPLOAD:
            data = json.dumps({"error": "File empty or larger than 25 MB"}).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        os.makedirs(UPLOADS, exist_ok=True)
        safe = re.sub(r"[^\w\-. ]", "_", name)[:100]
        token = f"{uuid.uuid4().hex}__{safe}"
        with open(os.path.join(UPLOADS, token), "wb") as f:
            f.write(body)

        data = json.dumps({"token": token, "name": safe}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
