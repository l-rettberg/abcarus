function normalizeSourceUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const protocol = String(url.protocol || "").toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function extractFirstSourceUrlFromAbc(abcText) {
  const text = String(abcText || "");
  const lines = text.split(/\r\n|\n|\r/);
  for (const line of lines) {
    const match = String(line || "").match(/^\s*F:\s*(.+?)\s*$/);
    if (!match) continue;
    const url = normalizeSourceUrl(match[1]);
    if (url) return url;
  }
  return "";
}

function parseYouTubeVideoId(url) {
  const normalized = normalizeSourceUrl(url);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const host = String(parsed.hostname || "").replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      return String(parsed.pathname || "").replace(/^\/+/, "").split(/[/?#]/)[0] || "";
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const watchId = String(parsed.searchParams.get("v") || "").trim();
      if (watchId) return watchId;
      const parts = String(parsed.pathname || "").split("/").filter(Boolean);
      if ((parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") && parts[1]) return parts[1];
    }
  } catch {}
  return "";
}

function getYouTubeEmbedUrl(url) {
  const id = parseYouTubeVideoId(url);
  if (!id) return "";
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
}

function buildYouTubeSearchUrlFromFields(fields = {}) {
  const parts = [];
  if (fields.title) parts.push(fields.title);
  if (fields.composer) parts.push(fields.composer);
  const query = parts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!query) return "";
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function formatSourceLinkLabel(url) {
  try {
    const parsed = new URL(String(url || ""));
    const host = String(parsed.hostname || "").replace(/^www\./i, "");
    if (/youtube\.com$/i.test(host) || /youtu\.be$/i.test(host)) return "YouTube";
    return host || "F:";
  } catch {
    return "F:";
  }
}

export {
  buildYouTubeSearchUrlFromFields,
  extractFirstSourceUrlFromAbc,
  formatSourceLinkLabel,
  getYouTubeEmbedUrl,
  normalizeSourceUrl,
  parseYouTubeVideoId,
};
