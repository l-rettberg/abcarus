function createPayloadModeEditorAdapter({
  getEditorView = () => null,
  getEditorText = () => "",
  setEditorText = () => {},
  setSuppressDirty = () => {},
  readOnlyCompartment = null,
  EditorState = null,
  EditorView = null,
} = {}) {
  function getCopyText() {
    const editorView = getEditorView();
    if (!editorView) return { text: "", selectionText: "" };
    const doc = editorView.state.doc;
    const ranges = editorView.state.selection && editorView.state.selection.ranges
      ? editorView.state.selection.ranges
      : [];
    let selectionText = "";
    for (const r of ranges) {
      if (r && Number.isFinite(r.from) && Number.isFinite(r.to) && r.from !== r.to) {
        selectionText = doc.sliceString(r.from, r.to);
        break;
      }
    }
    return { text: selectionText || getEditorText(), selectionText };
  }

  function setEditorValue(text) {
    setSuppressDirty(true);
    setEditorText(text);
    setSuppressDirty(false);
  }

  function setEditorCursor(pos, { scrollIntoView = true } = {}) {
    const editorView = getEditorView();
    if (!editorView) return;
    try {
      const safePos = Math.max(0, Math.min(Number(pos) || 0, editorView.state.doc.length));
      editorView.dispatch({
        selection: { anchor: safePos, head: safePos },
        scrollIntoView,
      });
    } catch {}
  }

  function restoreEditorSelection(selection) {
    const editorView = getEditorView();
    if (!editorView || !selection) return;
    try {
      editorView.dispatch({ selection, scrollIntoView: false });
    } catch {}
  }

  function setEditorReadOnly(enabled) {
    const editorView = getEditorView();
    if (!editorView || !readOnlyCompartment || !EditorState || !EditorView) return;
    try {
      const readonly = Boolean(enabled);
      editorView.dispatch({
        effects: readOnlyCompartment.reconfigure(
          readonly
            ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
            : []
        ),
        scrollIntoView: false,
      });
    } catch {}
  }

  return {
    getCopyText,
    restoreEditorSelection,
    setEditorCursor,
    setEditorReadOnly,
    setEditorValue,
  };
}

export {
  createPayloadModeEditorAdapter,
};
