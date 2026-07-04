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

function getTextIndexFromLoc(text, loc) {
  if (!text || !loc || !Number.isFinite(loc.line)) return null;
  const lineTarget = Math.max(1, Number(loc.line));
  const colTarget = Math.max(1, Number.isFinite(loc.col) ? Number(loc.col) : 1);
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < text.length && line < lineTarget; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  if (line !== lineTarget) return null;
  let lineEnd = text.indexOf("\n", lineStart);
  if (lineEnd === -1) lineEnd = text.length;
  return Math.max(lineStart, Math.min(lineEnd, lineStart + colTarget - 1));
}

function getLineRangeAt(text, idx) {
  if (!text || !Number.isFinite(idx)) return null;
  const pos = Math.max(0, Math.min(text.length, Number(idx)));
  const before = text.lastIndexOf("\n", Math.max(0, pos - 1));
  const after = text.indexOf("\n", pos);
  return {
    start: before === -1 ? 0 : before + 1,
    end: after === -1 ? text.length : after,
  };
}

function buildMissingDefinitionSourceTokens(message) {
  const match = String(message || "").match(/\bno\s+definition\s+of\s+([A-Za-z][A-Za-z0-9_]*)/i);
  if (!match) return [];
  const name = match[1];
  const accMatch = name.match(/^acc(\d+)(?:_\d+)?$/i);
  if (!accMatch) return [];
  const value = accMatch[1];
  return [`^${value}`, `_${value}`, `=${value}`];
}

function extendAbcAccidentalRange(text, start, token) {
  let end = start + token.length;
  if (/[A-Ga-g]/.test(text.charAt(end))) {
    end += 1;
    while (end < text.length && /[',]/.test(text.charAt(end))) end += 1;
    while (end < text.length && /[0-9/]/.test(text.charAt(end))) end += 1;
  }
  return { start, end };
}

function findClosestTokenRange(text, tokens, range, anchor) {
  if (!text || !tokens.length || !range) return null;
  const from = Math.max(0, Math.min(text.length, range.start));
  const to = Math.max(from, Math.min(text.length, range.end));
  const anchorPos = Number.isFinite(anchor) ? Math.max(from, Math.min(to, anchor)) : from;
  let best = null;
  let bestDist = Infinity;
  for (const token of tokens) {
    let idx = text.indexOf(token, from);
    while (idx !== -1 && idx < to) {
      const candidate = extendAbcAccidentalRange(text, idx, token);
      const dist = Math.abs(idx - anchorPos);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
      idx = text.indexOf(token, idx + token.length);
    }
  }
  return best;
}

function findErrorSourceRangeForMessage(text, message, loc) {
  const sourceText = String(text || "");
  if (!sourceText) return null;
  const tokens = buildMissingDefinitionSourceTokens(message);
  if (!tokens.length) return null;

  const anchor = getTextIndexFromLoc(sourceText, loc);
  if (Number.isFinite(anchor)) {
    const lineRange = getLineRangeAt(sourceText, anchor);
    const lineHit = findClosestTokenRange(sourceText, tokens, lineRange, anchor);
    if (lineHit) return lineHit;

    const windowHit = findClosestTokenRange(sourceText, tokens, {
      start: Math.max(0, anchor - 800),
      end: Math.min(sourceText.length, anchor + 800),
    }, anchor);
    if (windowHit) return windowHit;
  }

  return findClosestTokenRange(sourceText, tokens, {
    start: 0,
    end: sourceText.length,
  }, 0);
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
  findErrorSourceRangeForMessage,
  getErrorGroupKey,
  getErrorGroupLabel,
  normalizeErrors,
  normalizeErrorMessageForMatch,
};
