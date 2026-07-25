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
  actions = {},
} = {}) {
  const {
    panel = null,
    editorHost = null,
    toggleButton = null,
    saveButton = null,
    reloadButton = null,
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
  let actionsWired = false;

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

  async function handleSaveClick() {
    const entry = getActiveFileEntry();
    if (!entry || !entry.path) {
      if (typeof actions.setStatus === "function") actions.setStatus("No active file to update.");
      return;
    }
    try {
      try {
        if (typeof actions.flushWorkingCopyTuneSync === "function") await actions.flushWorkingCopyTuneSync();
      } catch {}
      const headerRes = typeof actions.saveFileHeaderText === "function"
        ? await actions.saveFileHeaderText(entry.path, getEditorValue())
        : null;
      if (headerRes && headerRes.ok) {
        setClean();
        updateStateUi();
        if (typeof actions.setStatus === "function") {
          actions.setStatus(headerRes.action === "save_copy_as" ? "Saved copy and switched." : "Header saved.");
        }
      } else if (headerRes && headerRes.action === "discard_reload") {
        resetEditorFilePath();
        setClean();
        updateStateUi();
        updatePanel();
        if (typeof actions.setStatus === "function") actions.setStatus("Reloaded from disk.");
      } else {
        if (typeof actions.setStatus === "function") actions.setStatus("Save canceled.");
        updateStateUi();
      }
    } catch (e) {
      if (typeof actions.showSaveError === "function") {
        await actions.showSaveError(e && e.message ? e.message : String(e));
      }
    }
  }

  function handleReloadClick() {
    resetEditorFilePath();
    setClean();
    updatePanel();
  }

  function handleToggleClick() {
    if (!getActiveFileEntry()) {
      if (typeof actions.showToast === "function") actions.showToast("No library file loaded.", 2400);
      return;
    }
    toggleCollapsed();
  }

  function wireActions() {
    if (actionsWired) return;
    actionsWired = true;
    if (saveButton) saveButton.addEventListener("click", () => { handleSaveClick().catch(() => {}); });
    if (reloadButton) reloadButton.addEventListener("click", handleReloadClick);
    if (toggleButton) toggleButton.addEventListener("click", handleToggleClick);
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
    wireActions,
  };
}

export {
  createFileHeaderController,
};
