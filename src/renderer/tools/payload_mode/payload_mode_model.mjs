function computePayloadTuneOffset(text) {
  const src = String(text || "");
  const m = src.match(/^[\t ]*X:/m);
  if (!m || !Number.isFinite(m.index)) return 0;
  return Math.max(0, Number(m.index) || 0);
}

function findLineNumberAtOffset(text, offset) {
  const src = String(text || "");
  const idx = Math.max(0, Math.min(src.length, Number(offset) || 0));
  return src.slice(0, idx).split(/\r\n|\n|\r/).length;
}

function buildPlaybackPayloadForDiagnosticsFromRenderText(renderText, renderOffset, {
  injectGchordOn = null,
  normalizeDollarLineBreaksForPlayback = (text) => text,
  normalizeBlankLinesForPlayback = (text) => text,
  sanitizeAbcForPlayback = (text) => ({ text, warnings: [] }),
  expandRepeatsForPlayback = (text) => text,
  expandRepeats = false,
} = {}) {
  const baseText = String(renderText || "");
  const baseOffset = Number.isFinite(renderOffset) ? Number(renderOffset) : 0;
  const spans = [];

  const addLineSpan = (lineNo, className) => {
    if (!lineNo || !Number.isFinite(lineNo)) return;
    spans.push({ fromLine: lineNo, toLine: lineNo, className });
  };
  const addRangeSpan = (fromLine, toLine, className) => {
    const a = Number(fromLine);
    const b = Number(toLine);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    spans.push({ fromLine: Math.min(a, b), toLine: Math.max(a, b), className });
  };

  let payload = { text: baseText, offset: baseOffset };

  const gchordInjected = typeof injectGchordOn === "function"
    ? injectGchordOn(payload.text, payload.offset || 0)
    : null;
  if (gchordInjected && gchordInjected.changed) {
    payload = { text: gchordInjected.text, offset: (payload.offset || 0) + (gchordInjected.offsetDelta || 0) };
    const lineNo = findLineNumberAtOffset(payload.text, Math.max(0, (payload.offset || 0) - (gchordInjected.offsetDelta || 0)));
    addLineSpan(lineNo, "cm-payload-layer-playback");
  }

  payload = { text: normalizeDollarLineBreaksForPlayback(payload.text), offset: payload.offset };
  payload = { text: normalizeBlankLinesForPlayback(payload.text), offset: payload.offset };
  const sanitized = sanitizeAbcForPlayback(payload.text);
  payload = { text: sanitized.text, offset: payload.offset };
  const warnings = Array.isArray(sanitized.warnings) ? sanitized.warnings : [];
  for (const w of warnings) {
    if (!w || !w.line) continue;
    addLineSpan(Number(w.line), "cm-payload-layer-playback");
  }

  if (expandRepeats) {
    payload = { text: expandRepeatsForPlayback(payload.text), offset: payload.offset };
  }

  if (!spans.some((s) => s && s.className === "cm-payload-layer-playback")) {
    const lines = String(payload.text || "").split(/\r\n|\n|\r/);
    let drumStart = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^\s*V:\s*DRUM\b/i.test(lines[i])) {
        drumStart = i + 1;
        break;
      }
    }
    if (drumStart > 0) {
      let drumEnd = lines.length;
      for (let i = drumStart; i < lines.length; i += 1) {
        if (/^\s*V:\s*\w+/i.test(lines[i]) && !/^\s*V:\s*DRUM\b/i.test(lines[i])) {
          drumEnd = i;
          break;
        }
      }
      addRangeSpan(drumStart, drumEnd, "cm-payload-layer-playback");
    }
  }

  return { text: payload.text, offset: payload.offset || 0, spans };
}

export {
  buildPlaybackPayloadForDiagnosticsFromRenderText,
  computePayloadTuneOffset,
  findLineNumberAtOffset,
};
