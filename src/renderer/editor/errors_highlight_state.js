import {
  computeErrorId,
  normalizeErrorMessageForMatch,
} from "./errors_model.js";

function clampRange(from, to, max) {
  const docLen = Math.max(0, Number(max) || 0);
  const a = Math.max(0, Math.min(Number(from), docLen));
  const b = Math.max(a, Math.min(Number(to), docLen));
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return { from: a, to: b };
}

export function createErrorsHighlightState() {
  let active = null;
  let range = null;
  let version = 0;
  let suppressClear = false;
  let svgEls = [];

  return {
    getActive() {
      return active;
    },

    getRange() {
      return range ? { ...range } : null;
    },

    getVersion() {
      return version;
    },

    hasActive() {
      return Boolean(active);
    },

    setActive(entry, from, to, docLen) {
      const nextRange = clampRange(from, to, docLen);
      if (!nextRange) return null;
      const id = computeErrorId(entry);
      if (!id) return null;
      active = {
        id,
        from: nextRange.from,
        to: nextRange.to,
        tuneId: entry && entry.tuneId ? entry.tuneId : null,
        filePath: entry && entry.filePath ? entry.filePath : null,
        message: entry && entry.message ? entry.message : null,
        messageKey: normalizeErrorMessageForMatch(entry && entry.message ? entry.message : ""),
        lastSvgRenderIdx: null,
      };
      range = nextRange;
      version += 1;
      return active;
    },

    clear() {
      const prev = active;
      active = null;
      range = null;
      version += 1;
      return prev;
    },

    mapRange(changes, docLen) {
      if (!active || !range || !changes || typeof changes.mapPos !== "function") return null;
      const oldFrom = Number(range.from);
      const oldTo = Number(range.to);
      if (!Number.isFinite(oldFrom) || !Number.isFinite(oldTo) || oldTo <= oldFrom) return null;
      const mapped = clampRange(changes.mapPos(oldFrom, 1), changes.mapPos(oldTo, -1), docLen);
      if (!mapped) return null;
      range = mapped;
      active.from = mapped.from;
      active.to = mapped.to;
      return mapped;
    },

    setLastSvgRenderIdx(renderIdx) {
      if (active && Number.isFinite(Number(renderIdx))) {
        active.lastSvgRenderIdx = Number(renderIdx);
      }
    },

    getSvgElements() {
      return svgEls.slice();
    },

    setSvgElements(elements) {
      svgEls = Array.isArray(elements) ? elements.filter(Boolean) : [];
      return svgEls.slice();
    },

    clearSvgElements(removeClassName) {
      for (const el of svgEls) {
        try {
          if (removeClassName && el && el.classList) el.classList.remove(removeClassName);
        } catch {}
      }
      svgEls = [];
    },

    isSuppressingClear() {
      return suppressClear;
    },

    setSuppressClear(next) {
      suppressClear = Boolean(next);
    },
  };
}
