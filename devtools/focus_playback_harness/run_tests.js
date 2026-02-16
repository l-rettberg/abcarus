#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname);
const FIXTURE = path.join(ROOT, "fixtures", "bouchard_x16_issue21.abc");
const ABC2SVG_PATH = path.resolve(ROOT, "../../third_party/abc2svg/abc2svg-1.js");

function fail(message) {
  throw new Error(String(message || "Test failed"));
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

let abcCtorCache = null;
function getAbcCtor() {
  if (abcCtorCache) return abcCtorCache;
  const source = fs.readFileSync(ABC2SVG_PATH, "utf8");
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "abc2svg-1.js" });
  if (!sandbox.abc2svg || typeof sandbox.abc2svg.Abc !== "function") {
    fail("abc2svg constructor is unavailable");
  }
  abcCtorCache = sandbox.abc2svg.Abc;
  return abcCtorCache;
}

function parseTuneWithAbc2svg(tuneText) {
  const AbcCtor = getAbcCtor();
  const user = { img_out: () => {}, err: () => {}, errmsg: () => {} };
  const abc = new AbcCtor(user);
  abc.tosvg("focus-harness", String(tuneText || ""));
  const tunes = abc.tunes || [];
  const first = tunes && tunes[0] ? tunes[0][0] : null;
  if (!first) fail("abc2svg produced no parsed tune symbols");
  return first;
}

function buildMeasureIstartsFromAbc2svg(firstSymbol) {
  const istarts = [];
  const pushUnique = (v) => {
    if (!Number.isFinite(v)) return;
    if (!istarts.length || istarts[istarts.length - 1] !== v) istarts.push(v);
  };
  const isBarLikeSymbol = (symbol) => !!(symbol && (symbol.bar_type || symbol.type === 14));
  let s = firstSymbol;
  let guard = 0;
  if (s && Number.isFinite(s.istart)) pushUnique(s.istart);
  while (s && guard < 200000) {
    if (isBarLikeSymbol(s) && s.ts_next && Number.isFinite(s.ts_next.istart)) {
      pushUnique(s.ts_next.istart);
    }
    s = s.ts_next;
    guard += 1;
  }
  const out = [];
  let last = null;
  for (const v of istarts.slice().sort((a, b) => a - b)) {
    if (!Number.isFinite(v)) continue;
    if (last == null || v !== last) out.push(v);
    last = v;
  }
  return out;
}

function buildMeasureStartsByNumberFromAbc2svg(firstSymbol) {
  const byNumber = new Map();
  const push = (targetMap, n, istart) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return;
    const start = Number(istart);
    if (!Number.isFinite(start)) return;
    const list = targetMap.get(num) || [];
    if (!list.length || list[list.length - 1] !== start) list.push(start);
    targetMap.set(num, list);
  };
  const normalizeMap = (targetMap) => {
    for (const [k, list] of targetMap.entries()) {
      const out = [];
      let last = null;
      for (const v of list.slice().sort((a, b) => a - b)) {
        if (!Number.isFinite(v)) continue;
        if (last == null || v !== last) out.push(v);
        last = v;
      }
      targetMap.set(k, out);
    }
  };
  const normalizeList = (list) => {
    const out = [];
    let last = null;
    for (const v of (Array.isArray(list) ? list : []).slice().sort((a, b) => a - b)) {
      if (!Number.isFinite(v)) continue;
      if (last == null || v !== last) out.push(v);
      last = v;
    }
    return out;
  };
  const findNextAfter = (sorted, value) => {
    if (!Array.isArray(sorted) || !sorted.length) return null;
    const target = Number(value);
    if (!Number.isFinite(target)) return null;
    let lo = 0;
    let hi = sorted.length - 1;
    let best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = sorted[mid];
      if (v > target) {
        best = v;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return best;
  };
  const isBarLikeSymbol = (symbol) => !!(symbol && (symbol.bar_type || symbol.type === 14));
  const genericByNumber = new Map();
  const voiceStarts = new Map();
  const barlines = [];

  let s = firstSymbol;
  let guard = 0;
  let primaryVoiceId = null;
  while (s && guard < 200000) {
    const istart = Number(s.istart);
    const voiceId = (s && s.p_v && s.p_v.id != null) ? String(s.p_v.id) : "1";
    if (Number.isFinite(istart)) {
      if (!voiceStarts.has(voiceId)) voiceStarts.set(voiceId, []);
      voiceStarts.get(voiceId).push(istart);
    }
    const playable = Number.isFinite(s.dur) && s.dur > 0;
    if (!primaryVoiceId && playable && Number.isFinite(istart)) primaryVoiceId = voiceId;
    if (isBarLikeSymbol(s) && Number.isFinite(s.bar_num) && Number.isFinite(istart)) {
      barlines.push({ barNum: Number(s.bar_num), istart, voiceId });
      if (s.ts_next && Number.isFinite(Number(s.ts_next.istart))) {
        push(genericByNumber, s.bar_num, s.ts_next.istart);
      }
    }
    s = s.ts_next;
    guard += 1;
  }
  if (!primaryVoiceId) primaryVoiceId = "1";

  const primaryStarts = normalizeList(voiceStarts.get(primaryVoiceId));
  const firstPrimaryStart = primaryStarts.length ? primaryStarts[0] : null;
  if (Number.isFinite(firstPrimaryStart)) {
    push(byNumber, 0, firstPrimaryStart);
    push(byNumber, 1, firstPrimaryStart);
  }

  const primaryBars = barlines
    .filter((item) => String(item.voiceId || "1") === String(primaryVoiceId))
    .sort((a, b) => Number(a.istart) - Number(b.istart));

  for (const item of primaryBars) {
    const nextStart = findNextAfter(primaryStarts, Number(item.istart));
    if (Number.isFinite(nextStart)) {
      push(byNumber, item.barNum, nextStart);
    }
  }

  normalizeMap(genericByNumber);
  normalizeMap(byNumber);
  for (const [k, list] of genericByNumber.entries()) {
    if (!byNumber.has(k) || !Array.isArray(byNumber.get(k)) || !byNumber.get(k).length) {
      byNumber.set(k, Array.isArray(list) ? list.slice() : []);
    }
  }
  return byNumber;
}

function findMeasureStartOffsetByNumber(text, measureNumber) {
  const target = Number(measureNumber);
  if (!Number.isFinite(target) || target < 1) return null;
  const src = String(text || "");
  if (!src.trim()) return null;
  const len = src.length;

  const isSkippableLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("%")) return true;
    if (/^%%/.test(trimmed)) return true;
    if (/^[A-Za-z]:/.test(trimmed)) return true;
    return false;
  };
  const isBodyLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("%")) return false;
    if (/^%%/.test(trimmed)) return false;
    if (/^[A-Za-z]:/.test(trimmed)) return false;
    return true;
  };

  let inTextBlock = false;
  let inBody = false;
  let started = false;
  let currentMeasure = 1;
  let currentStart = null;
  const lineStarts = [0];
  for (let i = 0; i < len; i += 1) {
    if (src[i] === "\n") lineStarts.push(i + 1);
  }
  lineStarts.push(len + 1);

  for (let li = 0; li < lineStarts.length - 1; li += 1) {
    const lineStart = lineStarts[li];
    const lineEnd = Math.min(len, lineStarts[li + 1] - 1);
    const rawLine = src.slice(lineStart, lineEnd);
    const trimmed = rawLine.trim();

    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;
    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(rawLine)) inBody = true;
      continue;
    }
    if (isSkippableLine(rawLine)) continue;
    if (!started && !isBodyLine(rawLine)) continue;
    if (!started) {
      started = true;
      const firstNonSpace = rawLine.search(/\S/);
      currentStart = firstNonSpace >= 0 ? lineStart + firstNonSpace : lineStart;
      if (target === 1) return currentStart;
    }

    let inQuote = false;
    let inComment = false;
    for (let i = lineStart; i < lineEnd; i += 1) {
      const ch = src[i];
      if (inComment) continue;
      if (ch === "%" && src[i - 1] !== "\\") { inComment = true; continue; }
      if (ch === "\"") { inQuote = !inQuote; continue; }
      if (inQuote) continue;
      if (ch !== "|") continue;
      let j = i + 1;
      while (j < lineEnd && /[:|\]\s]/.test(src[j])) j += 1;
      currentMeasure += 1;
      currentStart = j;
      if (currentMeasure === target) return currentStart;
      i = j - 1;
    }
  }

  return null;
}

function findMeasureStartOffsetByNumberInPrimaryVoice(text, measureNumber) {
  const target = Number(measureNumber);
  if (!Number.isFinite(target) || target < 1) return null;
  const src = String(text || "");
  if (!src.trim()) return null;
  const len = src.length;

  const isSkippableLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("%")) return true;
    if (/^%%/.test(trimmed)) return true;
    if (/^[A-Za-z]:/.test(trimmed)) return true;
    return false;
  };
  const isBodyLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("%")) return false;
    if (/^%%/.test(trimmed)) return false;
    if (/^[A-Za-z]:/.test(trimmed)) return false;
    return true;
  };

  let inTextBlock = false;
  let inBody = false;
  let primaryVoice = null;
  let currentVoice = null;
  let started = false;
  let currentMeasure = 1;
  const lineStarts = [0];
  for (let i = 0; i < len; i += 1) {
    if (src[i] === "\n") lineStarts.push(i + 1);
  }
  lineStarts.push(len + 1);

  for (let li = 0; li < lineStarts.length - 1; li += 1) {
    const lineStart = lineStarts[li];
    const lineEnd = Math.min(len, lineStarts[li + 1] - 1);
    const rawLine = src.slice(lineStart, lineEnd);
    const trimmed = rawLine.trim();

    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;
    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(rawLine)) inBody = true;
      continue;
    }

    const voiceLine = rawLine.match(/^\s*V\s*:\s*(.*)$/i);
    if (voiceLine) {
      currentVoice = normalizeVoiceIdToken(voiceLine[1]) || "1";
      if (!primaryVoice) primaryVoice = currentVoice;
      continue;
    }

    const effectiveVoice = currentVoice || "1";
    if (!primaryVoice && isBodyLine(rawLine)) primaryVoice = effectiveVoice;
    if (primaryVoice && effectiveVoice !== primaryVoice) continue;
    if (isSkippableLine(rawLine)) continue;
    if (!started && !isBodyLine(rawLine)) continue;
    if (!started) {
      started = true;
      const firstNonSpace = rawLine.search(/\S/);
      const start = firstNonSpace >= 0 ? lineStart + firstNonSpace : lineStart;
      if (target === 1) return start;
    }

    let inQuote = false;
    let inComment = false;
    for (let i = lineStart; i < lineEnd; i += 1) {
      const ch = src[i];
      if (inComment) continue;
      if (ch === "%" && src[i - 1] !== "\\") { inComment = true; continue; }
      if (ch === "\"") { inQuote = !inQuote; continue; }
      if (inQuote) continue;
      if (ch !== "|") continue;
      let j = i + 1;
      while (j < lineEnd && /[:|\]\s]/.test(src[j])) j += 1;
      currentMeasure += 1;
      if (currentMeasure === target) return j;
      i = j - 1;
    }
  }
  return null;
}

function buildFocusBarIndexMap(measureIndex, editorDocLength) {
  if (!measureIndex || !Array.isArray(measureIndex.istarts) || !measureIndex.istarts.length) return [];
  const renderOffset = Number(measureIndex.offset) || 0;
  const max = Math.max(0, Number.isFinite(Number(editorDocLength)) ? Number(editorDocLength) : 0);
  const starts = measureIndex.istarts.filter((v) => Number.isFinite(Number(v))).map((v) => Number(v));
  if (!starts.length) return [];
  const bars = [];
  for (let i = 0; i < starts.length; i += 1) {
    const startRenderOffset = starts[i];
    const nextStart = (i + 1 < starts.length) ? starts[i + 1] : null;
    const startOffset = Math.max(0, Math.min(max, Math.floor(startRenderOffset - renderOffset)));
    const endOffset = Number.isFinite(nextStart)
      ? Math.max(0, Math.min(max, Math.floor(nextStart - renderOffset)))
      : max;
    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset <= startOffset) continue;
    bars.push({
      barNumber: bars.length + 1,
      startRenderOffset,
      endRenderOffset: Number.isFinite(nextStart) ? nextStart : null,
      startOffset,
      endOffset,
    });
  }
  return bars;
}

function resolveVisibleFocusBarRange(barMap, visibleRenderRange) {
  if (!Array.isArray(barMap) || !barMap.length) return null;
  if (!visibleRenderRange) return null;
  const startRender = Number(visibleRenderRange.startRenderOffset);
  const endRender = Number(visibleRenderRange.endRenderOffset);
  if (!Number.isFinite(startRender) || !Number.isFinite(endRender) || endRender <= startRender) return null;
  let startBarIndex = null;
  let endBarIndex = null;
  for (let i = 0; i < barMap.length; i += 1) {
    const bar = barMap[i];
    const barStart = Number(bar.startRenderOffset);
    const barEnd = Number.isFinite(Number(bar.endRenderOffset)) ? Number(bar.endRenderOffset) : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(barStart)) continue;
    if (barStart < endRender && barEnd > startRender) {
      if (startBarIndex == null) startBarIndex = i;
      endBarIndex = i;
    }
  }
  if (startBarIndex == null || endBarIndex == null) return null;
  return { startBarIndex, endBarIndex };
}

function normalizeFocusBarStarts(list) {
  if (!Array.isArray(list) || !list.length) return [];
  const out = [];
  let last = null;
  for (const value of list.slice().sort((a, b) => Number(a) - Number(b))) {
    const v = Number(value);
    if (!Number.isFinite(v)) continue;
    if (last == null || v !== last) out.push(v);
    last = v;
  }
  return out;
}

function getFocusFirstMeasureStartRender(byNumber) {
  if (!byNumber || typeof byNumber.get !== "function") return null;
  const first = normalizeFocusBarStarts(byNumber.get(1));
  if (!first.length) return null;
  return Number(first[0]);
}

function getFocusMeasureStartCandidates(byNumber, measureNumber) {
  if (!byNumber || typeof byNumber.get !== "function") return [];
  const n = Number(measureNumber);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return [];
  const firstMeasureStart = getFocusFirstMeasureStartRender(byNumber);
  if (!Number.isFinite(firstMeasureStart)) return [];
  if (n === 1) return [firstMeasureStart];

  const direct = normalizeFocusBarStarts(byNumber.get(n)).filter((v) => Number(v) > firstMeasureStart);
  if (direct.length) return direct;
  return normalizeFocusBarStarts(byNumber.get(n - 1)).filter((v) => Number(v) > firstMeasureStart);
}

function findFocusBarIndexAtOrAfterStart(barMap, renderStart) {
  if (!Array.isArray(barMap) || !barMap.length) return -1;
  const target = Number(renderStart);
  if (!Number.isFinite(target)) return -1;
  for (let i = 0; i < barMap.length; i += 1) {
    const start = Number(barMap[i] && barMap[i].startRenderOffset);
    const rawEnd = Number(barMap[i] && barMap[i].endRenderOffset);
    const end = Number.isFinite(rawEnd) ? rawEnd : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(start)) continue;
    if (target >= start && target < end) return i;
  }
  for (let i = 0; i < barMap.length; i += 1) {
    const start = Number(barMap[i] && barMap[i].startRenderOffset);
    if (!Number.isFinite(start)) continue;
    if (start >= target) return i;
  }
  return barMap.length - 1;
}

function resolveFocusSegmentBarsByNumber(barMap, byNumber, from, to) {
  if (!Array.isArray(barMap) || !barMap.length) return null;
  if (!byNumber || typeof byNumber.get !== "function") return null;
  const fromStarts = getFocusMeasureStartCandidates(byNumber, from);
  const toStarts = getFocusMeasureStartCandidates(byNumber, to);
  if (!fromStarts.length || !toStarts.length) return null;

  const startRender = fromStarts[0];
  let toStartRender = null;
  for (let i = toStarts.length - 1; i >= 0; i -= 1) {
    const candidate = Number(toStarts[i]);
    if (!Number.isFinite(candidate)) continue;
    if (candidate >= startRender) {
      toStartRender = candidate;
      break;
    }
  }
  if (!Number.isFinite(toStartRender)) return null;

  const nextStarts = getFocusMeasureStartCandidates(byNumber, to + 1);
  let endBoundaryRender = null;
  for (let i = 0; i < nextStarts.length; i += 1) {
    const candidate = Number(nextStarts[i]);
    if (!Number.isFinite(candidate)) continue;
    if (candidate > toStartRender) {
      endBoundaryRender = candidate;
      break;
    }
  }
  if (!Number.isFinite(endBoundaryRender)) {
    for (let i = 0; i < barMap.length; i += 1) {
      const candidate = Number(barMap[i] && barMap[i].startRenderOffset);
      if (!Number.isFinite(candidate)) continue;
      if (candidate > toStartRender) {
        endBoundaryRender = candidate;
        break;
      }
    }
  }

  const startBarIndex = findFocusBarIndexAtOrAfterStart(barMap, startRender);
  const endBarIndex = findFocusBarIndexAtOrAfterStart(barMap, toStartRender);
  if (startBarIndex < 0 || endBarIndex < 0 || endBarIndex < startBarIndex) return null;
  return {
    startBarIndex,
    endBarIndex,
    startRenderOffset: startRender,
    toStartRenderOffset: toStartRender,
    endBoundaryRenderOffset: Number.isFinite(endBoundaryRender) ? endBoundaryRender : null,
  };
}

function getFocusBarMapRenderOffset(barMap) {
  if (!Array.isArray(barMap) || !barMap.length) return null;
  for (const bar of barMap) {
    const renderStart = Number(bar && bar.startRenderOffset);
    const editorStart = Number(bar && bar.startOffset);
    if (!Number.isFinite(renderStart) || !Number.isFinite(editorStart)) continue;
    return renderStart - editorStart;
  }
  return null;
}

function buildFocusPlaybackPlan({ parsedTune, focusState, visibleRange }) {
  const bars = parsedTune && Array.isArray(parsedTune.barMap) ? parsedTune.barMap : [];
  if (!bars.length) return { ok: false, reason: "Cannot resolve bar boundaries for multi-voice selection." };
  const tuneText = String(parsedTune && parsedTune.text ? parsedTune.text : "");
  const byNumber = (parsedTune && parsedTune.byNumber && typeof parsedTune.byNumber.get === "function")
    ? parsedTune.byNumber
    : null;
  const state = focusState || {};
  const from = Number(state.fromMeasure);
  const to = Number(state.toMeasure);
  const hasFrom = Number.isFinite(from) && from >= 1;
  const hasTo = Number.isFinite(to) && to >= 1;
  let mode = "visible";
  let startBarIndex = null;
  let endBarIndex = null;
  let byNumberRange = null;

  if (hasFrom && hasTo) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) {
      return { ok: false, reason: "Invalid Focus range: set integer From/To with From <= To." };
    }
    byNumberRange = resolveFocusSegmentBarsByNumber(bars, byNumber, from, to);
    if (byNumberRange) {
      const resolvedSpan = (Number(byNumberRange.endBarIndex) - Number(byNumberRange.startBarIndex)) + 1;
      const expectedSpan = (to - from) + 1;
      const spanSuspicious = (
        !Number.isFinite(resolvedSpan)
        || resolvedSpan <= 0
        || resolvedSpan > (expectedSpan + 8)
        || (from <= 4 && resolvedSpan > (expectedSpan + 2))
      );
      if (spanSuspicious) byNumberRange = null;
    }
    if (byNumberRange) {
      mode = "segment";
      startBarIndex = byNumberRange.startBarIndex;
      endBarIndex = byNumberRange.endBarIndex;
    } else {
      if (from > bars.length || to > bars.length) {
        return { ok: false, reason: "Requested bar range is outside the focused tune." };
      }
      mode = "segment";
      startBarIndex = from - 1;
      endBarIndex = to - 1;
    }
  } else {
    const visibleBars = resolveVisibleFocusBarRange(bars, visibleRange);
    if (!visibleBars) return { ok: false, reason: "Cannot resolve visible scope in Focus mode." };
    startBarIndex = visibleBars.startBarIndex;
    endBarIndex = visibleBars.endBarIndex;
  }

  const startBar = bars[startBarIndex];
  const endBar = bars[endBarIndex];
  if (!startBar || !endBar) return { ok: false, reason: "Cannot resolve Focus playback boundaries." };
  let startOffset = Number(startBar.startOffset);
  let endOffset = Number(endBar.endOffset);
  if (mode === "segment" && byNumberRange) {
    const renderOffset = getFocusBarMapRenderOffset(bars);
    const max = Math.max(0, tuneText.length);
    if (Number.isFinite(renderOffset) && Number.isFinite(Number(byNumberRange.startRenderOffset))) {
      const exactStart = Math.floor(Number(byNumberRange.startRenderOffset) - Number(renderOffset));
      startOffset = Math.max(0, Math.min(max, exactStart));
    }
    const boundaryRender = Number.isFinite(Number(byNumberRange.endBoundaryRenderOffset))
      ? Number(byNumberRange.endBoundaryRenderOffset)
      : Number(byNumberRange.toStartRenderOffset);
    if (Number.isFinite(renderOffset) && Number.isFinite(boundaryRender)) {
      const exactEnd = Math.floor(boundaryRender - Number(renderOffset));
      endOffset = Math.max(0, Math.min(max, exactEnd));
    } else if (Number.isFinite(Number(byNumberRange.endBoundaryRenderOffset))) {
      const boundaryIdx = findFocusBarIndexAtOrAfterStart(bars, Number(byNumberRange.endBoundaryRenderOffset));
      if (boundaryIdx >= 0) {
        const boundaryBar = bars[boundaryIdx];
        if (boundaryBar && Number.isFinite(Number(boundaryBar.startOffset))) {
          endOffset = Number(boundaryBar.startOffset);
        }
      }
    }
  }
  if (mode === "segment") {
    const textStartOffset = findMeasureStartOffsetByNumberInPrimaryVoice(tuneText, from);
    const textEndOffsetExclusive = findMeasureStartOffsetByNumberInPrimaryVoice(tuneText, to + 1);
    if (from === 1 && Number.isFinite(Number(textStartOffset)) && Number(textStartOffset) >= 0) {
      startOffset = Number(textStartOffset);
    }
    if (!byNumberRange
      && Number.isFinite(Number(textEndOffsetExclusive))
      && Number(textEndOffsetExclusive) > startOffset) {
      endOffset = Number(textEndOffsetExclusive);
    }
  }
  const firstMeasureOffset = Number(parsedTune && parsedTune.firstMeasureOffset);
  if (
    mode === "segment"
    && Number(state.fromMeasure) === 1
    && Number.isFinite(firstMeasureOffset)
    && firstMeasureOffset >= 0
    && firstMeasureOffset < startOffset
  ) {
    startOffset = firstMeasureOffset;
  }
  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset <= startOffset) {
    return { ok: false, reason: "Cannot resolve Focus playback boundaries." };
  }

  return {
    ok: true,
    plan: {
      mode,
      startBarIndex,
      endBarIndex,
      startOffset,
      endOffset,
      suppressRepeats: Boolean(state.suppressRepeats),
      mutedVoices: Array.isArray(state.mutedVoices) ? state.mutedVoices.slice() : [],
      loop: Boolean(state.loop),
    },
  };
}

function normalizeVoiceIdToken(value) {
  const raw = String(value || "").trim().replace(/^\[+|\]+$/g, "");
  if (!raw) return "";
  const withPrefix = raw.match(/^V\s*:\s*(.+)$/i);
  const token = withPrefix ? withPrefix[1].trim() : raw;
  if (!token) return "";
  const head = token.split(/\s+/)[0];
  return head ? String(head).trim() : "";
}

function parseMutedVoiceSetting(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const out = [];
  const seen = new Set();
  raw.split(/[,\s]+/).forEach((part) => {
    const id = normalizeVoiceIdToken(part);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

function resolveEffectiveMutedVoiceIds(mutedVoiceIds, firstPlayableVoiceId) {
  const ids = Array.isArray(mutedVoiceIds) ? mutedVoiceIds.map((v) => normalizeVoiceIdToken(v)).filter(Boolean) : [];
  if (!ids.length) return [];
  const firstId = normalizeVoiceIdToken(firstPlayableVoiceId);
  const set = new Set(ids);
  if (set.has("1") && firstId) set.add(firstId);
  return Array.from(set);
}

function getFirstPlayableVoiceIdFromTuneRoot(firstSymbol) {
  let s = firstSymbol || null;
  let guard = 0;
  while (s && s.ts_prev && guard < 200000) {
    s = s.ts_prev;
    guard += 1;
  }
  guard = 0;
  while (s && guard < 200000) {
    const pv = s.p_v || null;
    const id = pv && pv.id != null ? String(pv.id) : "";
    const upper = id.toUpperCase();
    if (id && upper !== "_DRUM" && upper !== "_CHORD" && upper !== "_BEATS") return id;
    s = s.ts_next;
    guard += 1;
  }
  return "";
}

function applyMutedVoicesToTuneRoot(firstSymbol, mutedVoiceIds) {
  const mutedSet = new Set(Array.isArray(mutedVoiceIds) ? mutedVoiceIds.map((v) => String(v)) : []);
  if (!firstSymbol || !mutedSet.size) return false;
  let s = firstSymbol;
  let guard = 0;
  while (s && s.ts_prev && guard < 200000) {
    s = s.ts_prev;
    guard += 1;
  }
  let changed = false;
  guard = 0;
  while (s && guard < 400000) {
    const pv = s.p_v || null;
    const id = pv && pv.id != null ? String(pv.id) : "";
    if (id && mutedSet.has(id)) {
      s.noplay = true;
      changed = true;
      if (Array.isArray(s.notes)) {
        for (const note of s.notes) {
          if (note && typeof note === "object") note.noplay = true;
        }
      }
    }
    s = s.ts_next;
    guard += 1;
  }
  return changed;
}

function countPlayableByVoice(firstSymbol) {
  const out = new Map();
  let s = firstSymbol;
  let guard = 0;
  while (s && s.ts_prev && guard < 200000) {
    s = s.ts_prev;
    guard += 1;
  }
  guard = 0;
  while (s && guard < 400000) {
    const playable = !s.noplay && Number.isFinite(s.dur) && s.dur > 0;
    if (playable) {
      const id = (s.p_v && s.p_v.id != null) ? String(s.p_v.id) : "";
      if (id) out.set(id, (out.get(id) || 0) + 1);
    }
    s = s.ts_next;
    guard += 1;
  }
  return out;
}

function shiftByNumberMap(byNumber, renderOffset) {
  const out = new Map();
  for (const [k, list] of byNumber.entries()) {
    out.set(k, (list || []).map((v) => Number(v) + renderOffset));
  }
  return out;
}

function makeHarnessContext(tuneText, renderOffset) {
  const firstSymbol = parseTuneWithAbc2svg(tuneText);
  const istarts = buildMeasureIstartsFromAbc2svg(firstSymbol);
  const byNumberBase = buildMeasureStartsByNumberFromAbc2svg(firstSymbol);
  const measureIndex = {
    offset: renderOffset,
    istarts: istarts.map((v) => Number(v) + renderOffset),
    byNumber: shiftByNumberMap(byNumberBase, renderOffset),
  };
  const barMap = buildFocusBarIndexMap(measureIndex, tuneText.length);
  const firstMeasureOffset = findMeasureStartOffsetByNumberInPrimaryVoice(tuneText, 1);
  const visibleRange = {
    startRenderOffset: barMap.length ? barMap[0].startRenderOffset : renderOffset,
    endRenderOffset: barMap.length
      ? Number(barMap[barMap.length - 1].endRenderOffset || (barMap[barMap.length - 1].startRenderOffset + 1))
      : renderOffset + tuneText.length,
  };
  return { barMap, byNumber: measureIndex.byNumber, firstMeasureOffset, visibleRange };
}

function assertBarContainsRender(bar, renderOffset, label) {
  assert(bar, `${label}: missing bar`);
  const s = Number(bar.startRenderOffset);
  const e = Number.isFinite(Number(bar.endRenderOffset)) ? Number(bar.endRenderOffset) : Number.POSITIVE_INFINITY;
  assert(Number.isFinite(s), `${label}: invalid bar start`);
  assert(renderOffset >= s && renderOffset < e, `${label}: render offset ${renderOffset} not in [${s}, ${e})`);
}

function runFocusScenarioCase(name, context, state, expected) {
  const result = buildFocusPlaybackPlan({
    parsedTune: {
      text: expected.tuneText,
      barMap: context.barMap,
      byNumber: context.byNumber,
      firstMeasureOffset: context.firstMeasureOffset,
    },
    focusState: state,
    visibleRange: context.visibleRange,
  });
  assert(result && result.ok, `${name}: plan must be valid (${result ? result.reason : "no result"})`);
  const plan = result.plan;
  assert(plan.mode === expected.mode, `${name}: expected mode ${expected.mode}, got ${plan.mode}`);
  if (expected.startBar != null && expected.endBar != null) {
    const fromStarts = getFocusMeasureStartCandidates(context.byNumber, expected.startBar);
    const toStarts = getFocusMeasureStartCandidates(context.byNumber, expected.endBar);
    assert(fromStarts.length > 0, `${name}: no bar starts for ${expected.startBar}`);
    assert(toStarts.length > 0, `${name}: no bar starts for ${expected.endBar}`);
    const expectedStartRender = fromStarts[0];
    let expectedEndRender = null;
    for (let i = toStarts.length - 1; i >= 0; i -= 1) {
      if (toStarts[i] >= expectedStartRender) { expectedEndRender = toStarts[i]; break; }
    }
    assert(Number.isFinite(expectedEndRender), `${name}: cannot resolve expected end render`);
    const expectedStartIdx = findFocusBarIndexAtOrAfterStart(context.barMap, expectedStartRender);
    const expectedEndIdx = findFocusBarIndexAtOrAfterStart(context.barMap, expectedEndRender);
    assert(expectedStartIdx >= 0, `${name}: expected start index is invalid`);
    assert(expectedEndIdx >= 0, `${name}: expected end index is invalid`);
    assert(plan.startBarIndex === expectedStartIdx, `${name}: expected startBarIndex ${expectedStartIdx}, got ${plan.startBarIndex}`);
    assert(plan.endBarIndex === expectedEndIdx, `${name}: expected endBarIndex ${expectedEndIdx}, got ${plan.endBarIndex}`);
  }
  if (expected.endBoundaryBar != null) {
    const boundaryStarts = getFocusMeasureStartCandidates(context.byNumber, expected.endBoundaryBar);
    assert(boundaryStarts.length > 0, `${name}: no boundary starts for bar ${expected.endBoundaryBar}`);
    const boundaryIdx = findFocusBarIndexAtOrAfterStart(context.barMap, Number(boundaryStarts[0]));
    assert(boundaryIdx >= 0, `${name}: cannot map boundary bar ${expected.endBoundaryBar}`);
    const boundaryBar = context.barMap[boundaryIdx];
    assert(boundaryBar && Number.isFinite(Number(boundaryBar.startOffset)), `${name}: invalid boundary bar start offset`);
    assert(
      plan.endOffset === Number(boundaryBar.startOffset),
      `${name}: expected endOffset ${Number(boundaryBar.startOffset)}, got ${plan.endOffset}`
    );
  }
  if (expected.maxSpanBars != null) {
    const span = (Number(plan.endBarIndex) - Number(plan.startBarIndex)) + 1;
    assert(Number.isFinite(span) && span > 0, `${name}: invalid span`);
    assert(span <= Number(expected.maxSpanBars), `${name}: span too large (${span} > ${expected.maxSpanBars})`);
  }
  if (expected.mustStartAtFirstMeasure === true) {
    assert(
      Number.isFinite(context.firstMeasureOffset) && plan.startOffset === context.firstMeasureOffset,
      `${name}: startOffset must equal first measure offset (${context.firstMeasureOffset}), got ${plan.startOffset}`
    );
    if (expected.expectFallbackBeforeFirstBar === true) {
      const firstBarStart = Number(context.barMap[0] && context.barMap[0].startOffset);
      assert(Number.isFinite(firstBarStart), `${name}: first bar start is invalid`);
      assert(
        plan.startOffset < firstBarStart,
        `${name}: expected fallback start before first bar map start (${firstBarStart}), got ${plan.startOffset}`
      );
    }
  }
  return plan;
}

async function main() {
  const tuneText = readText(FIXTURE);
  const renderOffsets = [0, 605];
  const contexts = renderOffsets.map((offset) => ({
    offset,
    ...makeHarnessContext(tuneText, offset),
  }));

  // Sanity for this problematic fixture: first-measure anchor must be finite and
  // never point after the first bar-map boundary.
  for (const ctx of contexts) {
    assert(ctx.barMap.length > 0, `renderOffset=${ctx.offset}: barMap must be non-empty`);
    assert(Number.isFinite(ctx.firstMeasureOffset), `renderOffset=${ctx.offset}: firstMeasureOffset must be finite`);
    assert(
      ctx.firstMeasureOffset <= Number(ctx.barMap[0].startOffset),
      `renderOffset=${ctx.offset}: firstMeasureOffset must not exceed first bar start`
    );
  }

  const focusCases = [
    { name: "TEST 1: Segment 1-2 starts at bar 1 (loop off, suppress off)", state: { fromMeasure: 1, toMeasure: 2, loop: false, suppressRepeats: false, mutedVoices: [] }, exp: { mode: "segment", mustStartAtFirstMeasure: true, expectFallbackBeforeFirstBar: true } },
    { name: "TEST 2: Segment 1-2 starts at bar 1 (loop on, suppress on)", state: { fromMeasure: 1, toMeasure: 2, loop: true, suppressRepeats: true, mutedVoices: [] }, exp: { mode: "segment", mustStartAtFirstMeasure: true, expectFallbackBeforeFirstBar: true } },
    { name: "TEST 3: Segment 1-3 stays bounded (no far overshoot)", state: { fromMeasure: 1, toMeasure: 3, loop: false, suppressRepeats: false, mutedVoices: [] }, exp: { mode: "segment", mustStartAtFirstMeasure: true, maxSpanBars: 5 } },
    { name: "TEST 4: Segment 3-6 resolves before repeat section", state: { fromMeasure: 3, toMeasure: 6, loop: false, suppressRepeats: false, mutedVoices: [] }, exp: { mode: "segment", startBar: 3, endBar: 6 } },
    { name: "TEST 5: Segment 8-18 resolves across reprise/voltas (suppress off)", state: { fromMeasure: 8, toMeasure: 18, loop: false, suppressRepeats: false, mutedVoices: [] }, exp: { mode: "segment", startBar: 8, endBar: 18 } },
    { name: "TEST 6: Segment 8-18 resolves across reprise/voltas (suppress on, loop on)", state: { fromMeasure: 8, toMeasure: 18, loop: true, suppressRepeats: true, mutedVoices: [] }, exp: { mode: "segment", startBar: 8, endBar: 18 } },
    { name: "TEST 7: Segment 15-16 (between voltas) remains deterministic", state: { fromMeasure: 15, toMeasure: 16, loop: false, suppressRepeats: false, mutedVoices: [] }, exp: { mode: "segment", startBar: 15, endBar: 16 } },
    { name: "TEST 8: Segment 14-17 reaches real bar 17 (not second-volta 15)", state: { fromMeasure: 14, toMeasure: 17, loop: true, suppressRepeats: true, mutedVoices: [] }, exp: { mode: "segment", startBar: 14, endBar: 17 } },
    { name: "TEST 9: Segment 17-18 (after reprise) remains deterministic", state: { fromMeasure: 17, toMeasure: 18, loop: false, suppressRepeats: false, mutedVoices: [] }, exp: { mode: "segment", startBar: 17, endBar: 18 } },
  ];

  for (const testCase of focusCases) {
    try {
      const plans = [];
      for (const ctx of contexts) {
        const plan = runFocusScenarioCase(
          `${testCase.name} [offset=${ctx.offset}]`,
          ctx,
          testCase.state,
          { ...testCase.exp, tuneText }
        );
        plans.push(plan);
      }
      assert(plans.length === 2, `${testCase.name}: expected two plans`);
      assert(plans[0].startOffset === plans[1].startOffset, `${testCase.name}: startOffset changed with render offset`);
      assert(plans[0].endOffset === plans[1].endOffset, `${testCase.name}: endOffset changed with render offset`);
      console.log(`% PASS ${testCase.name}`);
    } catch (e) {
      console.log(`% FAIL ${testCase.name}`);
      String(e && e.message ? e.message : e).split(/\r\n|\n|\r/).forEach((line) => console.log(`% ${line}`));
      process.exitCode = 1;
    }
  }

  // Muted voices must not affect bar resolution/start-end offsets.
  try {
    for (const ctx of contexts) {
      const base = buildFocusPlaybackPlan({
        parsedTune: {
          text: tuneText,
          barMap: ctx.barMap,
          byNumber: ctx.byNumber,
          firstMeasureOffset: ctx.firstMeasureOffset,
        },
        focusState: { fromMeasure: 17, toMeasure: 20, loop: true, suppressRepeats: true, mutedVoices: [] },
        visibleRange: ctx.visibleRange,
      });
      assert(base && base.ok, `base plan [offset=${ctx.offset}] must be valid`);
      const variants = [
        ["2"],
        ["2", "3"],
        ["1"],
      ];
      for (const muted of variants) {
        const result = buildFocusPlaybackPlan({
          parsedTune: {
            text: tuneText,
            barMap: ctx.barMap,
            byNumber: ctx.byNumber,
            firstMeasureOffset: ctx.firstMeasureOffset,
          },
          focusState: { fromMeasure: 17, toMeasure: 20, loop: true, suppressRepeats: true, mutedVoices: muted },
          visibleRange: ctx.visibleRange,
        });
        assert(result && result.ok, `muted=${muted.join(",")} [offset=${ctx.offset}] must be valid`);
        assert(result.plan.startOffset === base.plan.startOffset, `muted=${muted.join(",")} [offset=${ctx.offset}] changed startOffset`);
        assert(result.plan.endOffset === base.plan.endOffset, `muted=${muted.join(",")} [offset=${ctx.offset}] changed endOffset`);
      }
    }
    console.log("% PASS TEST 10: Muted voices do not change Focus segment boundaries");
  } catch (e) {
    console.log("% FAIL TEST 10: Muted voices do not change Focus segment boundaries");
    String(e && e.message ? e.message : e).split(/\r\n|\n|\r/).forEach((line) => console.log(`% ${line}`));
    process.exitCode = 1;
  }

  // Visible mode default (no From/To) must be valid and cover visible scope.
  try {
    for (const ctx of contexts) {
      const result = buildFocusPlaybackPlan({
        parsedTune: {
          text: tuneText,
          barMap: ctx.barMap,
          byNumber: ctx.byNumber,
          firstMeasureOffset: ctx.firstMeasureOffset,
        },
        focusState: { fromMeasure: 0, toMeasure: 0, loop: false, suppressRepeats: false, mutedVoices: [] },
        visibleRange: ctx.visibleRange,
      });
      assert(result && result.ok, `visible mode [offset=${ctx.offset}] must be valid`);
      assert(result.plan.mode === "visible", `visible mode [offset=${ctx.offset}] expected mode=visible`);
    }
    console.log("% PASS TEST 11: Visible mode (no From/To) builds a valid Focus plan");
  } catch (e) {
    console.log("% FAIL TEST 11: Visible mode (no From/To) builds a valid Focus plan");
    String(e && e.message ? e.message : e).split(/\r\n|\n|\r/).forEach((line) => console.log(`% ${line}`));
    process.exitCode = 1;
  }

  // Invalid segment range should fail closed.
  try {
    const ctx = contexts[0];
    const result = buildFocusPlaybackPlan({
      parsedTune: { text: tuneText, barMap: ctx.barMap, byNumber: ctx.byNumber, firstMeasureOffset: ctx.firstMeasureOffset },
      focusState: { fromMeasure: 6, toMeasure: 3, loop: false, suppressRepeats: false, mutedVoices: [] },
      visibleRange: ctx.visibleRange,
    });
    assert(result && result.ok === false, "invalid range (From>To) must fail");
    console.log("% PASS TEST 12: Invalid segment range fails closed");
  } catch (e) {
    console.log("% FAIL TEST 12: Invalid segment range fails closed");
    String(e && e.message ? e.message : e).split(/\r\n|\n|\r/).forEach((line) => console.log(`% ${line}`));
    process.exitCode = 1;
  }

  // Muted voices parsing / symbol-level muting regression tests.
  try {
    const ids = parseMutedVoiceSetting("2, 3  2");
    assert(ids.length === 2 && ids[0] === "2" && ids[1] === "3", "parseMutedVoiceSetting should dedupe");

    const baseRoot = parseTuneWithAbc2svg(tuneText);
    const baseCounts = countPlayableByVoice(baseRoot);
    assert((baseCounts.get("1") || 0) > 0, "fixture must contain playable V:1 symbols");
    assert((baseCounts.get("2") || 0) > 0, "fixture must contain playable V:2 symbols");

    const mutedV1Root = parseTuneWithAbc2svg(tuneText);
    const firstId = getFirstPlayableVoiceIdFromTuneRoot(mutedV1Root);
    const effectiveMuteV1 = resolveEffectiveMutedVoiceIds(["1"], firstId);
    const changedV1 = applyMutedVoicesToTuneRoot(mutedV1Root, effectiveMuteV1);
    assert(changedV1, "muted V:1 should modify tune symbols");
    const afterV1 = countPlayableByVoice(mutedV1Root);
    assert((afterV1.get("1") || 0) === 0, "muted V:1 must silence voice 1");
    assert((afterV1.get("2") || 0) > 0, "muted V:1 must keep voice 2 playable");

    const mutedV2Root = parseTuneWithAbc2svg(tuneText);
    const changedV2 = applyMutedVoicesToTuneRoot(mutedV2Root, ["2"]);
    assert(changedV2, "muted V:2 should modify tune symbols");
    const afterV2 = countPlayableByVoice(mutedV2Root);
    assert((afterV2.get("2") || 0) === 0, "muted V:2 must silence voice 2");
    assert((afterV2.get("1") || 0) > 0, "muted V:2 must keep voice 1 playable");

    const implicitVoiceText = [
      "X:1",
      "T:implicit-v1",
      "M:4/4",
      "L:1/8",
      "K:D",
      "D2 E2 | F2 G2 |",
      "V:2",
      "A2 B2 | c2 d2 |",
    ].join("\n");
    const implicitRoot = parseTuneWithAbc2svg(implicitVoiceText);
    const implicitFirst = getFirstPlayableVoiceIdFromTuneRoot(implicitRoot);
    const implicitEffective = resolveEffectiveMutedVoiceIds(["1"], implicitFirst);
    assert(implicitEffective.includes(implicitFirst), "implicit/malformed V:1 should map to de-facto first voice");
    applyMutedVoicesToTuneRoot(implicitRoot, implicitEffective);
    const implicitAfter = countPlayableByVoice(implicitRoot);
    assert((implicitAfter.get("2") || 0) > 0, "implicit V:1 mute should keep explicit V:2 playable");

    const malformedVoiceText = [
      "X:1",
      "T:malformed-v1",
      "M:4/4",
      "L:1/8",
      "K:D",
      "V:",
      "D2 E2 | F2 G2 |",
      "V:2",
      "A2 B2 | c2 d2 |",
    ].join("\n");
    const malformedRoot = parseTuneWithAbc2svg(malformedVoiceText);
    const malformedFirst = getFirstPlayableVoiceIdFromTuneRoot(malformedRoot);
    const malformedEffective = resolveEffectiveMutedVoiceIds(["1"], malformedFirst);
    assert(malformedEffective.includes(malformedFirst), "malformed V: should still map mute 1 to de-facto first voice");
    applyMutedVoicesToTuneRoot(malformedRoot, malformedEffective);
    const malformedAfter = countPlayableByVoice(malformedRoot);
    assert((malformedAfter.get("2") || 0) > 0, "malformed V: mute should keep explicit V:2 playable");
    console.log("% PASS TEST 13: Muted voices (including V:1 and implicit/malformed V:1) behave correctly");
  } catch (e) {
    console.log("% FAIL TEST 13: Muted voices (including V:1 and implicit/malformed V:1) behave correctly");
    String(e && e.message ? e.message : e).split(/\r\n|\n|\r/).forEach((line) => console.log(`% ${line}`));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.log("% FAIL focus playback harness crashed");
  String(e && e.stack ? e.stack : e).split(/\r\n|\n|\r/).forEach((line) => console.log(`% ${line}`));
  process.exitCode = 1;
});
