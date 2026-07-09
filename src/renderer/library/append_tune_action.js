function createAppendTuneToActiveFileAction({
  api = null,
  getActiveTuneMeta = () => null,
  getCurrentDocDirty = () => false,
  getHeaderDirty = () => false,
  getRawMode = () => false,
  findTuneById = () => null,
  getTuneText = async () => "",
  pathsEqual = (a, b) => String(a || "") === String(b || ""),
  withFileLock = async (_path, fn) => fn(),
  refreshWorkingCopySnapshot = async () => null,
  markDiskConflictPath = () => {},
  setFileContentInCache = () => {},
  syncLibraryFileFromWorkingCopySnapshot = () => {},
  appendTuneTextToFileUnlocked = async () => {},
  refreshLibraryFile = async () => null,
  setActiveFilePath = () => {},
  selectTune = async () => {},
  getNextXNumber = () => 1,
  ensureXNumberInAbc = (text) => text,
  confirmAppendToFile = async () => false,
  showToast = () => {},
} = {}) {
  async function run(tuneId) {
    try {
      const activeTuneMeta = getActiveTuneMeta();
      const targetPath = (activeTuneMeta && activeTuneMeta.path)
        ? String(activeTuneMeta.path)
        : "";
      if (!targetPath) {
        showToast("No active file to append to.", 2400);
        return;
      }
      if (getRawMode()) {
        showToast("Raw mode: switch to tune mode to append.", 2400);
        return;
      }
      if (getCurrentDocDirty() || getHeaderDirty()) {
        showToast("Save the active file first, then append.", 3200);
        return;
      }

      const res = findTuneById(tuneId);
      if (!res || !res.file || !res.file.path) {
        showToast("Tune not found.", 2400);
        return;
      }
      if (pathsEqual(res.file.path, targetPath)) {
        showToast("Tune is already in the active file.", 2600);
        return;
      }

      const tuneText = await getTuneText(res.tune, res.file);
      const label = (() => {
        const title = res.tune.title || res.tune.preview || "";
        const x = res.tune.xNumber ? `X:${res.tune.xNumber}` : "";
        return `${x} ${title}`.trim() || "Untitled";
      })();
      const confirm = (api && typeof api.confirmAppendToFileDetailed === "function")
        ? await api.confirmAppendToFileDetailed(targetPath, label)
        : await confirmAppendToFile(targetPath);
      if (confirm !== "append") return;

      await withFileLock(targetPath, async () => {
        if (
          api
          && typeof api.openWorkingCopy === "function"
          && typeof api.insertWorkingCopyTuneAfter === "function"
          && typeof api.commitWorkingCopyToDisk === "function"
        ) {
          await api.openWorkingCopy(targetPath);
          const snap = await refreshWorkingCopySnapshot();
          if (!snap || !snap.path || !pathsEqual(snap.path, targetPath)) {
            throw new Error("Unable to open working copy for appending.");
          }
          const nextX = getNextXNumber(String(snap.text || ""));
          const prepared = ensureXNumberInAbc(tuneText, nextX);
          const afterTuneIndex = Array.isArray(snap.tunes) ? (snap.tunes.length - 1) : -1;
          const ins = await api.insertWorkingCopyTuneAfter({ afterTuneIndex, text: prepared });
          if (!ins || !ins.ok) throw new Error((ins && ins.error) ? ins.error : "Unable to append.");
          let saved = await api.commitWorkingCopyToDisk({ force: false });
          if (!saved || !saved.ok) {
            if (saved && saved.conflict) {
              markDiskConflictPath(targetPath, true);
              throw new Error("Refusing to append: file changed on disk. Reload/reopen the file and try again.");
            }
          }
          if (!saved || !saved.ok) {
            throw new Error((saved && saved.error) ? saved.error : "Unable to save file.");
          }
          const snapAfter = await refreshWorkingCopySnapshot();
          if (snapAfter && snapAfter.path && pathsEqual(snapAfter.path, targetPath)) {
            setFileContentInCache(targetPath, snapAfter.text);
            syncLibraryFileFromWorkingCopySnapshot(targetPath, snapAfter);
          }
          return;
        }
        await appendTuneTextToFileUnlocked(targetPath, tuneText);
      });

      const updatedFile = await refreshLibraryFile(targetPath, { force: true });
      setActiveFilePath(targetPath);
      if (updatedFile && updatedFile.tunes && updatedFile.tunes.length) {
        const last = updatedFile.tunes[updatedFile.tunes.length - 1];
        if (last && last.id) await selectTune(last.tuneUid || last.id, { skipConfirm: true });
      }
      showToast("Appended.", 2000);
    } catch (e) {
      showToast(e && e.message ? e.message : String(e), 5000);
    }
  }

  return { run };
}

export {
  createAppendTuneToActiveFileAction,
};
