export function createScoreInteractionController({
  outputElement = null,
  renderPane = null,
  getEditorView = () => null,
  getActiveHighlight = () => null,
  mapEditorOffsetToRenderIdx = (value) => value,
  mapRenderIdxToEditorOffset = (value) => value,
  pickClosestNoteElement = () => null,
  setEditorSelectionRange = () => {},
  setPendingPlaybackRangeOrigin = () => {},
  getPlaybackRange = () => ({ loop: false }),
  setPlaybackRange = () => {},
} = {}) {
  let outputSelectionWired = false;

  function centerCurrentAnchor() {
    const editorView = getEditorView();
    if (!outputElement || !renderPane || !editorView) return false;
    const activeHighlight = getActiveHighlight();
    const editorOffset = activeHighlight && Number.isFinite(activeHighlight.from)
      ? activeHighlight.from
      : editorView.state.selection.main.anchor;
    const renderIdx = mapEditorOffsetToRenderIdx(Number(editorOffset));
    if (!Number.isFinite(renderIdx)) return false;

    let elements = outputElement.querySelectorAll(`._${renderIdx}_`);
    if (!elements || !elements.length) {
      for (let delta = 1; delta <= 200; delta += 1) {
        const probe = renderIdx - delta;
        if (probe < 0) break;
        elements = outputElement.querySelectorAll(`._${probe}_`);
        if (elements && elements.length) break;
      }
    }
    if (!elements || !elements.length) return false;
    const chosen = pickClosestNoteElement(Array.from(elements));
    if (!chosen) return false;

    const containerRect = renderPane.getBoundingClientRect();
    const targetRect = chosen.getBoundingClientRect();
    const centerTop = (
      targetRect.top
      - containerRect.top
      + renderPane.scrollTop
      - (renderPane.clientHeight / 2)
      + (targetRect.height / 2)
    );
    const centerLeft = (
      targetRect.left
      - containerRect.left
      + renderPane.scrollLeft
      - (renderPane.clientWidth / 2)
      + (targetRect.width / 2)
    );
    renderPane.scrollTop = Math.max(0, centerTop);
    renderPane.scrollLeft = Math.max(0, centerLeft);
    return true;
  }

  function handleOutputClick(event) {
    const target = event && event.target;
    if (!target || !target.classList || !target.classList.contains("note-hl")) return false;
    const start = Number(target.dataset && target.dataset.start);
    const end = Number(target.dataset && target.dataset.end);
    if (!Number.isFinite(start)) return false;

    const editorStart = Math.max(0, mapRenderIdxToEditorOffset(start));
    const editorEndRaw = Number.isFinite(end) && end > start ? end : start + 1;
    const editorEnd = Math.max(editorStart, mapRenderIdxToEditorOffset(editorEndRaw));
    setPendingPlaybackRangeOrigin("svg");
    setEditorSelectionRange(editorStart, editorEnd);
    const playbackRange = getPlaybackRange() || {};
    setPlaybackRange({
      startOffset: editorStart,
      endOffset: editorEnd,
      origin: "svg",
      loop: Boolean(playbackRange.loop),
    });
    return true;
  }

  function wireOutputSelection() {
    if (outputSelectionWired || !outputElement || typeof outputElement.addEventListener !== "function") {
      return false;
    }
    outputSelectionWired = true;
    outputElement.addEventListener("click", handleOutputClick);
    return true;
  }

  return {
    centerCurrentAnchor,
    handleOutputClick,
    wireOutputSelection,
  };
}
