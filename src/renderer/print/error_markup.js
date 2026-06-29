function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPrintTuneLabel(tune) {
  if (!tune) return "Untitled";
  const xPart = tune.xNumber ? `X:${tune.xNumber}` : "";
  const title = tune.title || tune.preview || "";
  return `${xPart} ${title}`.trim() || tune.id || "Untitled";
}

function buildPrintErrorCard(entry, tune, errors) {
  if (!errors || !errors.length) return "";
  const label = buildPrintTuneLabel(tune);
  const basename = entry && entry.basename ? entry.basename : "Tune";
  const seen = new Map();
  for (const err of errors) {
    const loc = err && err.loc ? `Line ${err.loc.line}, Col ${err.loc.col}` : "";
    const msg = err && err.message ? err.message : "Unknown error";
    const key = `${msg}|${loc}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const items = [];
  for (const [key, count] of seen.entries()) {
    const [msg, loc] = key.split("|");
    const locText = loc ? `<div class="print-error-loc">${escapeHtml(loc)}</div>` : "";
    const countText = count > 1 ? ` ×${count}` : "";
    items.push(`<li>${locText}<div class="print-error-msg">${escapeHtml(msg)}${countText}</div></li>`);
  }
  return `
    <div class="print-error-card">
      <div class="print-error-title">${escapeHtml(basename)} — ${escapeHtml(label)}</div>
      <ul class="print-error-list">
        ${items.join("")}
      </ul>
    </div>
  `;
}

function buildPrintErrorSummary(entry, items, totalTunes) {
  if (!items || !items.length) return "";
  const totalErrors = items.reduce((sum, item) => sum + item.count, 0);
  const list = items.map((item) => {
    const label = buildPrintTuneLabel(item.tune);
    const countText = item.count > 1 ? ` (${item.count})` : "";
    return `<li>${escapeHtml(label)}${countText}</li>`;
  }).join("");
  const basename = entry && entry.basename ? entry.basename : "Songbook";
  return `
    <div class="print-error-summary">
      <div class="print-error-title">${escapeHtml(basename)} — Print Summary</div>
      <div class="print-error-meta">Rendered ${totalTunes} tunes. ${items.length} tunes with issues (${totalErrors} errors).</div>
      <ul class="print-error-list">
        ${list}
      </ul>
    </div>
  `;
}

export {
  buildPrintErrorCard,
  buildPrintErrorSummary,
  buildPrintTuneLabel,
};
