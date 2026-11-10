/* ── Markdown renderer with fallback ──────────────────── */

import { esc } from "./utils.js";

declare const marked: { parse(src: string): string } | undefined;

/** Minimal markdown → HTML (fallback when marked.js CDN fails) */
function miniMd(src: string): string {
  const out: string[] = [];
  let inList = false;

  const inline = (t: string): string => {
    const links: string[] = [];
    t = t.replace(
      /\[([^\]]+)\]\((https?:[^)\s]+|file:[^)\s]+)\)/g,
      (_, txt: string, url: string) => {
        links.push(`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(txt)}</a>`);
        return `\u0000${links.length - 1}\u0000`;
      }
    );
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.+?)\*/g, "<i>$1</i>")
      .replace(/(^|\s)_(.+?)_(?=\s|$)/g, "$1<i>$2</i>")
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\u0000(\d+)\u0000/g, (_, i) => links[+i]);
  };

  for (const line of (src || "").split("\n")) {
    const heading = line.match(/^(#{1,4})\s+(.*)/);
    const listItem = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);

    if (!listItem && inList) {
      out.push("</ul>");
      inList = false;
    }
    if (heading) {
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
    } else if (listItem) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(listItem[1])}</li>`);
    } else if (line.trim()) {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

/** Render markdown to HTML, using marked.js if available */
export function renderMarkdown(src: string): string {
  const div = document.createElement("div");
  div.innerHTML =
    typeof marked !== "undefined" ? marked.parse(src || "") : miniMd(src);
  div.querySelectorAll("a").forEach((a) => {
    a.target = "_blank";
    a.rel = "noopener";
  });
  return div.innerHTML;
}
