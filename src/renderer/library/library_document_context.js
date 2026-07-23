function createLibraryDocumentContext({
  clearSaveSession = () => {},
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
    setActiveFilePath(filePath || null);
  }

  function clearActiveTune() {
    setActiveTuneId(null);
    setActiveTuneUid(null);
    setActiveTuneIndex(null);
    setActiveTuneMeta(null);
  }

  function setActiveTuneIdOnly(tuneId) {
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
    clearSaveSession();
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
