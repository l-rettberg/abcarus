import {
  computeErrorId,
  normalizeErrorMessageForMatch,
} from "./errors_model.js";

function findRangeForEntry(entry, { getEditorIndexFromLoc, getDocLength } = {}) {
  if (!entry) return null;
  if (Number.isFinite(entry.errorStartOffset) && Number.isFinite(entry.errorEndOffset) && entry.errorEndOffset > entry.errorStartOffset) {
    return { from: entry.errorStartOffset, to: entry.errorEndOffset };
  }
  if (entry.measureRange && Number.isFinite(entry.measureRange.start) && Number.isFinite(entry.measureRange.end) && entry.measureRange.end > entry.measureRange.start) {
    return { from: entry.measureRange.start, to: entry.measureRange.end };
  }
  if (entry.loc && Number.isFinite(entry.loc.line) && typeof getEditorIndexFromLoc === "function") {
    const pos = getEditorIndexFromLoc(entry.loc);
    if (Number.isFinite(pos)) {
      const max = typeof getDocLength === "function" ? Number(getDocLength()) : 0;
      return { from: pos, to: Math.min(pos + 1, Math.max(0, max)) };
    }
  }
  return null;
}

function findNearestNavIndex(items, previousActive) {
  if (!previousActive || !Array.isArray(items) || !items.length) return -1;
  const targetPos = Number.isFinite(previousActive.from) ? previousActive.from : 0;
  const targetTune = previousActive.tuneId ? String(previousActive.tuneId) : "";
  let bestIdx = -1;
  let bestDist = Infinity;
  const consider = (item, idx) => {
    const dist = Math.abs((Number.isFinite(item.pos) ? item.pos : targetPos) - targetPos);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = idx;
    }
  };
  if (targetTune) {
    for (let i = 0; i < items.length; i += 1) {
      const tuneId = items[i].entry && items[i].entry.tuneId ? String(items[i].entry.tuneId) : "";
      if (tuneId === targetTune) consider(items[i], i);
    }
  }
  if (bestIdx === -1) {
    for (let i = 0; i < items.length; i += 1) consider(items[i], i);
  }
  return bestIdx;
}

function createErrorsActivationController({
  highlightState,
  navigationState,
  getSortedItems,
  getEntries,
  getEditorView,
  getEditorIndexFromLoc,
  clearSvgHighlight,
  clearFocusMessage,
  setFocusMessage,
  refreshPopover,
  highlightSvgAtEditorOffset,
  logError,
} = {}) {
  function syncNavIndex(sortedItemsArg) {
    const items = Array.isArray(sortedItemsArg)
      ? sortedItemsArg
      : (typeof getSortedItems === "function" ? getSortedItems() : []);
    navigationState.sync(items, highlightState.getActive());
  }

  function clear(reason) {
    const allowed = new Set(["resolved", "abandon", "switch", "docReplaced"]);
    if (!allowed.has(reason) && typeof logError === "function") {
      logError("[abcarus] Error highlight cleared for disallowed reason:", reason);
    }
    const prev = highlightState.clear();
    navigationState.setActiveIndex(-1);
    if (reason === "resolved" && prev) {
      const items = typeof getSortedItems === "function" ? getSortedItems() : [];
      const bestIdx = findNearestNavIndex(items, prev);
      if (bestIdx !== -1) navigationState.setActiveIndex(bestIdx);
    }
    if (typeof clearSvgHighlight === "function") clearSvgHighlight();
    if (typeof clearFocusMessage === "function") clearFocusMessage();
    const editorView = typeof getEditorView === "function" ? getEditorView() : null;
    if (!editorView) return;
    highlightState.setSuppressClear(true);
    editorView.dispatch({
      selection: editorView.state.selection,
      scrollIntoView: false,
    });
    setTimeout(() => { highlightState.setSuppressClear(false); }, 0);
  }

  function set(entry, from, to) {
    const editorView = typeof getEditorView === "function" ? getEditorView() : null;
    if (!editorView) return;
    const id = computeErrorId(entry);
    if (!id) return;

    const active = highlightState.getActive();
    if (active && active.id !== id) clear("switch");

    const next = highlightState.setActive(entry, from, to, editorView.state.doc.length);
    if (!next) return;
    syncNavIndex();
    if (typeof setFocusMessage === "function") setFocusMessage(entry, next.from);
    if (typeof refreshPopover === "function") refreshPopover();
  }

  function reconcileAfterRender({ renderSucceeded = false } = {}) {
    const active = highlightState.getActive();
    const editorView = typeof getEditorView === "function" ? getEditorView() : null;
    if (!active || !editorView) return;
    const entries = typeof getEntries === "function" ? getEntries() : [];
    if (!Array.isArray(entries) || !entries.length) {
      if (renderSucceeded) clear("resolved");
      return;
    }
    const candidates = entries.filter((entry) => {
      if (!entry) return false;
      if (active.tuneId && entry.tuneId && entry.tuneId !== active.tuneId) return false;
      if (active.filePath && entry.filePath && entry.filePath !== active.filePath) return false;
      return normalizeErrorMessageForMatch(entry.message || "") === String(active.messageKey || "");
    });
    if (!candidates.length) {
      clear("resolved");
      return;
    }

    let best = null;
    let bestDist = Infinity;
    for (const entry of candidates) {
      const range = findRangeForEntry(entry, {
        getEditorIndexFromLoc,
        getDocLength: () => editorView.state.doc.length,
      });
      if (!range) continue;
      const dist = Math.abs(range.from - active.from);
      if (dist < bestDist) {
        bestDist = dist;
        best = { entry, range };
      }
    }
    if (!best) return;

    const from = Number(best.range.from);
    const to = Number(best.range.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
    if (from !== active.from || to !== active.to) {
      set(best.entry, from, to);
      if (typeof highlightSvgAtEditorOffset === "function") highlightSvgAtEditorOffset(from);
    } else if (typeof setFocusMessage === "function") {
      setFocusMessage(best.entry, from);
    }
  }

  return {
    clear,
    reconcileAfterRender,
    set,
    syncNavIndex,
  };
}

export {
  createErrorsActivationController,
};
