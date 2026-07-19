import {
  normalizeSuggestedKeyName,
  parseAbcHeaderFields,
} from "../abc/header_fields.js";

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

function buildSuggestedTuneBaseName({
  editorText = "",
  activeTuneMeta = null,
  includeKey = false,
} = {}) {
  const parsed = parseAbcHeaderFields(editorText);
  const title = parsed.title || (activeTuneMeta && activeTuneMeta.title) || "untitled";
  const composerCandidate = parsed.composer || (activeTuneMeta && activeTuneMeta.composer) || "";
  const composer = String(composerCandidate || "").trim();
  const key = normalizeSuggestedKeyName(parsed.key || (activeTuneMeta && activeTuneMeta.key) || "");
  const parts = [title];
  if (composer) parts.push(composer);
  if (includeKey && key) parts.push(key);
  return sanitizeFileBaseName(parts.join(" - "));
}

function buildSongbookSuggestedBaseName({
  activeFilePath = "",
  fallbackBaseName = "songbook",
  safeBasename = (filePath) => String(filePath || ""),
} = {}) {
  if (activeFilePath) {
    const raw = safeBasename(activeFilePath).replace(/\.abc$/i, "");
    return sanitizeFileBaseName(raw || "songbook");
  }
  return sanitizeFileBaseName(fallbackBaseName || "songbook");
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
  buildSongbookSuggestedBaseName,
  buildSuggestedTuneBaseName,
  ensureOnePerPageDirective,
  sanitizeFileBaseName,
};
