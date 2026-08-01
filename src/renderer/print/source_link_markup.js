import {
  extractFirstSourceUrlFromAbc,
  formatSourceLinkLabel,
} from "../source_link.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function buildPrintSourceLinkMarkup(abcText, options = {}) {
  const url = extractFirstSourceUrlFromAbc(abcText);
  if (!url) return "";
  const includeQr = Boolean(options && options.includeQr);
  const createQrDataUrl = options && typeof options.createQrDataUrl === "function"
    ? options.createQrDataUrl
    : null;
  const qrDataUrl = includeQr && createQrDataUrl
    ? await createQrDataUrl(url, { size: 128 })
    : "";
  const label = formatSourceLinkLabel(url);
  const qrMarkup = qrDataUrl
    ? `<img src="${escapeHtml(qrDataUrl)}" alt="" style="width:64px;height:64px;display:block;flex:0 0 auto;">`
    : "";
  return `
    <div class="abcarus-print-source" style="display:flex;align-items:center;gap:10px;margin:10px 0 0;padding-top:8px;border-top:1px solid #ddd;font-family:sans-serif;font-size:11px;color:#444;break-inside:avoid;">
      ${qrMarkup}
      <div style="min-width:0;">
        <div style="font-weight:700;margin-bottom:2px;">Source</div>
        <a href="${escapeHtml(url)}" style="color:#1b5fb8;text-decoration:none;overflow-wrap:anywhere;">${escapeHtml(label)} — ${escapeHtml(url)}</a>
      </div>
    </div>
  `;
}

export {
  buildPrintSourceLinkMarkup,
};
