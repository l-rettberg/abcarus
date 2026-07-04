function createErrorsSvgHighlightController({
  highlightState,
  getOutputElement,
  getRenderPaneElement,
  getEditorText,
  getLastRenderPayload,
  findMeasureRangeAt,
  mapEditorOffsetToRenderIdx,
  pickClosestNoteElement,
  maybeScrollRenderToNote,
} = {}) {
  const className = "svg-error-activation";

  function clear() {
    if (highlightState && typeof highlightState.clearSvgElements === "function") {
      highlightState.clearSvgElements(className);
    }
  }

  function activateElements(elements, renderIdx) {
    if (!highlightState || typeof highlightState.setSvgElements !== "function") return false;
    clear();
    const activeEls = highlightState.setSvgElements(Array.from(elements || []));
    for (const el of activeEls) {
      try { el.classList.add(className); } catch {}
    }
    const chosen = typeof pickClosestNoteElement === "function" ? pickClosestNoteElement(activeEls) : null;
    if (chosen && typeof maybeScrollRenderToNote === "function") maybeScrollRenderToNote(chosen);
    if (typeof highlightState.setLastSvgRenderIdx === "function") {
      highlightState.setLastSvgRenderIdx(renderIdx);
    }
    return activeEls.length > 0;
  }

  function highlightAtEditorOffset(editorOffset) {
    const out = typeof getOutputElement === "function" ? getOutputElement() : null;
    const renderPane = typeof getRenderPaneElement === "function" ? getRenderPaneElement() : null;
    if (!out || !renderPane) return false;
    if (!Number.isFinite(editorOffset)) return false;
    if (typeof mapEditorOffsetToRenderIdx !== "function") return false;
    const renderIdx = mapEditorOffsetToRenderIdx(editorOffset);

    if (typeof getEditorText === "function" && typeof findMeasureRangeAt === "function") {
      try {
        const editorText = getEditorText();
        const measure = findMeasureRangeAt(editorText, editorOffset);
        const barEls = measure ? Array.from(out.querySelectorAll(".bar-hl")) : [];
        if (measure && barEls.length) {
          const start = mapEditorOffsetToRenderIdx(measure.start);
          const end = mapEditorOffsetToRenderIdx(measure.end);
          const hits = barEls.filter((el) => {
            const s = Number(el.dataset && el.dataset.start);
            return Number.isFinite(s) && s >= start && s < end;
          });
          if (hits.length) return activateElements(hits, start);
        }
      } catch {}
    }

    let els = out.querySelectorAll(`._${renderIdx}_`);
    if ((!els || !els.length) && Number.isFinite(renderIdx)) {
      const maxBack = 200;
      for (let d = 1; d <= maxBack; d += 1) {
        const probe = renderIdx - d;
        if (probe < 0) break;
        els = out.querySelectorAll(`._${probe}_`);
        if (els && els.length) break;
      }
    }
    if (!els || !els.length) return false;
    return activateElements(Array.from(els), renderIdx);
  }

  return {
    clear,
    highlightAtEditorOffset,
  };
}

export {
  createErrorsSvgHighlightController,
};
