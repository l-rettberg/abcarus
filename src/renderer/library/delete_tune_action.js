export function createDeleteTuneAction({
  api = null,
  state = {},
  actions = {},
} = {}) {
  const {
    getLibraryIndex = () => null,
    getActiveFilePath = () => "",
    getActiveTuneId = () => "",
    getRawMode = () => false,
    getHeaderDirty = () => false,
    getIsNewTuneDraft = () => false,
    isCurrentDocumentDirty = () => false,
  } = state;

  const {
    attachTuneUidsToLibraryFile = () => {},
    confirmDeleteTune = async () => "",
    countLines = (text) => String(text || "").split(/\r\n|\n|\r/).length,
    discardWorkingCopyChangesForActiveFile = async () => {},
    ensureSafeToAbandonCurrentDoc = async () => false,
    findTuneById = () => null,
    markActiveTuneButton = () => {},
    markCurrentDocumentClean = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    refreshLibraryFile = async () => null,
    refreshWorkingCopySnapshot = async () => null,
    requireCleanForFileOp = async () => false,
    safeBasename = (path) => String(path || "").split("/").pop() || "",
    selectTune = async () => {},
    setActiveFilePath = () => {},
    setActiveTuneId = () => {},
    setActiveTuneIndex = () => {},
    setActiveTuneMeta = () => {},
    setActiveTuneUid = () => {},
    setActiveTuneText = () => {},
    setDirtyIndicator = () => {},
    setFileContentInCache = () => {},
    showSaveError = async () => {},
    syncLibraryFileFromWorkingCopySnapshot = () => null,
  } = actions;

  async function deleteTuneById(tuneId) {
    const libraryIndex = getLibraryIndex();
    if (!libraryIndex || !tuneId) return;
    const ok = await ensureSafeToAbandonCurrentDoc("deleting a tune");
    if (!ok) return;

    const found = findTuneById(tuneId);
    if (!found || !found.tune || !found.file) return;
    let selected = found.tune;
    const fileMeta = found.file;

    const label = selected.title || selected.preview || `X:${selected.xNumber || ""}`.trim();
    const confirm = await confirmDeleteTune(label);
    if (confirm !== "delete") return;

    if (!(await requireCleanForFileOp(fileMeta.path, "deleting a tune"))) return;

    if (
      api
      && typeof api.openWorkingCopy === "function"
      && typeof api.deleteWorkingCopyTune === "function"
      && typeof api.commitWorkingCopyToDisk === "function"
      && fileMeta.path
    ) {
      if (
        pathsEqual(getActiveFilePath(), fileMeta.path)
        && (isCurrentDocumentDirty() || getHeaderDirty() || Boolean(getIsNewTuneDraft()))
      ) {
        await showSaveError("Please Save/Discard your unsaved changes in this file before deleting tunes.");
        return;
      }

      try {
        await api.openWorkingCopy(fileMeta.path);
        const snapshotBefore = await refreshWorkingCopySnapshot();
        if (snapshotBefore && snapshotBefore.path && pathsEqual(snapshotBefore.path, fileMeta.path)) {
          attachTuneUidsToLibraryFile(fileMeta.path, snapshotBefore);
          const refreshed = findTuneById(tuneId);
          if (refreshed && refreshed.tune) selected = refreshed.tune;
        }
      } catch {}

      try {
        const payload = { tuneUid: selected.tuneUid || null, tuneIndex: selected.tuneIndex };
        await api.deleteWorkingCopyTune(payload);

        const saveRes = await api.commitWorkingCopyToDisk({ force: false });
        if (!saveRes || !saveRes.ok) {
          if (saveRes && saveRes.conflict) {
            await showSaveError("Refusing to delete: file changed on disk. Reload/reopen the file and try again.");
            try { await discardWorkingCopyChangesForActiveFile(); } catch {}
            try { await refreshLibraryFile(fileMeta.path, { force: true }); } catch {}
            return;
          }
          await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to delete tune.");
          return;
        }

        const snapshotAfter = await refreshWorkingCopySnapshot();
        if (!snapshotAfter || !snapshotAfter.path || !pathsEqual(snapshotAfter.path, fileMeta.path)) return;

        setFileContentInCache(fileMeta.path, snapshotAfter.text);
        const updatedFile = syncLibraryFileFromWorkingCopySnapshot(fileMeta.path, snapshotAfter);
        setActiveFilePath(fileMeta.path);

        if (getActiveTuneId() === tuneId) {
          setActiveTuneId(null);
          setActiveTuneUid(null);
          setActiveTuneIndex(null);
          setActiveTuneMeta(null);
        }

        const tunes = updatedFile && Array.isArray(updatedFile.tunes) ? updatedFile.tunes : [];
        if (tunes.length) {
          const prevIndex = Number.isFinite(Number(payload.tuneIndex)) ? Number(payload.tuneIndex) : 0;
          const nextIndex = Math.min(Math.max(0, prevIndex), tunes.length - 1);
          const nextTune = tunes[nextIndex];
          const nextKey = getRawMode() ? nextTune.id : (nextTune.tuneUid || nextTune.id);
          await selectTune(nextKey, { skipConfirm: true, suppressRecent: true });
          markCurrentDocumentClean();
          setDirtyIndicator(false);
        } else {
          const text = String(snapshotAfter.text || "");
          const pseudoMeta = {
            id: `${fileMeta.path}::0`,
            path: fileMeta.path,
            basename: fileMeta.basename || safeBasename(fileMeta.path),
            xNumber: "",
            title: "",
            startLine: 1,
            endLine: countLines(text),
            startOffset: 0,
            endOffset: text.length,
          };
          setActiveTuneText(text, pseudoMeta, { suppressRecent: true });
          setActiveTuneId(pseudoMeta.id);
          setActiveTuneUid(null);
          setActiveTuneIndex(null);
          markCurrentDocumentClean();
          setDirtyIndicator(false);
          markActiveTuneButton(pseudoMeta.id);
        }
        try { await refreshLibraryFile(fileMeta.path, { force: true }); } catch {}
        return;
      } catch (e) {
        await showSaveError(e && e.message ? e.message : String(e));
        return;
      }
    }

    await showSaveError("Internal error: working copy delete is unavailable.");
  }

  return {
    deleteTuneById,
  };
}
