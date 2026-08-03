export function createDeleteTuneAction({
  state = {},
  actions = {},
} = {}) {
  const {
    getLibraryIndex = () => null,
    getActiveTuneId = () => "",
    getRawMode = () => false,
  } = state;

  const {
    clearActiveTune = () => {},
    confirmDeleteTune = async () => "",
    ensureSafeToAbandonCurrentDoc = async () => false,
    findTuneById = () => null,
    markCurrentDocumentClean = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    refreshLibraryFile = async () => null,
    readFile = async () => ({ ok: false }),
    requireCleanForFileOp = async () => false,
    selectTune = async () => {},
    setActiveFilePath = () => {},
    setDirtyIndicator = () => {},
    showCleanFileDocument = () => {},
    showSaveError = async () => {},
    writeFile = async () => ({ ok: false }),
    withFileLock = async (_path, fn) => fn(),
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

    try {
      const result = await withFileLock(fileMeta.path, async () => {
        const readRes = await readFile(fileMeta.path);
        if (!readRes || !readRes.ok) throw new Error(readRes && readRes.error ? readRes.error : "Unable to read file.");
        const content = String(readRes.data || "");
        const start = Number(selected.startOffset);
        const end = Number(selected.endOffset);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > content.length) {
          throw new Error("Refusing to delete: tune offsets look stale. Refresh the library and try again.");
        }
        const before = content.slice(0, start);
        let after = content.slice(end);
        if (/\r?\n$/.test(before) && /^\r?\n/.test(after)) after = after.replace(/^\r?\n/, "");
        const updatedContent = before + after;
        const writeRes = await writeFile(fileMeta.path, updatedContent, { expectedData: content });
        if (!writeRes || !writeRes.ok) {
          if (writeRes && writeRes.conflict) throw new Error("Refusing to delete: file changed on disk. Reload/reopen the file and try again.");
          throw new Error((writeRes && writeRes.error) ? writeRes.error : "Unable to delete tune.");
        }
        const updatedFile = await refreshLibraryFile(fileMeta.path, { force: true });
        return { updatedContent, updatedFile };
      });
      const updatedFile = result && result.updatedFile;
        setActiveFilePath(fileMeta.path);

        if (getActiveTuneId() === tuneId) {
          clearActiveTune();
        }

        const tunes = updatedFile && Array.isArray(updatedFile.tunes) ? updatedFile.tunes : [];
        if (tunes.length) {
          const prevIndex = Number.isFinite(Number(selected.tuneIndex)) ? Number(selected.tuneIndex) : 0;
          const nextIndex = Math.min(Math.max(0, prevIndex), tunes.length - 1);
          const nextTune = tunes[nextIndex];
          const nextKey = getRawMode() ? nextTune.id : (nextTune.tuneUid || nextTune.id);
          await selectTune(nextKey, { skipConfirm: true, suppressRecent: true });
          markCurrentDocumentClean();
          setDirtyIndicator(false);
        } else {
          const text = String(result && result.updatedContent || "");
          showCleanFileDocument(fileMeta.path, text);
        }
        try { await refreshLibraryFile(fileMeta.path, { force: true }); } catch {}
        return;
    } catch (e) {
      await showSaveError(e && e.message ? e.message : String(e));
      return;
    }
  }

  return {
    deleteTuneById,
  };
}
