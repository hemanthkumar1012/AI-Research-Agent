"""Tiny SQLite key-value cache so repeated runs don't re-pay for LLM calls or page fetches."""
import hashlib
import json
import os
import sqlite3
import threading
import time


class Cache:
    def __init__(self, path: str = ".cache/agent.sqlite", ttl: int = 7 * 24 * 3600):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.ttl = ttl
        self.lock = threading.Lock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, t REAL)")

    @staticmethod
    def key(*parts) -> str:
        return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()

    def get(self, k: str):
        with self.lock:
            row = self.db.execute("SELECT v, t FROM kv WHERE k=?", (k,)).fetchone()
        if row and time.time() - row[1] < self.ttl:
            return json.loads(row[0])
        return None

    def set(self, k: str, v) -> None:
        with self.lock:
            self.db.execute("REPLACE INTO kv VALUES (?,?,?)", (k, json.dumps(v), time.time()))
            self.db.commit()


class NullCache:
    def get(self, k):
        return None

    def set(self, k, v):
        pass

    key = staticmethod(Cache.key)
