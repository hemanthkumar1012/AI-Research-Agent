/* ── Internationalization Framework ─────────────────────── */
/* Simple i18n with language detection, localStorage persist  */

type Lang = "en" | "es" | "fr" | "de" | "ja" | "zh" | "hi" | "te";

interface Translations {
  [key: string]: string;
}

const TRANSLATIONS: Record<Lang, Translations> = {
  en: {
    "app.title": "AI Research Agent",
    "app.subtitle": "Multi-source verified research · Citation graphs · Claim verification",
    "search.placeholder": "Ask a research question…",
    "search.button": "Research",
    "search.depth.standard": "Standard",
    "search.depth.deep": "🔬 Deep",
    "search.depth.deeper": "🏔 Deeper",
    "search.attach": "📎 Attach files",
    "search.hint": "(or drag & drop)",
    "history.title": "Research History",
    "history.empty": "No past research yet",
    "trace.title": "Research Trace",
    "trace.waiting": "Waiting for a query…",
    "tab.report": "📄 Report",
    "tab.graph": "🕸 Graph",
    "tab.inspector": "🔍 Inspector",
    "tab.timeline": "⏱ Timeline",
    "tab.analytics": "📊 Analytics",
    "tab.heatmap": "🗺 Heatmap",
    "tab.confidence": "🎯 Confidence",
    "tab.wordcloud": "☁ Words",
    "empty.report.title": "Ready to Research",
    "empty.report.sub": "Enter a question above to generate a verified research report",
    "chat.title": "💬 Follow-up Questions",
    "chat.placeholder": "Ask a follow-up…",
    "chat.button": "Ask",
    "export.md": "⬇ Markdown",
    "export.json": "📦 JSON",
    "export.html": "🌐 HTML",
    "toast.researching": "Researching",
    "toast.complete": "Research complete!",
    "toast.error": "Research failed",
    "toast.copied": "Copied to clipboard!",
    "toast.noReport": "No report to export",
  },
  es: {
    "app.title": "Agente de Investigación IA",
    "app.subtitle": "Investigación verificada · Grafos de citación · Verificación de afirmaciones",
    "search.placeholder": "Haz una pregunta de investigación…",
    "search.button": "Investigar",
    "history.title": "Historial",
    "history.empty": "Sin investigaciones previas",
    "toast.complete": "¡Investigación completa!",
    "toast.copied": "¡Copiado al portapapeles!",
    "empty.report.title": "Listo para Investigar",
    "empty.report.sub": "Ingresa una pregunta para generar un informe verificado",
  },
  fr: {
    "app.title": "Agent de Recherche IA",
    "search.placeholder": "Posez une question de recherche…",
    "search.button": "Rechercher",
    "history.title": "Historique",
    "toast.complete": "Recherche terminée !",
    "empty.report.title": "Prêt à Rechercher",
  },
  de: {
    "app.title": "KI-Forschungsagent",
    "search.placeholder": "Stellen Sie eine Forschungsfrage…",
    "search.button": "Forschen",
    "toast.complete": "Forschung abgeschlossen!",
    "empty.report.title": "Bereit zur Forschung",
  },
  ja: {
    "app.title": "AI研究エージェント",
    "search.placeholder": "研究の質問を入力…",
    "search.button": "研究",
    "toast.complete": "研究完了！",
    "empty.report.title": "研究準備完了",
  },
  zh: {
    "app.title": "AI研究代理",
    "search.placeholder": "输入研究问题…",
    "search.button": "研究",
    "toast.complete": "研究完成！",
    "empty.report.title": "准备就绪",
  },
  hi: {
    "app.title": "AI अनुसंधान एजेंट",
    "search.placeholder": "एक शोध प्रश्न पूछें…",
    "search.button": "शोध करें",
    "toast.complete": "शोध पूरा!",
  },
  te: {
    "app.title": "AI పరిశోధన ఏజెంట్",
    "search.placeholder": "పరిశోధన ప్రశ్న అడగండి…",
    "search.button": "పరిశోధన",
    "toast.complete": "పరిశోధన పూర్తయింది!",
  },
};

let currentLang: Lang = "en";

export function initI18n(): void {
  // Detect from localStorage, then browser
  const stored = localStorage.getItem("ra-lang") as Lang | null;
  if (stored && stored in TRANSLATIONS) {
    currentLang = stored;
  } else {
    const browserLang = navigator.language.split("-")[0] as Lang;
    if (browserLang in TRANSLATIONS) currentLang = browserLang;
  }
}

export function t(key: string): string {
  return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS.en[key] || key;
}

export function setLang(lang: Lang): void {
  currentLang = lang;
  localStorage.setItem("ra-lang", lang);
}

export function getLang(): Lang { return currentLang; }

export function getAvailableLangs(): { code: Lang; name: string }[] {
  return [
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
    { code: "ja", name: "日本語" },
    { code: "zh", name: "中文" },
    { code: "hi", name: "हिन्दी" },
    { code: "te", name: "తెలుగు" },
  ];
}
