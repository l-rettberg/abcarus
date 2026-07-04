import {
  EditorSelection,
  EditorView,
} from "../../../third_party/codemirror/cm.js";

function resolveErrorRangeInDoc(doc, errItem) {
  if (!doc || !errItem) return null;
  const docLen = doc.length;
  let start = Number(errItem.errorStartOffset);
  let end = Number(errItem.errorEndOffset);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    const loc = errItem.loc || null;
    if (loc && Number.isFinite(loc.line)) {
      const lineNo = Math.max(1, Math.min(doc.lines, Number(loc.line)));
      const line = doc.line(lineNo);
      const col = Number.isFinite(loc.col) ? Math.max(1, Number(loc.col)) : 1;
      const pos = Math.max(line.from, Math.min(line.to, line.from + col - 1));
      start = pos;
      end = Math.max(
        Math.min(line.to, pos + 16),
        Math.min(pos + 1, docLen)
      );
    }
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  if (start < 0 || end > docLen) return null;
  return { start, end };
}

function createErrorsJumpController({
  isEnabled,
  showToast,
  getEditorView,
  openTuneFromLibrarySelection,
  selectTune,
  setPendingPlaybackRangeOrigin,
  setActiveHighlight,
  highlightState,
  highlightSvgAtEditorOffset,
  applyPlaybackRangeFromError,
  logError,
} = {}) {
  async function jumpToError(errItem) {
    if (!errItem) return;
    if (typeof isEnabled === "function" && !isEnabled()) {
      if (typeof showToast === "function") showToast("Errors disabled");
      return;
    }
    const targetFilePath = errItem.filePath || null;
    const targetTuneId = errItem.tuneId || null;
    if (targetFilePath && targetTuneId && typeof openTuneFromLibrarySelection === "function") {
      const res = await openTuneFromLibrarySelection({ filePath: targetFilePath, tuneId: targetTuneId });
      if (!res || !res.ok) return;
    } else if (targetTuneId && typeof selectTune === "function") {
      await selectTune(targetTuneId);
    }

    const editorView = typeof getEditorView === "function" ? getEditorView() : null;
    if (!editorView) return;
    const range = resolveErrorRangeInDoc(editorView.state.doc, errItem);
    if (!range) {
      if (typeof logError === "function") {
        logError("[abcarus] Error activation missing/invalid offsets:", {
          errorStartOffset: errItem.errorStartOffset,
          errorEndOffset: errItem.errorEndOffset,
          loc: errItem.loc || null,
          docLen: editorView.state.doc.length,
        });
      }
      return;
    }

    const { start, end } = range;
    if (typeof setPendingPlaybackRangeOrigin === "function") setPendingPlaybackRangeOrigin("error");
    if (typeof setActiveHighlight === "function") setActiveHighlight(errItem, start, end);
    if (highlightState && typeof highlightState.setSuppressClear === "function") {
      highlightState.setSuppressClear(true);
    }
    const effects = [];
    if (typeof EditorView.scrollIntoView === "function") {
      try {
        effects.push(EditorView.scrollIntoView(start, { y: "center" }));
      } catch {}
    }
    editorView.dispatch({
      selection: EditorSelection.cursor(start),
      effects,
      scrollIntoView: true,
    });
    setTimeout(() => {
      if (highlightState && typeof highlightState.setSuppressClear === "function") {
        highlightState.setSuppressClear(false);
      }
    }, 0);
    editorView.focus();

    if (typeof highlightSvgAtEditorOffset === "function" && !highlightSvgAtEditorOffset(start)) {
      requestAnimationFrame(() => { highlightSvgAtEditorOffset(start); });
    }

    const msg = String(errItem.message || "");
    if (/bad measure duration/i.test(msg) && typeof applyPlaybackRangeFromError === "function") {
      applyPlaybackRangeFromError({ ...errItem, errorStartOffset: start, errorEndOffset: end });
    }
  }

  return {
    jumpToError,
  };
}

export {
  createErrorsJumpController,
  resolveErrorRangeInDoc,
};
