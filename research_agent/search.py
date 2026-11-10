"""Multi-provider search.

- web:          Tavily when a key is set, otherwise free DuckDuckGo HTML search
- academic:     arXiv API (abstracts) + web
- encyclopedic: Wikipedia (plain-text extracts) + web
"""
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from urllib.parse import parse_qs, unquote, urlparse

import requests
from bs4 import BeautifulSoup

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str = ""
    content: str = ""   # Tavily / arXiv / Wikipedia return text directly
    pdf_url: str = ""   # full text to try first (e.g. arXiv papers)
    date: str = ""      # YYYY-MM-DD when the provider knows it


class Searcher:
    def __init__(self, tavily_key: str = "", timeout: int = 20):
        self.tavily_key = tavily_key
        self.timeout = timeout

    def search(self, query: str, k: int = 4, kind: str = "web") -> list[SearchResult]:
        special = {"academic": self._arxiv, "encyclopedic": self._wikipedia}.get(kind)
        out: list[SearchResult] = []
        if special:
            out += self._safe(special, query, max(1, k // 2 + 1))
        out += self._safe(self._web, query, k - len(out) if special else k)
        return out[:k]

    @staticmethod
    def _safe(fn, query, k):
        if k <= 0:
            return []
        try:
            return fn(query, k)
        except (requests.RequestException, ET.ParseError, ValueError, KeyError):
            return []

    def _web(self, query: str, k: int) -> list[SearchResult]:
        return self._tavily(query, k) if self.tavily_key else self._duckduckgo(query, k)

    def _arxiv(self, query: str, k: int) -> list[SearchResult]:
        r = requests.get("https://export.arxiv.org/api/query", timeout=self.timeout, headers=UA,
                         params={"search_query": f"all:{query}", "max_results": k,
                                 "sortBy": "relevance"})
        r.raise_for_status()
        return parse_arxiv(r.text)

    def _wikipedia(self, query: str, k: int) -> list[SearchResult]:
        r = requests.get("https://en.wikipedia.org/w/api.php", timeout=self.timeout, headers=UA,
                         params={"action": "query", "format": "json", "generator": "search",
                                 "gsrsearch": query, "gsrlimit": k, "prop": "extracts|info",
                                 "inprop": "url", "explaintext": 1, "exlimit": k})
        r.raise_for_status()
        pages = sorted(r.json().get("query", {}).get("pages", {}).values(),
                       key=lambda p: p.get("index", 0))
        return [SearchResult(p["title"] + " – Wikipedia", p["fullurl"], "", p.get("extract", ""))
                for p in pages if p.get("extract")]

    def _tavily(self, query: str, k: int) -> list[SearchResult]:
        r = requests.post("https://api.tavily.com/search", timeout=self.timeout, json={
            "api_key": self.tavily_key, "query": query, "max_results": k,
            "include_raw_content": True,
        })
        r.raise_for_status()
        return [SearchResult(x.get("title", ""), x["url"], x.get("content", ""),
                             x.get("raw_content") or "", date=(x.get("published_date") or "")[:10])
                for x in r.json().get("results", [])]

    def _duckduckgo(self, query: str, k: int) -> list[SearchResult]:
        r = requests.post("https://html.duckduckgo.com/html/", data={"q": query},
                          headers=UA, timeout=self.timeout)
        r.raise_for_status()
        return parse_ddg_html(r.text)[:k]


def parse_ddg_html(html: str) -> list[SearchResult]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for res in soup.select("div.result"):
        a = res.select_one("a.result__a")
        if not a or not a.get("href"):
            continue
        url = a["href"]
        if "duckduckgo.com/l/" in url:  # unwrap redirect links
            url = unquote(parse_qs(urlparse(url).query).get("uddg", [url])[0])
        if "duckduckgo.com/y.js" in url:  # ads
            continue
        snip = res.select_one(".result__snippet")
        out.append(SearchResult(a.get_text(" ", strip=True), url,
                                snip.get_text(" ", strip=True) if snip else ""))
    return out


def parse_arxiv(xml: str) -> list[SearchResult]:
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    for e in ET.fromstring(xml).findall("a:entry", ns):
        title = " ".join((e.findtext("a:title", "", ns) or "").split())
        summary = " ".join((e.findtext("a:summary", "", ns) or "").split())
        url = (e.findtext("a:id", "", ns) or "").replace("http://", "https://")
        year = (e.findtext("a:published", "", ns) or "")[:4]
        authors = ", ".join(a.findtext("a:name", "", ns) for a in e.findall("a:author", ns)[:3])
        content = f"{title} ({authors}, {year}). Abstract: {summary}"
        pdf = next((ln.get("href") for ln in e.findall("a:link", ns)
                    if ln.get("title") == "pdf" or ln.get("type") == "application/pdf"), "")
        if not pdf and "/abs/" in url:
            pdf = url.replace("/abs/", "/pdf/")
        out.append(SearchResult(f"{title} (arXiv {year})", url, summary[:200], content,
                                pdf.replace("http://", "https://"),
                                (e.findtext("a:published", "", ns) or "")[:10]))
    return out
