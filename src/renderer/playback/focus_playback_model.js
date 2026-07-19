import {
  extendVisibleRangeToRepeatClose,
  focusRangeCrossesRepeats,
} from "./selection_playback_model.js";

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

function buildFocusBarIndexMap({
  measureIndex,
  editorDocLength,
  getRenderCompatMap = () => null,
  mapRenderIdxToEditorOffset = (value) => value,
} = {}) {
  if (!measureIndex || !Array.isArray(measureIndex.istarts) || !measureIndex.istarts.length) return [];
  const payload = {
    offset: Number(measureIndex.offset) || 0,
    compatMap: getRenderCompatMap(),
  };
  const max = Math.max(0, Number.isFinite(Number(editorDocLength)) ? Number(editorDocLength) : 0);
  const starts = measureIndex.istarts.filter((v) => Number.isFinite(Number(v))).map((v) => Number(v));
  if (!starts.length) return [];
  const bars = [];
  for (let i = 0; i < starts.length; i += 1) {
    const startRenderOffset = starts[i];
    const nextStart = (i + 1 < starts.length) ? starts[i + 1] : null;
    const startOffset = Math.max(0, Math.min(max, Math.floor(mapRenderIdxToEditorOffset(startRenderOffset, payload))));
    const endOffset = Number.isFinite(nextStart)
      ? Math.max(0, Math.min(max, Math.floor(mapRenderIdxToEditorOffset(nextStart, payload))))
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

function readFocusBarRangesFromElements(barElements) {
  const barEls = Array.from(barElements || []);
  if (!barEls.length) return [];
  const raw = [];
  for (const el of barEls) {
    const s = Number(el.dataset && el.dataset.start);
    const e = Number(el.dataset && el.dataset.end);
    if (!Number.isFinite(s)) continue;
    raw.push({
      element: el,
      startRenderOffset: s,
      endRenderOffset: (Number.isFinite(e) && e > s) ? e : null,
    });
  }
  if (!raw.length) return [];
  raw.sort((a, b) => {
    if (a.startRenderOffset !== b.startRenderOffset) return a.startRenderOffset - b.startRenderOffset;
    const ae = Number.isFinite(a.endRenderOffset) ? a.endRenderOffset : Number.POSITIVE_INFINITY;
    const be = Number.isFinite(b.endRenderOffset) ? b.endRenderOffset : Number.POSITIVE_INFINITY;
    return ae - be;
  });
  const deduped = [];
  const seen = new Set();
  for (const item of raw) {
    const key = `${item.startRenderOffset}:${Number.isFinite(item.endRenderOffset) ? item.endRenderOffset : "null"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function buildFocusBarIndexMapFromElements({
  barElements,
  editorDocLength,
  payload = { offset: 0, compatMap: null },
  mapEditorOffsetToRenderIdx = (value) => value,
  mapRenderIdxToEditorOffset = (value) => value,
} = {}) {
  const ranges = readFocusBarRangesFromElements(barElements);
  if (!ranges.length) return [];
  const max = Math.max(0, Number.isFinite(Number(editorDocLength)) ? Number(editorDocLength) : 0);
  const bars = [];
  for (let i = 0; i < ranges.length; i += 1) {
    const item = ranges[i];
    const next = (i + 1 < ranges.length) ? ranges[i + 1] : null;
    let endRenderOffset = Number.isFinite(item.endRenderOffset) ? Number(item.endRenderOffset) : null;
    const nextStart = next && Number.isFinite(next.startRenderOffset) ? Number(next.startRenderOffset) : null;
    if (Number.isFinite(nextStart) && (!Number.isFinite(endRenderOffset) || endRenderOffset > nextStart)) {
      endRenderOffset = nextStart;
    }
    if (!Number.isFinite(endRenderOffset)) endRenderOffset = mapEditorOffsetToRenderIdx(max, payload);
    const startOffset = Math.max(0, Math.min(max, Math.floor(mapRenderIdxToEditorOffset(item.startRenderOffset, payload))));
    const endOffset = Math.max(0, Math.min(max, Math.floor(mapRenderIdxToEditorOffset(endRenderOffset, payload))));
    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset <= startOffset) continue;
    bars.push({
      barNumber: bars.length + 1,
      startRenderOffset: item.startRenderOffset,
      endRenderOffset,
      startOffset,
      endOffset,
    });
  }
  return bars;
}

function getVisibleFocusRenderRangeFromElements({ barElements, paneRect } = {}) {
  const ranges = readFocusBarRangesFromElements(barElements);
  if (!ranges.length) return null;
  if (!(paneRect && paneRect.width > 1 && paneRect.height > 1)) return null;
  let startRenderOffset = Number.POSITIVE_INFINITY;
  let endRenderOffset = Number.NEGATIVE_INFINITY;
  let hits = 0;
  for (const item of ranges) {
    const el = item.element;
    const rect = el && typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
    if (!rect || rect.bottom <= paneRect.top || rect.top >= paneRect.bottom || rect.right <= paneRect.left || rect.left >= paneRect.right) {
      continue;
    }
    const s = Number(item.startRenderOffset);
    if (!Number.isFinite(s)) continue;
    const e = Number(item.endRenderOffset);
    const stop = (Number.isFinite(e) && e > s) ? e : (s + 1);
    startRenderOffset = Math.min(startRenderOffset, s);
    endRenderOffset = Math.max(endRenderOffset, stop);
    hits += 1;
  }
  if (!hits || !Number.isFinite(startRenderOffset) || !Number.isFinite(endRenderOffset) || endRenderOffset <= startRenderOffset) return null;
  return { startRenderOffset, endRenderOffset };
}

function buildFocusPlaybackPlan({ parsedTune, focusState, visibleRange, getMeasureStartOffsetByNumber } = {}) {
  const bars = parsedTune && Array.isArray(parsedTune.barMap) ? parsedTune.barMap : [];
  const tuneText = String(parsedTune && parsedTune.text ? parsedTune.text : "");
  const byNumber = (parsedTune && parsedTune.byNumber && typeof parsedTune.byNumber.get === "function")
    ? parsedTune.byNumber
    : null;
  const state = focusState || {};
  const from = Number(state.fromMeasure);
  const to = Number(state.toMeasure);
  const hasFrom = Number.isFinite(from) && from >= 1;
  const hasTo = Number.isFinite(to) && to >= 1;
  const findMeasureStart = typeof getMeasureStartOffsetByNumber === "function"
    ? getMeasureStartOffsetByNumber
    : () => null;

  if (!bars.length) {
    if (hasFrom || hasTo) {
      return { ok: false, reason: "Cannot resolve bar boundaries for multi-voice selection." };
    }
    const fullStart = Math.max(0, Number(parsedTune && parsedTune.firstMeasureOffset) || 0);
    const fullEnd = Math.max(fullStart + 1, tuneText.length);
    const endOffset = Boolean(state.loop) ? fullEnd : null;
    return {
      ok: true,
      plan: {
        mode: "visible",
        startBarIndex: 0,
        endBarIndex: 0,
        startOffset: fullStart,
        endOffset,
        suppressRepeats: Boolean(state.suppressRepeats),
        mutedVoices: Array.isArray(state.mutedVoices) ? state.mutedVoices.slice() : [],
        loop: Boolean(state.loop),
      },
    };
  }

  let mode = "visible";
  let startBarIndex = null;
  let endBarIndex = null;
  let byNumberRange = null;

  const noSegmentLimits = !hasFrom && !hasTo;
  if (noSegmentLimits) {
    const firstMeasureOffset = Number(parsedTune && parsedTune.firstMeasureOffset);
    const firstBarStart = Number(bars[0] && bars[0].startOffset);
    let fullStart = Number.isFinite(firstMeasureOffset) ? firstMeasureOffset : firstBarStart;
    if (!Number.isFinite(fullStart)) fullStart = 0;
    fullStart = Math.max(0, Math.min(tuneText.length, fullStart));
    const fullEnd = Math.max(fullStart + 1, tuneText.length);
    const endOffset = Boolean(state.loop) ? fullEnd : null;
    return {
      ok: true,
      plan: {
        mode: "visible",
        startBarIndex: 0,
        endBarIndex: bars.length - 1,
        startOffset: fullStart,
        endOffset,
        suppressRepeats: Boolean(state.suppressRepeats),
        mutedVoices: Array.isArray(state.mutedVoices) ? state.mutedVoices.slice() : [],
        loop: Boolean(state.loop),
      },
    };
  }

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
    if (!visibleBars) {
      startBarIndex = 0;
      endBarIndex = bars.length - 1;
    } else {
      startBarIndex = visibleBars.startBarIndex;
      endBarIndex = visibleBars.endBarIndex;
    }
  }

  const startBar = bars[startBarIndex];
  const endBar = bars[endBarIndex];
  if (!startBar || !endBar) {
    return { ok: false, reason: "Cannot resolve Focus playback boundaries." };
  }
  let startOffset = Number(startBar.startOffset);
  let endOffset = Number(endBar.endOffset);
  if (mode === "visible") {
    const nextBar = bars[endBarIndex + 1] || null;
    const nextStart = Number(nextBar && nextBar.startOffset);
    if (Number.isFinite(nextStart) && nextStart > startOffset) {
      endOffset = nextStart;
    }
  }
  if (mode === "segment" && byNumberRange) {
    const renderOffset = getFocusBarMapRenderOffset(bars);
    const max = Math.max(0, tuneText.length);
    if (Number.isFinite(renderOffset) && Number.isFinite(Number(byNumberRange.startRenderOffset))) {
      const exactStart = Math.floor(Number(byNumberRange.startRenderOffset) - Number(renderOffset));
      startOffset = Math.max(0, Math.min(max, exactStart));
    }
    let boundaryRender = null;
    if (Number.isFinite(Number(byNumberRange.endBoundaryRenderOffset))) {
      boundaryRender = Number(byNumberRange.endBoundaryRenderOffset);
    } else if (Number.isFinite(Number(endBar.endRenderOffset))) {
      boundaryRender = Number(endBar.endRenderOffset);
    } else if (Number.isFinite(renderOffset) && Number.isFinite(Number(endBar.endOffset))) {
      boundaryRender = Number(renderOffset) + Number(endBar.endOffset);
    }
    if (Number.isFinite(renderOffset) && Number.isFinite(boundaryRender)) {
      const exactEnd = Math.floor(boundaryRender - Number(renderOffset));
      endOffset = Math.max(0, Math.min(max, exactEnd));
    } else if (Number.isFinite(boundaryRender)) {
      const boundaryIdx = findFocusBarIndexAtOrAfterStart(bars, boundaryRender);
      if (boundaryIdx >= 0) {
        const boundaryBar = bars[boundaryIdx];
        if (boundaryBar && Number.isFinite(Number(boundaryBar.startOffset))) {
          endOffset = Number(boundaryBar.startOffset);
        }
      }
    } else if (Number.isFinite(Number(endBar.endOffset))) {
      endOffset = Number(endBar.endOffset);
    }
  }
  if (mode === "segment") {
    const textStartOffset = findMeasureStart(tuneText, from);
    const textEndOffsetExclusive = findMeasureStart(tuneText, to + 1);
    if (from === 1 && Number.isFinite(Number(textStartOffset)) && Number(textStartOffset) >= 0) {
      startOffset = Number(textStartOffset);
    }
    if (!byNumberRange
      && Number.isFinite(Number(textEndOffsetExclusive))
      && Number(textEndOffsetExclusive) > startOffset) {
      endOffset = Number(textEndOffsetExclusive);
    }
  }

  const endBarStart = Number(endBar.startOffset);
  const nextBar = bars[endBarIndex + 1] || null;
  const nextBarStart = Number(nextBar && nextBar.startOffset);
  if (Number.isFinite(nextBarStart) && nextBarStart > endBarStart && (!Number.isFinite(endOffset) || endOffset < nextBarStart)) {
    endOffset = nextBarStart;
  }
  if (Number.isFinite(endBarStart) && (!Number.isFinite(endOffset) || endOffset <= endBarStart)) {
    const tuneLen = Math.max(0, tuneText.length);
    endOffset = Math.max(endBarStart + 1, tuneLen);
  }
  const firstMeasureOffset = Number(parsedTune && parsedTune.firstMeasureOffset);
  const mustAnchorToFirstMeasure = (mode === "segment" && Number(state.fromMeasure) === 1);
  if (mustAnchorToFirstMeasure
    && Number.isFinite(firstMeasureOffset)
    && firstMeasureOffset >= 0
    && firstMeasureOffset < startOffset) {
    startOffset = firstMeasureOffset;
  }
  if (
    mode === "segment"
    && byNumberRange
    && Number.isFinite(Number(startBar.startOffset))
    && Number.isFinite(Number(endBar.endOffset))
    && (!Number.isFinite(endOffset) || endOffset <= startOffset)
  ) {
    startOffset = Number(startBar.startOffset);
    endOffset = Number(endBar.endOffset);
  }
  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset <= startOffset) {
    return { ok: false, reason: "Cannot resolve Focus playback boundaries." };
  }
  if (mode === "visible" && !Boolean(state.suppressRepeats)) {
    const extendedEnd = extendVisibleRangeToRepeatClose(tuneText, startOffset, endOffset);
    if (Number.isFinite(extendedEnd) && extendedEnd > endOffset) endOffset = extendedEnd;
  }
  if (mode === "segment" && !Boolean(state.suppressRepeats) && focusRangeCrossesRepeats(tuneText, startOffset, endOffset)) {
    return { ok: false, reason: "Selection crosses repeats; enable 'Suppress repeats' or adjust range." };
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

export {
  buildFocusBarIndexMap,
  buildFocusBarIndexMapFromElements,
  buildFocusPlaybackPlan,
  findFocusBarIndexAtOrAfterStart,
  getFocusBarMapRenderOffset,
  getFocusMeasureStartCandidates,
  getVisibleFocusRenderRangeFromElements,
  normalizeFocusBarStarts,
  readFocusBarRangesFromElements,
  resolveFocusSegmentBarsByNumber,
  resolveVisibleFocusBarRange,
};
