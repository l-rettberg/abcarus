function createLibraryDocumentContext({
  activeTuneContext = null,
  markActiveTuneButton = () => {},
  markCurrentDocumentClean = () => {},
  setActiveFilePath = () => {},
  setActiveTuneId = () => {},
  setActiveTuneIndex = () => {},
  setActiveTuneMeta = () => {},
  setActiveTuneText = () => {},
  setActiveTuneUid = () => {},
  setCurrentDocument = () => {},
  setDirtyIndicator = () => {},
} = {}) {
  function setActiveFile(filePath) {
    if (activeTuneContext && typeof activeTuneContext.setActiveFilePath === "function") {
      activeTuneContext.setActiveFilePath(filePath);
      return;
    }
    setActiveFilePath(filePath || null);
  }

  function clearActiveTune() {
    if (activeTuneContext && typeof activeTuneContext.clearTune === "function") {
      activeTuneContext.clearTune();
      return;
    }
    setActiveTuneId(null);
    setActiveTuneUid(null);
    setActiveTuneIndex(null);
    setActiveTuneMeta(null);
  }

  function setActiveTuneIdOnly(tuneId) {
    if (activeTuneContext && typeof activeTuneContext.setActiveTuneId === "function") {
      activeTuneContext.setActiveTuneId(tuneId);
      return;
    }
    setActiveTuneId(tuneId || null);
  }

  function setActiveTuneTextForLibrary(text, metadata, options = {}) {
    setActiveTuneText(text, metadata || null, options);
  }

  function showCleanFileDocument(filePath, content = "") {
    const text = String(content || "");
    setActiveTuneTextForLibrary(text, null, { suppressRecent: true });
    setCurrentDocument({ path: filePath || null, dirty: false, content: text });
    clearActiveTune();
    markCurrentDocumentClean();
    setDirtyIndicator(false);
    markActiveTuneButton(null);
  }

  return {
    clearActiveTune,
    setActiveFile,
    setActiveTuneIdOnly,
    setActiveTuneTextForLibrary,
    showCleanFileDocument,
  };
}

export {
  createLibraryDocumentContext,
};
