/* ── Word Cloud Visualizer ──────────────────────────────── */
/* Extracts key terms from report and renders an interactive  */
/* word cloud with hover highlights and click-to-search       */
import { esc } from "./utils.js";
const STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "is", "are", "was", "were", "be", "been", "being", "have", "has",
    "had", "do", "does", "did", "will", "would", "could", "should", "may", "might",
    "shall", "can", "that", "this", "these", "those", "it", "its", "not", "no",
    "than", "into", "about", "also", "such", "more", "most", "very", "just", "only",
    "some", "any", "all", "each", "every", "both", "few", "many", "much", "own",
    "other", "new", "old", "first", "last", "same", "well", "even", "still", "out",
    "up", "one", "two", "three", "our", "we", "they", "their", "them", "which",
    "what", "when", "where", "how", "who", "whom", "whose", "between", "through",
    "during", "before", "after", "above", "below", "while", "however", "although",
    "because", "since", "until", "over", "under", "here", "there", "then", "so",
]);
function extractWords(markdown) {
    const text = markdown
        .replace(/#+\s/g, "")
        .replace(/\[.*?\]\(.*?\)/g, "")
        .replace(/[*_`~]/g, "")
        .replace(/\d+/g, " ");
    const freq = new Map();
    for (const w of text.split(/\s+/)) {
        const lower = w.toLowerCase().replace(/[^a-z'-]/g, "");
        if (lower.length < 3 || STOP_WORDS.has(lower))
            continue;
        freq.set(lower, (freq.get(lower) || 0) + 1);
    }
    const sorted = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 60);
    if (!sorted.length)
        return [];
    const maxCount = sorted[0][1];
    const minCount = sorted[sorted.length - 1][1];
    const range = maxCount - minCount || 1;
    return sorted.map(([word, count]) => ({
        word,
        count,
        size: 0.6 + ((count - minCount) / range) * 2.4, // 0.6rem to 3rem
    }));
}
const CLOUD_COLORS = [
    "var(--accent)", "var(--accent2)", "var(--green)", "var(--amber)",
    "#6d9fff", "#a78bfa", "#f472b6", "#34d399",
];
export function renderWordCloud(d, container) {
    const words = extractWords(d.markdown);
    if (!words.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">☁</div>
      <div class="empty-title">No Keywords</div>
      <div class="empty-sub">Report too short for word cloud</div></div>`;
        return;
    }
    // Shuffle for visual variety
    for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
    }
    container.innerHTML = `
    <div class="wordcloud">
      <div class="wc-header">
        <h3>☁ Key Terms Word Cloud</h3>
        <span class="wc-count">${words.length} terms extracted</span>
      </div>
      <div class="wc-canvas" role="img" aria-label="Word cloud of key research terms">
        ${words.map((w, i) => {
        const color = CLOUD_COLORS[i % CLOUD_COLORS.length];
        const rotation = (Math.random() - 0.5) * 20;
        return `<span class="wc-word" style="
            font-size: ${w.size}rem;
            color: ${color};
            transform: rotate(${rotation}deg);
            opacity: ${0.6 + (w.size / 3) * 0.4};
          " data-word="${esc(w.word)}" data-count="${w.count}"
            title="${w.word} (${w.count} occurrences)">${esc(w.word)}</span>`;
    }).join("")}
      </div>
      <div class="wc-legend">Click a word to search · Size = frequency</div>
    </div>
  `;
    // Click to search
    container.querySelectorAll(".wc-word").forEach((el) => {
        el.addEventListener("click", () => {
            const q = document.getElementById("q");
            if (q) {
                q.value = el.dataset.word || "";
                q.focus();
            }
        });
        el.addEventListener("mouseenter", () => el.style.textShadow = `0 0 20px currentColor`);
        el.addEventListener("mouseleave", () => el.style.textShadow = "none");
    });
}
//# sourceMappingURL=wordcloud.js.map