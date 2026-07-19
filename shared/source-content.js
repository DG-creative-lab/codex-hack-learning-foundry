export const SOURCE_CONTENT_LIMITS = Object.freeze({
  maxBytes: 12 * 1024 * 1024,
  maxUnits: 64,
  maxUnitCharacters: 1600,
  minWebUnitCharacters: 24
});

export const SOURCE_HTML_RULES = Object.freeze({
  contentSelector: "h1, h2, h3, p, li, blockquote",
  removeSelector: "script, style, noscript, nav, footer, form",
  rootSelector: "article, main"
});

export function normalizeSourceText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function chunksOf(text) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > SOURCE_CONTENT_LIMITS.maxUnitCharacters) {
    const window = remaining.slice(0, SOURCE_CONTENT_LIMITS.maxUnitCharacters + 1);
    const lastSpace = window.lastIndexOf(" ");
    const splitAt =
      lastSpace >= SOURCE_CONTENT_LIMITS.maxUnitCharacters / 2 ? lastSpace : SOURCE_CONTENT_LIMITS.maxUnitCharacters;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function normalizeSourceUnits(units, minimumCharacters = 1) {
  const normalized = [];
  for (const unit of units) {
    const content = normalizeSourceText(unit.content);
    if (content.length < minimumCharacters) continue;
    const chunks = chunksOf(content);
    for (const [index, chunk] of chunks.entries()) {
      normalized.push({
        content: chunk,
        location:
          chunks.length === 1
            ? unit.location
            : { ...unit.location, label: `${unit.location.label} · part ${index + 1}` }
      });
      if (normalized.length === SOURCE_CONTENT_LIMITS.maxUnits) return normalized;
    }
  }
  return normalized;
}

export function createWebSourceDocument({ url, title, author, fingerprint, units }) {
  const parsedUrl = new URL(url);
  return {
    title: normalizeSourceText(title) || parsedUrl.hostname,
    author: normalizeSourceText(author) || parsedUrl.hostname,
    format: "Web page",
    fingerprint,
    units: normalizeSourceUnits(units, SOURCE_CONTENT_LIMITS.minWebUnitCharacters)
  };
}
