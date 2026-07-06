function createDocumentLifecycleController({
  elements = {},
  state = {},
  actions = {},
  constants = {},
} = {}) {
  const {
    output = null,
  } = elements;

  const {
    getRawMode = () => false,
  } = state;

  const {
    setRawModeUi = () => {},
    setChordProMode = () => {},
    resetChordProState = () => {},
    resetRawModeState = () => {},
    setSuppressDirty = () => {},
    setEditorText = () => {},
    scheduleRender = () => {},
    setRenderBusy = () => {},
    clearActiveTuneState = () => {},
    clearSaveSession = () => {},
    markHeaderClean = () => {},
    setTuneMetaText = () => {},
    setFileNameMeta = () => {},
    clearErrors = () => {},
    setStatus = () => {},
    updateFileHeaderPanel = () => {},
    updateHeaderStateUi = () => {},
  } = actions;

  const {
    untitledLabel = "Untitled",
  } = constants;

  function setEditorTextClean(text) {
    setSuppressDirty(true);
    setEditorText(String(text || ""));
    setSuppressDirty(false);
  }

  function applyDocumentToUi(doc) {
    setEditorTextClean(doc ? doc.content : "");
    if (!getRawMode()) scheduleRender({ clearOutput: true });
  }

  function showEmptyState() {
    setRawModeUi(false);
    setChordProMode(false);
    resetChordProState();
    resetRawModeState();
    setEditorTextClean("");
    if (output) output.innerHTML = "";
    setRenderBusy(false);
    clearActiveTuneState();
    clearSaveSession();
    markHeaderClean();
    setTuneMetaText(untitledLabel);
    setFileNameMeta(untitledLabel);
    clearErrors();
    setStatus("Ready");
    updateFileHeaderPanel();
    updateHeaderStateUi();
  }

  return {
    applyDocumentToUi,
    showEmptyState,
  };
}

export {
  createDocumentLifecycleController,
};
