function createFileHeaderController({
  elements = {},
  editorDeps = {},
  createRectSelectionExtension = () => [],
  toggleLineComments = () => false,
  abcHighlight = [],
  getActiveFileEntry = () => null,
  isChordProEnabled = () => false,
  scheduleRenderNow = () => {},
  setDirtyIndicator = () => {},
  logError = () => {},
} = {}) {
  const {
    panel = null,
    editorHost = null,
    toggleButton = null,
    stateMarker = null,
  } = elements;
  const {
    EditorView,
    EditorState,
    basicSetup,
    keymap,
    indentUnit,
  } = editorDeps;

  let editorView = null;
  let collapsed = true;
  let dirty = false;
  let suppressDirty = false;
  let editorFilePath = null;
  let renderTimer = null;

  function getEditorView() {
    return editorView;
  }

  function isDirty() {
    return Boolean(dirty);
  }

  function setClean() {
    dirty = false;
  }

  function getCollapsed() {
    return Boolean(collapsed);
  }

  function setEditorFilePath(filePath) {
    editorFilePath = filePath || null;
  }

  function getEditorFilePath() {
    return editorFilePath || null;
  }

  function resetEditorFilePath() {
    editorFilePath = null;
  }

  function setEditorValue(text) {
    if (!editorView) return;
    if (text != null && typeof text !== "string") {
      logError("[abcarus] setHeaderEditorValue received non-string; dropped:", Object.prototype.toString.call(text));
      return;
    }
    const doc = editorView.state.doc;
    editorView.dispatch({
      changes: { from: 0, to: doc.length, insert: text || "" },
    });
  }

  function getEditorValue() {
    if (!editorView) return "";
    return editorView.state.doc.toString();
  }

  function setEditorValueClean(text, filePath = null) {
    suppressDirty = true;
    setEditorValue(text);
    suppressDirty = false;
    dirty = false;
    if (filePath !== null) editorFilePath = filePath || null;
  }

  function setCollapsed(nextCollapsed) {
    collapsed = Boolean(nextCollapsed);
    if (panel) panel.classList.toggle("collapsed", collapsed);
  }

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  function computePresence() {
    const entry = getActiveFileEntry();
    if (!entry) return "none";
    const currentHeader = getEditorValue();
    const hasHeader = Boolean(String(currentHeader || "").trim());
    if (hasHeader || dirty) return "present";
    return "none";
  }

  function updateStateUi({ announce = false } = {}) {
    const presence = computePresence();
    const state = (presence === "present")
      ? (dirty ? "present_dirty" : "present_clean")
      : "none";

    if (toggleButton) {
      toggleButton.classList.toggle("present", presence === "present");
      toggleButton.classList.toggle("dirty", Boolean(dirty));
      if (state === "none") {
        toggleButton.title = "No file header in this file.";
      } else if (state === "present_clean") {
        toggleButton.title = "File header present (affects rendering & playback).";
      } else {
        toggleButton.title = "File header modified (unsaved) — affects rendering & playback.";
      }
    }
    if (stateMarker) {
      stateMarker.textContent = (state === "none") ? "—" : (state === "present_clean" ? "✓" : "✓*");
    }

    setDirtyIndicator();
    void announce;
  }

  function initEditor() {
    if (editorView || !editorHost) return;
    if (!EditorView || !EditorState || !basicSetup || !keymap || !indentUnit) return;
    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      if (suppressDirty) return;
      dirty = true;
      updateStateUi();
      if (renderTimer) clearTimeout(renderTimer);
      renderTimer = setTimeout(() => {
        renderTimer = null;
        scheduleRenderNow();
      }, 300);
    });
    const state = EditorState.create({
      doc: "",
      extensions: [
        basicSetup,
        createRectSelectionExtension(),
        abcHighlight,
        keymap.of([{ key: "Mod-/", run: toggleLineComments }]),
        updateListener,
        EditorState.tabSize.of(2),
        indentUnit.of("  "),
      ],
    });
    editorView = new EditorView({
      state,
      parent: editorHost,
    });
  }

  function updatePanel() {
    if (!panel || !editorHost) return;
    initEditor();
    if (isChordProEnabled()) {
      panel.classList.add("active");
      setEditorValueClean("", "");
      updateStateUi();
      if (toggleButton) toggleButton.title = "ChordPro file (no ABC file header).";
      return;
    }
    const entry = getActiveFileEntry();
    if (!entry) {
      panel.classList.remove("active");
      setEditorValueClean("", "");
      updateStateUi();
      return;
    }
    panel.classList.add("active");
    const nextHeaderText = entry.headerText || "";
    const currentHeaderText = getEditorValue();
    if (editorFilePath !== entry.path) {
      setEditorValueClean(nextHeaderText, entry.path || "");
    } else if (!dirty && !String(currentHeaderText || "").trim() && String(nextHeaderText || "").trim()) {
      setEditorValueClean(nextHeaderText);
    }
    updateStateUi({ announce: true });
  }

  return {
    computePresence,
    getCollapsed,
    getEditorFilePath,
    getEditorValue,
    getEditorView,
    initEditor,
    isDirty,
    resetEditorFilePath,
    setClean,
    setCollapsed,
    setEditorFilePath,
    setEditorValue,
    setEditorValueClean,
    toggleCollapsed,
    updatePanel,
    updateStateUi,
  };
}

export {
  createFileHeaderController,
};
