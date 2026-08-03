export function createMidiEditorAdapter({
  documentRef = null,
  getMainEditorView = () => null,
  getHeaderEditorView = () => null,
  EditorSelectionRef = null,
} = {}) {
  function getActiveEditorView() {
    const activeElement = documentRef ? documentRef.activeElement : null;
    const headerView = getHeaderEditorView();
    if (headerView && headerView.dom && activeElement && headerView.dom.contains(activeElement)) return headerView;
    const mainView = getMainEditorView();
    if (mainView && mainView.dom && activeElement && mainView.dom.contains(activeElement)) return mainView;
    return null;
  }

  function cursor(position) {
    return EditorSelectionRef && typeof EditorSelectionRef.cursor === "function"
      ? EditorSelectionRef.cursor(position)
      : { anchor: position };
  }

  function insertTextAtCursor(text, userEvent = "input") {
    const view = getActiveEditorView();
    if (!view || !text) return false;
    const selection = view.state.selection.main;
    const insert = String(text);
    const position = selection.from + insert.length;
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: cursor(position),
      userEvent,
    });
    return true;
  }

  function deleteCharBeforeCursor() {
    const view = getActiveEditorView();
    if (!view) return false;
    const selection = view.state.selection.main;
    if (!selection.empty) {
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: "" },
        selection: cursor(selection.from),
        userEvent: "delete",
      });
      return true;
    }
    if (selection.from <= 0) return false;
    const from = selection.from - 1;
    view.dispatch({
      changes: { from, to: selection.from, insert: "" },
      selection: cursor(from),
      userEvent: "delete",
    });
    return true;
  }

  return {
    deleteCharBeforeCursor,
    getActiveEditorView,
    insertTextAtCursor,
  };
}
