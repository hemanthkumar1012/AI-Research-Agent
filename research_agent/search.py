"""Web search: Tavily when a key is set, otherwise free DuckDuckGo HTML search."""
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
    content: str = ""   # Tavily can return page text directly


class Searcher:
    def __init__(self, tavily_key: str = "", timeout: int = 20):
        self.tavily_key = tavily_key
        self.timeout = timeout

    def search(self, query: str, k: int = 4) -> list[SearchResult]:
        try:
            if self.tavily_key:
                return self._tavily(query, k)
            return self._duckduckgo(query, k)
        except requests.RequestException:
            return []

    def _tavily(self, query: str, k: int) -> list[SearchResult]:
        r = requests.post("https://api.tavily.com/search", timeout=self.timeout, json={
            "api_key": self.tavily_key, "query": query, "max_results": k,
            "include_raw_content": True,
        })
        r.raise_for_status()
        return [SearchResult(x.get("title", ""), x["url"], x.get("content", ""),
                             x.get("raw_content") or "")
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
