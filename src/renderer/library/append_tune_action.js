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
  readFile = async () => ({ ok: false }),
  writeFile = async () => ({ ok: false }),
  refreshLibraryFile = async () => null,
  setActiveFilePath = () => {},
  selectTune = async () => {},
  getNextXNumber = () => 1,
  ensureXNumberInAbc = (text) => text,
  markDiskConflictPath = () => {},
  confirmAppendToFile = async () => false,
  requireCleanForFileOp = async () => true,
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
      const res = findTuneById(tuneId);
      if (!res || !res.file || !res.file.path) {
        showToast("Tune not found.", 2400);
        return;
      }
      if (pathsEqual(res.file.path, targetPath)) {
        showToast("Tune is already in the active file.", 2600);
        return;
      }
      if (!(await requireCleanForFileOp(targetPath, "appending a tune"))) return;

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
        const readRes = await readFile(targetPath);
        if (!readRes || !readRes.ok) {
          throw new Error((readRes && readRes.error) ? readRes.error : "Unable to read append target.");
        }
        const before = String(readRes.data || "");
        const nextX = getNextXNumber(before);
        const prepared = ensureXNumberInAbc(tuneText, nextX);
        const newline = before.includes("\r\n") ? "\r\n" : "\n";
        const tune = String(prepared || "").replace(/\s+$/, "");
        const separator = !before.trim()
          ? ""
          : (before.endsWith("\n\n") ? "" : (before.endsWith("\n") ? newline : `${newline}${newline}`));
        const updated = `${before}${separator}${tune}${newline}`;
        const saveRes = await writeFile(targetPath, updated, { expectedData: before });
        if (!saveRes || !saveRes.ok) {
          if (saveRes && saveRes.conflict) markDiskConflictPath(targetPath, true);
          throw new Error((saveRes && saveRes.error) ? saveRes.error : "Unable to save file.");
        }
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
