function createEditStateController({
  elements = {},
  state = {},
  actions = {},
  utils = {},
} = {}) {
  const {
    dirtyIndicator = null,
    libraryTree = null,
  } = elements;

  const {
    getActiveFilePath = () => "",
    getActiveTuneMeta = () => null,
    getCurrentDoc = () => null,
    getHeaderDirty = () => false,
    getIsNewTuneDraft = () => false,
    getRawMode = () => false,
    getWorkingCopySnapshot = () => null,
  } = state;

  const {
    renderUnifiedStatus = () => {},
    updateWindowTitle = () => {},
  } = actions;

  const {
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
  } = utils;

  function createBlankDocument(content = "") {
    return {
      path: null,
      dirty: false,
      content: String(content || ""),
    };
  }

  function updateLibraryDirtyState(isDirty) {
    const activeFilePath = getActiveFilePath();
    if (!activeFilePath || !libraryTree) return;
    const fileNodes = libraryTree.querySelectorAll(".tree-file");
    for (const node of fileNodes) {
      const label = node.querySelector(".tree-label");
      if (!label) continue;
      const isActive = label.dataset && label.dataset.filePath === activeFilePath;
      node.classList.toggle("dirty", isActive && Boolean(isDirty));
    }
  }

  function setDirtyIndicator(isDirty) {
    if (!dirtyIndicator) return;
    const tuneDirty = Boolean(isDirty);
    const hdrDirty = Boolean(getHeaderDirty());
    if (getRawMode()) {
      if (hdrDirty) {
        dirtyIndicator.textContent = "Header: Unsaved";
        dirtyIndicator.classList.add("active");
      } else {
        dirtyIndicator.textContent = "";
        dirtyIndicator.classList.remove("active");
      }
      updateLibraryDirtyState(tuneDirty || hdrDirty);
      updateWindowTitle();
      renderUnifiedStatus();
      return;
    }

    if (hdrDirty) {
      dirtyIndicator.textContent = tuneDirty ? "Header+Tune: Unsaved" : "Header: Unsaved";
      dirtyIndicator.classList.add("active");
    } else {
      dirtyIndicator.textContent = "";
      dirtyIndicator.classList.remove("active");
    }
    updateLibraryDirtyState(tuneDirty || hdrDirty);
    updateWindowTitle();
    renderUnifiedStatus();
  }

  function getActiveEditFilePath() {
    const activeTuneMeta = getActiveTuneMeta();
    const activeFilePath = getActiveFilePath();
    if (activeTuneMeta && activeTuneMeta.path) return String(activeTuneMeta.path);
    if (activeFilePath) return String(activeFilePath);
    return "";
  }

  function hasGlobalUnsavedChanges() {
    const currentDoc = getCurrentDoc();
    return Boolean(currentDoc && currentDoc.dirty) || Boolean(getHeaderDirty()) || Boolean(getIsNewTuneDraft());
  }

  function hasUnsavedChangesForFile(filePath) {
    const p = String(filePath || "");
    if (!p) return false;
    const activePath = getActiveEditFilePath();
    const activeDirty = hasGlobalUnsavedChanges();
    if (activeDirty && activePath && pathsEqual(activePath, p)) return true;
    const workingCopySnapshot = getWorkingCopySnapshot();
    if (workingCopySnapshot && workingCopySnapshot.dirty && workingCopySnapshot.path && pathsEqual(workingCopySnapshot.path, p)) return true;
    return false;
  }

  function hasUnsavedChangesInActiveEditContext() {
    const activePath = getActiveEditFilePath();
    if (!activePath) return hasGlobalUnsavedChanges();
    return hasUnsavedChangesForFile(activePath);
  }

  return {
    createBlankDocument,
    getActiveEditFilePath,
    hasGlobalUnsavedChanges,
    hasUnsavedChangesForFile,
    hasUnsavedChangesInActiveEditContext,
    setDirtyIndicator,
    updateLibraryDirtyState,
  };
}

export {
  createEditStateController,
};
