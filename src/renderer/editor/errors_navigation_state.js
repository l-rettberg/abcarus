function findNearestErrorIndex(items, activeHighlight) {
  if (!activeHighlight) return -1;
  const targetPos = Number.isFinite(activeHighlight.from) ? activeHighlight.from : 0;
  const targetTune = activeHighlight.tuneId ? String(activeHighlight.tuneId) : "";
  let bestIdx = -1;
  let bestDist = Infinity;

  const consider = (x, idx) => {
    const dist = Math.abs((Number.isFinite(x.pos) ? x.pos : targetPos) - targetPos);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = idx;
    }
  };

  if (targetTune) {
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const tuneId = it.entry && it.entry.tuneId ? String(it.entry.tuneId) : "";
      if (tuneId !== targetTune) continue;
      consider(it, i);
    }
  }
  if (bestIdx === -1) {
    for (let i = 0; i < items.length; i += 1) consider(items[i], i);
  }
  return bestIdx;
}

export function createErrorsNavigationState({ noErrorsToastCooldownMs = 2000 } = {}) {
  let activeIndex = -1;
  let lastNoErrorsToastAtMs = 0;

  return {
    getActiveIndex() {
      return activeIndex;
    },

    setActiveIndex(index) {
      activeIndex = Number.isFinite(Number(index)) ? Number(index) : -1;
    },

    sync(itemsArg, activeHighlight = null) {
      const items = Array.isArray(itemsArg) ? itemsArg : [];
      if (!items.length) {
        activeIndex = -1;
        return activeIndex;
      }

      if (activeHighlight && activeHighlight.id) {
        const found = items.findIndex((x) => x.id === activeHighlight.id);
        if (found !== -1) {
          activeIndex = found;
          return activeIndex;
        }
        const nearest = findNearestErrorIndex(items, activeHighlight);
        if (nearest !== -1) {
          activeIndex = nearest;
          return activeIndex;
        }
      }

      if (activeIndex >= items.length) activeIndex = items.length - 1;
      if (activeIndex < -1) activeIndex = -1;
      return activeIndex;
    },

    nextIndex(itemsArg, delta) {
      const items = Array.isArray(itemsArg) ? itemsArg : [];
      if (!items.length) return -1;
      const step = delta >= 0 ? 1 : -1;
      if (!Number.isFinite(activeIndex) || activeIndex < 0) {
        activeIndex = step > 0 ? 0 : items.length - 1;
      } else {
        activeIndex = (activeIndex + step + items.length) % items.length;
      }
      return activeIndex;
    },

    shouldShowNoErrorsToast(nowMs = Date.now()) {
      const now = Number(nowMs);
      if (!Number.isFinite(now)) return false;
      if (lastNoErrorsToastAtMs && now - lastNoErrorsToastAtMs <= noErrorsToastCooldownMs) return false;
      lastNoErrorsToastAtMs = now;
      return true;
    },
  };
}
