function normalizeErrorOffsets(errItem, docLen) {
  if (!errItem || !Number.isFinite(docLen)) return null;
  const start = Number(errItem.errorStartOffset);
  const end = Number(errItem.errorEndOffset);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < 0 || start > docLen || end > docLen || end <= start) return null;
  return { start, end };
}

function suggestPlaybackRangeForRhythmErrorText(text, errItem, {
  findMeasureRangeAt,
  logError,
} = {}) {
  const src = String(text || "");
  const docLen = src.length;
  const offsets = normalizeErrorOffsets(errItem, docLen);
  if (!offsets || typeof findMeasureRangeAt !== "function") return null;
  const { start, end } = offsets;

  const coverageOk = (suggestedStart, suggestedEnd, method) => {
    const ok = suggestedStart <= start && suggestedEnd >= end && suggestedStart < suggestedEnd;
    if (!ok && typeof logError === "function") {
      logError("[abcarus] Rhythm error PlaybackRange coverage failed:", {
        method,
        errorStart: start,
        errorEnd: end,
        suggestedStart,
        suggestedEnd,
      });
    }
    return ok;
  };

  const base = findMeasureRangeAt(src, Math.max(0, Math.min(docLen - 1, start)));
  if (!base) {
    const pad = 240;
    const windowStart = Math.max(0, start - pad);
    const windowEnd = Math.min(docLen, end + pad);
    let suggestedStart = windowStart;
    let suggestedEnd = windowEnd;

    const startProbe = Math.max(windowStart, Math.min(docLen, start));
    const startSlice = src.slice(windowStart, Math.min(docLen, startProbe + 1));
    const barStartLocal = startSlice.lastIndexOf("|");
    if (barStartLocal !== -1) {
      suggestedStart = windowStart + barStartLocal;
    } else {
      const nlStartLocal = startSlice.lastIndexOf("\n");
      if (nlStartLocal !== -1) suggestedStart = windowStart + nlStartLocal;
    }

    const endProbe = Math.max(0, Math.min(docLen, end));
    const endSlice = src.slice(endProbe, windowEnd);
    const barEndLocal = endSlice.indexOf("|");
    if (barEndLocal !== -1) {
      suggestedEnd = Math.min(docLen, endProbe + barEndLocal);
    } else {
      const nlEndLocal = endSlice.indexOf("\n");
      if (nlEndLocal !== -1) suggestedEnd = Math.min(docLen, endProbe + nlEndLocal);
    }

    suggestedStart = Math.max(0, Math.min(suggestedStart, docLen));
    suggestedEnd = Math.max(0, Math.min(suggestedEnd, docLen));
    if (suggestedEnd <= suggestedStart) {
      suggestedStart = windowStart;
      suggestedEnd = windowEnd;
    }
    if (!coverageOk(suggestedStart, suggestedEnd, "fallback")) return null;
    return {
      startOffset: suggestedStart,
      endOffset: suggestedEnd,
      origin: "error",
      loop: true,
      suggestedMethod: "fallback",
    };
  }

  const prev = base.start > 0 ? findMeasureRangeAt(src, base.start - 1) : null;
  const next = base.end < docLen ? findMeasureRangeAt(src, base.end + 1) : null;
  const startOffset = Math.min(prev ? prev.start : base.start, base.start);
  const endOffset = Math.max(next ? next.end : base.end, base.end);
  if (!coverageOk(startOffset, endOffset, "measure")) return null;
  return {
    startOffset,
    endOffset,
    origin: "error",
    loop: true,
    suggestedMethod: "measure",
  };
}

function buildRhythmErrorSuggestionSnapshot(errItem, suggested, now = new Date()) {
  if (!suggested) return null;
  return {
    at: now.toISOString(),
    tuneId: errItem && errItem.tuneId ? errItem.tuneId : null,
    filePath: errItem && errItem.filePath ? errItem.filePath : null,
    message: errItem && errItem.message ? errItem.message : null,
    errorStartOffset: errItem && Number.isFinite(errItem.errorStartOffset) ? errItem.errorStartOffset : null,
    errorEndOffset: errItem && Number.isFinite(errItem.errorEndOffset) ? errItem.errorEndOffset : null,
    startOffset: suggested.startOffset,
    endOffset: suggested.endOffset,
    origin: "error",
    loop: true,
    suggestedMethod: suggested.suggestedMethod || null,
  };
}

export {
  buildRhythmErrorSuggestionSnapshot,
  suggestPlaybackRangeForRhythmErrorText,
};
