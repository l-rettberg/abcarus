function normalizeErrorMessageForMatch(message) {
  const msg = String(message || "").trim();
  if (!msg) return "";
  const withoutCount = msg.replace(/\s+×\s*\d+\s*$/i, "").trim();
  // abc2svg errors often include location prefixes; match on the human-relevant tail.
  const lower = withoutCount.toLowerCase();
  const idxWarn = lower.lastIndexOf("warning:");
  if (idxWarn !== -1) return withoutCount.slice(idxWarn + "warning:".length).trim().toLowerCase();
  const idxErr = lower.lastIndexOf("error:");
  if (idxErr !== -1) return withoutCount.slice(idxErr + "error:".length).trim().toLowerCase();
  return lower;
}

function computeErrorId(entry) {
  if (!entry) return "";
  const tuneId = entry.tuneId || "";
  const filePath = entry.filePath || "";
  const messageKey = normalizeErrorMessageForMatch(entry.message || "");
  const start = Number(entry.errorStartOffset);
  const line = Number(entry.loc ? entry.loc.line : NaN);
  const col = Number(entry.loc ? entry.loc.col : NaN);
  const posKey = Number.isFinite(start)
    ? `o${start}`
    : (Number.isFinite(line) ? `l${line}c${Number.isFinite(col) ? col : 0}` : "na");
  // Unique enough to distinguish multiple same-message errors in the same tune,
  // while still allowing reconcileActiveErrorHighlightAfterRender() to re-anchor by message.
  return `${tuneId}|${filePath}|${messageKey}|${posKey}`;
}

function buildSortedErrorsForNav(errors) {
  const items = Array.isArray(errors) ? errors.slice() : [];
  const withKeys = items.map((entry) => {
    const tuneIdKey = String(entry && (entry.tuneId || entry.tuneKey) ? (entry.tuneId || entry.tuneKey) : "");
    const start = Number(entry && entry.errorStartOffset);
    const line = Number(entry && entry.loc ? entry.loc.line : NaN);
    const col = Number(entry && entry.loc ? entry.loc.col : NaN);
    const messageKey = normalizeErrorMessageForMatch(entry && entry.message ? entry.message : "");
    const pos = Number.isFinite(start)
      ? start
      : (Number.isFinite(line) ? (line * 100000 + (Number.isFinite(col) ? col : 0)) : Number.POSITIVE_INFINITY);
    return {
      entry,
      id: computeErrorId(entry),
      tuneIdKey,
      pos,
      messageKey,
    };
  }).filter((x) => x.entry && x.id);

  withKeys.sort((a, b) => {
    if (a.tuneIdKey !== b.tuneIdKey) return a.tuneIdKey.localeCompare(b.tuneIdKey);
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.messageKey !== b.messageKey) return a.messageKey.localeCompare(b.messageKey);
    return a.id.localeCompare(b.id);
  });
  return withKeys;
}

function normalizeErrors(entries) {
  const out = [];
  const list = Array.isArray(entries) ? entries : [];
  for (const entry of list) {
    if (!entry) continue;
    const count = entry.count && entry.count > 1 ? entry.count : 1;
    const msg = entry.message ? String(entry.message) : "Unknown error";
    const message = count > 1 ? `${msg} ×${count}` : msg;
    const tuneKey = entry.tuneId || entry.xNumber || "";
    const tuneTitle = entry.tuneLabel || entry.title || "Untitled";
    const loc = entry.loc ? { line: entry.loc.line, col: entry.loc.col } : null;
    const measureRange = entry.measureRange && Number.isFinite(entry.measureRange.start) && Number.isFinite(entry.measureRange.end)
      ? { start: entry.measureRange.start, end: entry.measureRange.end }
      : null;
    const errorStartOffset = Number.isFinite(entry.errorStartOffset)
      ? Number(entry.errorStartOffset)
      : (measureRange ? measureRange.start : null);
    const errorEndOffset = Number.isFinite(entry.errorEndOffset)
      ? Number(entry.errorEndOffset)
      : (measureRange ? measureRange.end : null);
    out.push({
      tuneKey,
      tuneId: entry.tuneId || null,
      filePath: entry.filePath || null,
      tuneTitle,
      message,
      source: entry.source ? String(entry.source) : "abc2svg",
      loc,
      measureRange,
      errorStartOffset,
      errorEndOffset,
    });
  }
  return out;
}

function getErrorGroupKey(entry) {
  if (entry && entry.tuneId) return entry.tuneId;
  if (entry && entry.filePath) return entry.filePath;
  return "general";
}

function getErrorGroupLabel(entry, { safeBasename } = {}) {
  if (!entry) return "General";
  const basename = entry.fileBasename || (entry.filePath && typeof safeBasename === "function" ? safeBasename(entry.filePath) : "");
  const tuneLabel = entry.tuneLabel || "";
  if (basename && tuneLabel) return `${basename} — ${tuneLabel}`;
  if (basename) return basename;
  if (tuneLabel) return tuneLabel;
  return "General";
}

function buildErrorEntryKey(entry) {
  if (!entry) return "";
  const line = entry.loc ? entry.loc.line : "";
  const col = entry.loc ? entry.loc.col : "";
  return `${getErrorGroupKey(entry)}|${entry.message}|${line}|${col}`;
}

export {
  buildSortedErrorsForNav,
  buildErrorEntryKey,
  computeErrorId,
  getErrorGroupKey,
  getErrorGroupLabel,
  normalizeErrors,
  normalizeErrorMessageForMatch,
};
