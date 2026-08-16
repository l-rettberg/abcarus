import {
  formatSourceLinkLabel,
  normalizeSourceUrl,
  parseYouTubeVideoId,
} from "../source_link.js";
import {
  CHANNEL_PREFIX,
  LEGACY_CHANNEL_PREFIX,
  LEGACY_TITLE_PREFIX,
  TITLE_PREFIX,
} from "../tools/source_link/youtube_metadata_model.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function metadataValue(line, prefix) {
  const text = String(line || "");
  return text.startsWith(prefix) ? text.slice(prefix.length).trim() : "";
}

function collectPrintSources(abcText) {
  const lines = String(abcText || "").split(/\r\n|\n|\r/);
  const sources = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = String(lines[i] || "").match(/^\s*F:\s*(.+?)\s*$/);
    if (!match) continue;
    const url = normalizeSourceUrl(match[1]);
    if (!url) continue;
    let title = "";
    let channel = "";
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = String(lines[j] || "");
      if (line.startsWith(TITLE_PREFIX)) title = metadataValue(line, TITLE_PREFIX);
      else if (line.startsWith(CHANNEL_PREFIX)) channel = metadataValue(line, CHANNEL_PREFIX);
      else if (line.startsWith(LEGACY_TITLE_PREFIX)) {
        if (!title) title = metadataValue(line, LEGACY_TITLE_PREFIX);
      } else if (line.startsWith(LEGACY_CHANNEL_PREFIX)) {
        if (!channel) channel = metadataValue(line, LEGACY_CHANNEL_PREFIX);
      }
      else break;
    }
    const videoId = parseYouTubeVideoId(url);
    sources.push({ url, videoId, title, channel, isYouTube: Boolean(videoId) });
  }
  return sources;
}

function compactSourceLabel(source) {
  if (source && source.videoId) return `youtu.be/${source.videoId}`;
  try {
    const parsed = new URL(String(source && source.url ? source.url : ""));
    return `${String(parsed.hostname || "").replace(/^www\./i, "")}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return String(source && source.url ? source.url : "");
  }
}

async function buildPrintSourceLinkMarkup(abcText, options = {}) {
  const sources = collectPrintSources(abcText);
  if (!sources.length) return "";
  const includeQr = Boolean(options && options.includeQr);
  const createQrDataUrl = options && typeof options.createQrDataUrl === "function"
    ? options.createQrDataUrl
    : null;
  const rows = [];
  for (const source of sources) {
    const qrDataUrl = includeQr && createQrDataUrl
      ? await createQrDataUrl(source.url, { size: 112 })
      : "";
    const qrMarkup = qrDataUrl
      ? `<img src="${escapeHtml(qrDataUrl)}" alt="" style="width:52px;height:52px;display:block;flex:0 0 52px;">`
      : "";
    const service = source.isYouTube ? "YouTube" : formatSourceLinkLabel(source.url);
    const heading = source.title || service;
    const detail = source.channel ? `${service} / ${source.channel}` : service;
    rows.push(`
      <div style="display:flex;align-items:center;gap:9px;min-width:0;break-inside:avoid;">
        ${qrMarkup}
        <div style="min-width:0;line-height:1.25;">
          <div style="font-size:11px;font-weight:700;color:#222;overflow-wrap:anywhere;">${escapeHtml(heading)}</div>
          <div style="margin-top:1px;font-size:9.5px;color:#555;">${escapeHtml(detail)}</div>
          <a href="${escapeHtml(source.url)}" style="display:block;margin-top:2px;font-size:9px;color:#1b5fb8;text-decoration:none;overflow-wrap:anywhere;">${escapeHtml(compactSourceLabel(source))}</a>
        </div>
      </div>
    `);
  }
  return `
    <section class="abcarus-print-source" aria-label="Sources" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 16px;margin:7px 0 0;font-family:sans-serif;color:#444;break-inside:avoid;">
      ${rows.join("\n")}
    </section>
  `;
}

export {
  buildPrintSourceLinkMarkup,
  collectPrintSources,
  compactSourceLabel,
};
