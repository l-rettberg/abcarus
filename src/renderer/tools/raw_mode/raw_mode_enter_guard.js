function createRawModeEnterGuard({
  api = null,
  state = {},
  actions = {},
  utils = {},
} = {}) {
  const {
    getActiveFilePath = () => "",
    getActiveTuneMeta = () => null,
    getCurrentDocument = () => null,
    getCurrentDocumentPath = () => "",
    getHeaderDirty = () => false,
    getIsCurrentDocumentDirty = () => false,
    getIsNewTuneDraft = () => false,
    getWorkingCopySnapshot = () => null,
  } = state;

  const {
    ensureSafeToAbandonCurrentDoc = async () => true,
    findHeaderEndOffset = () => 0,
    getActiveFileEntry = () => null,
    getEditorValue = () => "",
    getHeaderEditorValue = () => "",
    markDiskConflictPath = () => {},
    markHeaderClean = () => {},
    patchCurrentDocument = () => {},
    refreshWorkingCopySnapshot = async () => null,
    setDirtyIndicator = () => {},
    updateHeaderStateUI = () => {},
  } = actions;

  const {
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
  } = utils;

  async function normalizeCleanStateBeforeRaw(filePath, fullTextArg) {
    const p = String(filePath || "");
    if (!p) return;
    const fullText = String(fullTextArg || "");
    const activeTuneMeta = getActiveTuneMeta();
    const currentDoc = getCurrentDocument();
    const activePath = (activeTuneMeta && activeTuneMeta.path)
      ? String(activeTuneMeta.path || "")
      : String(getActiveFilePath() || getCurrentDocumentPath() || "");
    if (!activePath || !pathsEqual(activePath, p)) return;

    if (currentDoc && currentDoc.dirty && activeTuneMeta && activeTuneMeta.path && pathsEqual(activeTuneMeta.path, p)) {
      const start = Number(activeTuneMeta.startOffset);
      const end = Number(activeTuneMeta.endOffset);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start && end <= fullText.length) {
        const diskTuneText = fullText.slice(start, end);
        if (String(getEditorValue() || "") === diskTuneText || String(currentDoc.content || "") === diskTuneText) {
          patchCurrentDocument({ content: diskTuneText, dirty: false }, { create: false });
        }
      }
    }

    if (getHeaderDirty()) {
      const entry = getActiveFileEntry();
      const headerEnd = entry && pathsEqual(entry.path, p) && Number.isFinite(Number(entry.headerEndOffset))
        ? Number(entry.headerEndOffset)
        : findHeaderEndOffset(fullText);
      const diskHeaderText = fullText.slice(0, Math.max(0, headerEnd));
      if (String(getHeaderEditorValue() || "") === diskHeaderText) {
        markHeaderClean();
        updateHeaderStateUI();
      }
    }

    const snapshot = getWorkingCopySnapshot();
    if (snapshot && snapshot.dirty && snapshot.path && pathsEqual(snapshot.path, p) && String(snapshot.text || "") === fullText) {
      try {
        if (api && typeof api.reloadWorkingCopyFromDisk === "function") {
          await api.reloadWorkingCopyFromDisk({ force: true });
          await refreshWorkingCopySnapshot();
          markDiskConflictPath(p, false);
        }
      } catch {}
    }

    setDirtyIndicator(getIsCurrentDocumentDirty());
  }

  async function ensureSafeToEnterRaw(filePath, contextLabel) {
    const p = String(filePath || "");
    if (getIsNewTuneDraft()) return ensureSafeToAbandonCurrentDoc(contextLabel || "switching to raw mode");
    const currentDoc = getCurrentDocument();
    if (!currentDoc || !currentDoc.dirty) return true;
    const activeTuneMeta = getActiveTuneMeta();
    const activePath = (activeTuneMeta && activeTuneMeta.path)
      ? String(activeTuneMeta.path || "")
      : String(currentDoc.path || getActiveFilePath() || "");
    if (p && activePath && pathsEqual(activePath, p)) return true;
    return ensureSafeToAbandonCurrentDoc(contextLabel || "switching to raw mode");
  }

  return {
    ensureSafeToEnterRaw,
    normalizeCleanStateBeforeRaw,
  };
}

export {
  createRawModeEnterGuard,
};
