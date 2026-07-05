import {
  getBarLength,
  getDefaultLen,
  getMetre,
} from "./bar_metrics.js";

function parseMeterParts(abc) {
  const match = String(abc || "").match(/^M:\s*(\d+)\s*\/\s*(\d+)/m);
  if (!match) return null;
  const num = Number(match[1]);
  const den = Number(match[2]);
  if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) return null;
  return { num, den };
}

function formatMeterInfo(abc) {
  const parts = parseMeterParts(abc);
  if (!parts) return { text: "M: (unknown)", expectedWhole: null, expectedUnits: null };
  const expectedWhole = parts.num / parts.den;
  const beatsText = `${parts.num}×1/${parts.den}`;
  const compoundText = (parts.den === 8 && parts.num > 3 && parts.num % 3 === 0)
    ? `; compound: ${parts.num / 3}×3/8`
    : "";
  return {
    text: `M:${parts.num}/${parts.den} (beats: ${beatsText}${compoundText})`,
    expectedWhole,
  };
}

function shouldComputeMeasureStatsAt(editorText, anchorOffset) {
  const text = String(editorText || "");
  if (!text || !Number.isFinite(anchorOffset)) return false;
  const idx = Math.max(0, Math.min(Math.floor(anchorOffset), Math.max(0, text.length - 1)));
  const lineStart = Math.max(0, text.lastIndexOf("\n", idx - 1) + 1);
  const nextNl = text.indexOf("\n", idx);
  const lineEnd = nextNl >= 0 ? nextNl : text.length;
  const line = text.slice(lineStart, lineEnd);
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("%")) return false;
  if (/^[A-Za-z]:/.test(trimmed)) return false;
  if (/^\[[A-Za-z]:[^\]]*\]\s*$/.test(trimmed)) return false;
  return true;
}

function computeMeasureStatsAt(editorText, anchorOffset, {
  findMeasureRangeAt = null,
} = {}) {
  if (!editorText || !Number.isFinite(anchorOffset)) return null;
  if (typeof findMeasureRangeAt !== "function") return null;
  if (!shouldComputeMeasureStatsAt(editorText, anchorOffset)) return null;
  const range = findMeasureRangeAt(editorText, anchorOffset);
  if (!range) return null;
  const defaultLen = getDefaultLen(editorText);
  const metre = getMetre(editorText);
  const meterInfo = formatMeterInfo(editorText);
  const slice = editorText.slice(range.start, range.end);
  const actualWhole = getBarLength(slice, defaultLen, metre);
  const expectedWhole = meterInfo.expectedWhole;

  let actualUnits = null;
  let expectedUnits = null;
  if (defaultLen !== "mcm_default" && Number.isFinite(defaultLen) && defaultLen > 0) {
    actualUnits = Number.isFinite(actualWhole) ? actualWhole / defaultLen : null;
    expectedUnits = Number.isFinite(expectedWhole) ? expectedWhole / defaultLen : null;
  }

  return {
    meterInfo,
    defaultLen,
    range,
    actualWhole,
    expectedWhole,
    actualUnits,
    expectedUnits,
  };
}

export {
  computeMeasureStatsAt,
  parseMeterParts,
  shouldComputeMeasureStatsAt,
};
