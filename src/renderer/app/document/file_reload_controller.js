function createFileReloadController({ api = null, state = {}, actions = {}, utils = {} } = {}) {
  const { getRawMode = () => false } = state;
  const {
    refreshLibraryFile = async () => null,
    readFile = async () => ({ ok: false }),
    selectTune = async () => {},
    setDirtyIndicator = () => {},
    setEditorValueClean = () => {},
    setHeaderClean = () => {},
    setHeaderEditorValueClean = () => {},
    setRawModeFilePath = () => {},
    setRawModeHeaderEndOffset = () => {},
    updateHeaderStateUI = () => {},
    patchCurrentDocument = () => {},
    markDiskConflictPath = () => {},
    splitFileIntoHeaderAndBody = (text) => ({ headerText: "", bodyText: String(text || "") }),
  } = actions;

  async function confirmReloadFromDisk(filePath) {
    if (!api || typeof api.confirmReloadFromDisk !== "function") return false;
    return Boolean(await api.confirmReloadFromDisk(filePath));
  }

  async function discardAndReloadFileFromDisk(filePath, { restoreTuneId = null } = {}) {
    const p = String(filePath || "");
    if (!p) return { ok: false, error: "Missing file path." };
    const disk = await readFile(p);
    if (!disk || !disk.ok) return { ok: false, error: disk && disk.error ? disk.error : "Unable to read file from disk." };
    const text = String(disk.data || "");
    const updatedFile = await refreshLibraryFile(p, { force: true });
    if (updatedFile && Number.isFinite(updatedFile.headerEndOffset)) setRawModeHeaderEndOffset(updatedFile.headerEndOffset);
    if (getRawMode()) {
      const parts = splitFileIntoHeaderAndBody(text);
      setHeaderEditorValueClean(parts.headerText);
      setEditorValueClean(parts.bodyText);
      setHeaderClean();
      updateHeaderStateUI();
      patchCurrentDocument({ path: p, content: parts.bodyText, dirty: false }, { create: false });
      setRawModeFilePath(p);
    } else if (restoreTuneId) {
      try { await selectTune(restoreTuneId, { skipConfirm: true, suppressRecent: true }); } catch {}
    }
    setDirtyIndicator(false);
    markDiskConflictPath(p, false);
    return { ok: true, updatedFile };
  }

  return { confirmReloadFromDisk, discardAndReloadFileFromDisk };
}

export { createFileReloadController };
