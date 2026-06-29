function sanitizeFileBaseName(text) {
  const cleaned = String(text || "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, " ")
    .replace(/\p{Control}+/gu, " ")
    .replace(/[. ]+$/g, "")
    .replace(/^[. ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "untitled";
  return cleaned.slice(0, 120);
}

function applyPrintDebugMarkup(markup, { noRaster = false } = {}) {
  if (!markup) return markup;
  if (noRaster) {
    return `${markup}\n<!--abcarus:no-raster-->`;
  }
  return markup;
}

function ensureOnePerPageDirective(text) {
  const value = String(text || "");
  if (/^%%\s*oneperpage\b/im.test(value)) return value;
  const prefix = "%%oneperpage 1\n";
  if (!value.trim()) return prefix;
  if (value.startsWith("\ufeff")) {
    return `\ufeff${prefix}${value.slice(1)}`;
  }
  return `${prefix}${value}`;
}

export {
  applyPrintDebugMarkup,
  ensureOnePerPageDirective,
  sanitizeFileBaseName,
};
