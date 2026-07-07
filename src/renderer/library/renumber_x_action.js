export function createRenumberXAction({
  api = null,
  state = {},
  actions = {},
} = {}) {
  const {
    getActiveFilePath = () => "",
    getActiveTuneIndex = () => null,
    getActiveTuneMeta = () => null,
    getActiveTuneUid = () => null,
    getCurrentDocumentPath = () => "",
    getHeaderDirty = () => false,
    getIsNewTuneDraft = () => false,
    getLibraryIndex = () => null,
    getRawMode = () => false,
    isCurrentDocumentDirty = () => false,
    isWorkingCopyOpenForFile = () => false,
  } = state;

  const {
    attachTuneUidsToLibraryFile = () => {},
    flushWorkingCopyTuneSync = async () => {},
    getActiveFileEntry = () => null,
    hasUnsavedChangesForFile = () => false,
    markCurrentDocumentClean = () => {},
    markDiskConflictPath = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    patchCurrentDocument = () => {},
    readFile = async () => ({ ok: false }),
    refreshLibraryFile = async () => null,
    refreshWorkingCopySnapshot = async () => null,
    renumberXLinesConsecutive = () => ({ ok: false }),
    resetWorkingCopyTuneSyncDebounce = () => {},
    scheduleRenderLibraryTree = () => {},
    selectTune = async () => {},
    setDirtyIndicator = () => {},
    setFileContentInCache = () => {},
    setStatus = () => {},
    showSaveError = async () => {},
    showToast = () => {},
    updateFileContext = () => {},
    withFileLock = async (_path, fn) => fn(),
    writeFile = async () => ({ ok: false }),
  } = actions;

  async function renumberXInActiveFile(explicitFilePath) {
    const activeTuneMeta = getActiveTuneMeta();
    const filePath = explicitFilePath
      || ((activeTuneMeta && activeTuneMeta.path) ? activeTuneMeta.path : null)
      || (getActiveFilePath() || getCurrentDocumentPath() || null);
    if (!filePath) {
      showToast("No active file selected.", 2200);
      return;
    }

    if (getRawMode()) {
      showToast("Raw mode: switch to tune mode to renumber.", 2400);
      return;
    }

    const activePath = (activeTuneMeta && activeTuneMeta.path)
      ? String(activeTuneMeta.path)
      : (getActiveFilePath() ? String(getActiveFilePath()) : "");
    const globalDirty = isCurrentDocumentDirty() || getHeaderDirty() || Boolean(getIsNewTuneDraft());
    const isTargetActive = Boolean(activePath && pathsEqual(activePath, filePath));

    if (globalDirty && !isTargetActive) {
      await showSaveError("Please Save/Discard your current changes before renumbering another file.");
      return;
    }
    if (hasUnsavedChangesForFile(filePath)) {
      await showSaveError("Renumber X is disabled while the file has unsaved changes. Save/Discard first.");
      return;
    }

    if (!isTargetActive && !isWorkingCopyOpenForFile(filePath)) {
      try {
        await withFileLock(filePath, async () => {
          const readRes = await readFile(filePath);
          if (!readRes || !readRes.ok) throw new Error((readRes && readRes.error) ? readRes.error : "Unable to read file.");
          const before = String(readRes.data || "");
          const verifyRes = await readFile(filePath);
          if (!verifyRes || !verifyRes.ok) throw new Error((verifyRes && verifyRes.error) ? verifyRes.error : "Unable to verify file.");
          if (String(verifyRes.data || "") !== before) throw new Error("Refusing to renumber: file changed on disk. Refresh/reopen and try again.");
          const ren = renumberXLinesConsecutive(before);
          if (!ren || !ren.ok) throw new Error((ren && ren.error) ? ren.error : "Unable to renumber X.");
          const writeRes = await writeFile(filePath, ren.text);
          if (!writeRes || !writeRes.ok) throw new Error((writeRes && writeRes.error) ? writeRes.error : "Unable to write file.");
          setFileContentInCache(filePath, ren.text);
        });
        await refreshLibraryFile(filePath, { force: true });
        setStatus("Renumbered X.");
        return;
      } catch (e) {
        await showSaveError(e && e.message ? e.message : String(e));
        return;
      }
    }

    try {
      if (api && typeof api.openWorkingCopy === "function") {
        await api.openWorkingCopy(filePath);
        const snapshot = await refreshWorkingCopySnapshot();
        if (snapshot && snapshot.path && pathsEqual(snapshot.path, filePath)) {
          attachTuneUidsToLibraryFile(filePath, snapshot);
        }
      }
    } catch {}

    try { await flushWorkingCopyTuneSync(); } catch {}

    if (!api || typeof api.renumberWorkingCopyXStartingAt1 !== "function") {
      await showSaveError("Working copy renumber API is unavailable.");
      return;
    }

    const prevIndex = Number.isFinite(Number(getActiveTuneIndex())) ? Number(getActiveTuneIndex()) : null;
    const prevUid = getActiveTuneUid();
    const prevFileEntry = getActiveFileEntry();
    const prevTuneCount = prevFileEntry && Array.isArray(prevFileEntry.tunes) ? prevFileEntry.tunes.length : 0;

    const res = await api.renumberWorkingCopyXStartingAt1();
    if (!res || !res.ok) {
      await showSaveError((res && res.error) ? res.error : "Unable to renumber X.");
      return;
    }

    const snapshot = await refreshWorkingCopySnapshot();
    if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, filePath)) {
      await showSaveError("Unable to refresh working copy after renumber.");
      return;
    }

    setFileContentInCache(filePath, snapshot.text);
    attachTuneUidsToLibraryFile(filePath, snapshot);
    scheduleRenderLibraryTree();
    updateFileContext();

    const libraryIndex = getLibraryIndex();
    const fileEntry = libraryIndex && Array.isArray(libraryIndex.files)
      ? libraryIndex.files.find((f) => pathsEqual(f.path, filePath))
      : null;
    const tunes = fileEntry && Array.isArray(fileEntry.tunes) ? fileEntry.tunes : [];
    const countSame = Boolean(prevTuneCount && Array.isArray(snapshot.tunes) && snapshot.tunes.length === prevTuneCount);

    const candidate = (() => {
      const latestActiveTuneMeta = getActiveTuneMeta();
      if (prevUid && countSame) return tunes.find((t) => t && t.tuneUid === prevUid) || null;
      if (latestActiveTuneMeta && latestActiveTuneMeta.path && pathsEqual(latestActiveTuneMeta.path, filePath)) {
        const startOff = Number.isFinite(Number(latestActiveTuneMeta.startOffset)) ? Number(latestActiveTuneMeta.startOffset) : null;
        if (startOff != null) return tunes.find((t) => Number(t.startOffset) === startOff) || null;
      }
      if (prevIndex != null) return tunes[Math.max(0, Math.min(tunes.length - 1, prevIndex))] || null;
      return tunes.length ? tunes[0] : null;
    })();

    if (candidate) {
      const key = candidate.tuneUid || candidate.id;
      if (key) {
        resetWorkingCopyTuneSyncDebounce();
        await selectTune(key, { skipConfirm: true, suppressRecent: true });
      }
    }

    if (api && typeof api.commitWorkingCopyToDisk === "function") {
      const saveRes = await api.commitWorkingCopyToDisk({ force: false });
      if (!saveRes || !saveRes.ok) {
        await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to save file after renumber.");
        patchCurrentDocument({ dirty: true }, { create: false });
        setDirtyIndicator(true);
        setStatus("Renumbered X (unsaved).");
        return;
      }
      markDiskConflictPath(filePath, false);
      const snapAfterSave = await refreshWorkingCopySnapshot();
      if (snapAfterSave && snapAfterSave.path && pathsEqual(snapAfterSave.path, filePath)) {
        setFileContentInCache(filePath, snapAfterSave.text);
        attachTuneUidsToLibraryFile(filePath, snapAfterSave);
        scheduleRenderLibraryTree();
      }
      markCurrentDocumentClean();
      setDirtyIndicator(false);
      setStatus("Renumbered X.");
      return;
    }

    patchCurrentDocument({ dirty: true }, { create: false });
    setDirtyIndicator(true);
    setStatus("Renumbered X (unsaved).");
  }

  return {
    renumberXInActiveFile,
  };
}
