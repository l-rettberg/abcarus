export function createDuplicateTuneAction({
  api = null,
  state = {},
  actions = {},
} = {}) {
  const {
    isWorkingCopyOpenForFile = () => false,
  } = state;

  const {
    attachTuneUidsToLibraryFile = () => {},
    ensureCopyTitleInAbc = (text) => text,
    findTuneById = () => null,
    markActiveTuneButton = () => {},
    markDiskConflictPath = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    readFile = async () => ({ ok: false }),
    refreshLibraryFile = async () => null,
    refreshWorkingCopySnapshot = async () => null,
    renumberXInTextKeepingFirst = () => ({ ok: false }),
    requireCleanForFileOp = async () => false,
    selectTune = async () => {},
    setActiveFilePath = () => {},
    setActiveTuneId = () => {},
    setActiveTuneText = () => {},
    setFileContentInCache = () => {},
    setStatus = () => {},
    showSaveError = async () => {},
    syncLibraryFileFromWorkingCopySnapshot = () => {},
    withFileLock = async (_path, fn) => fn(),
    writeFile = async () => ({ ok: false }),
  } = actions;

  async function duplicateTuneById(tuneId) {
    const res = findTuneById(tuneId);
    if (!res) return;
    if (!(await requireCleanForFileOp(res.file.path, "duplicating a tune"))) return;
    try {
      if (
        isWorkingCopyOpenForFile(res.file.path)
        && api
        && typeof api.openWorkingCopy === "function"
        && typeof api.insertWorkingCopyTuneAfter === "function"
        && typeof api.renumberWorkingCopyXStartingAt1 === "function"
        && typeof api.commitWorkingCopyToDisk === "function"
      ) {
        const opened = await api.openWorkingCopy(res.file.path);
        if (!opened || !opened.ok) {
          throw new Error((opened && opened.error) ? opened.error : "Unable to open working copy for duplication.");
        }
        let snapshot = await refreshWorkingCopySnapshot();
        if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, res.file.path) || !Array.isArray(snapshot.tunes)) {
          throw new Error("Unable to access working copy for duplication.");
        }
        attachTuneUidsToLibraryFile(res.file.path, snapshot);
        const refreshed = findTuneById(tuneId);
        const sourceTune = refreshed && refreshed.tune ? refreshed.tune : res.tune;
        const sourceUid = sourceTune && sourceTune.tuneUid ? String(sourceTune.tuneUid) : "";
        if (!sourceUid) throw new Error("Refusing to duplicate: stable tune identity is missing.");
        const tuneIndex = snapshot.tunes.findIndex((t) => t && t.tuneUid === sourceUid);
        if (tuneIndex < 0) throw new Error("Unable to duplicate: tune UID not found.");

        const wcTune = snapshot.tunes[tuneIndex];
        const start = Number(wcTune.start);
        const end = Number(wcTune.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Unable to duplicate: tune slice is invalid.");
        const slice = String(snapshot.text || "").slice(start, end);
        const prepared = ensureCopyTitleInAbc(slice);

        const insertRes = await api.insertWorkingCopyTuneAfter({
          afterTuneUid: sourceUid,
          text: prepared,
          expectedPath: res.file.path,
          expectedVersion: snapshot.version,
        });
        if (!insertRes || !insertRes.ok) throw new Error((insertRes && insertRes.error) ? insertRes.error : "Unable to duplicate tune.");

        snapshot = await refreshWorkingCopySnapshot();
        if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, res.file.path) || !Array.isArray(snapshot.tunes)) {
          throw new Error("Unable to refresh working copy after duplication.");
        }
        const insertedUid = (snapshot.tunes[tuneIndex + 1] && snapshot.tunes[tuneIndex + 1].tuneUid)
          ? snapshot.tunes[tuneIndex + 1].tuneUid
          : null;

        const renRes = await api.renumberWorkingCopyXStartingAt1({
          expectedPath: res.file.path,
          expectedVersion: snapshot.version,
        });
        if (!renRes || !renRes.ok) throw new Error((renRes && renRes.error) ? renRes.error : "Unable to renumber file after duplication.");

        snapshot = await refreshWorkingCopySnapshot();
        if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, res.file.path)) {
          throw new Error("Unable to refresh working copy after renumber.");
        }

        let saveRes = await api.commitWorkingCopyToDisk({
          force: false,
          expectedPath: res.file.path,
          expectedVersion: snapshot.version,
        });
        if (!saveRes || !saveRes.ok) {
          if (saveRes && saveRes.conflict) {
            markDiskConflictPath(res.file.path, true);
            throw new Error("Refusing to duplicate: file changed on disk. Reload/reopen the file and try again.");
          }
        }
        if (!saveRes || !saveRes.ok) {
          throw new Error((saveRes && saveRes.error) ? saveRes.error : "Unable to save file after duplication.");
        }

        setFileContentInCache(res.file.path, snapshot.text);
        syncLibraryFileFromWorkingCopySnapshot(res.file.path, snapshot);
        await refreshLibraryFile(res.file.path, { force: true });
        setActiveFilePath(res.file.path);
        if (insertedUid) {
          await selectTune(insertedUid, { skipConfirm: true, suppressRecent: true });
        }
        setStatus("OK");
        return;
      }

      const updated = await withFileLock(res.file.path, async () => {
        const readRes = await readFile(res.file.path);
        if (!readRes || !readRes.ok) throw new Error(readRes && readRes.error ? readRes.error : "Unable to read file.");
        const content = String(readRes.data || "");
        const verifyRes = await readFile(res.file.path);
        if (!verifyRes || !verifyRes.ok) throw new Error(verifyRes && verifyRes.error ? verifyRes.error : "Unable to verify file.");
        if (String(verifyRes.data || "") !== content) {
          throw new Error("Refusing to duplicate: file changed on disk. Refresh/reopen the file and try again.");
        }
        const startOffset = Number(res.tune.startOffset);
        const endOffset = Number(res.tune.endOffset);
        if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || startOffset < 0 || endOffset <= startOffset || endOffset > content.length) {
          throw new Error("Refusing to duplicate: tune offsets look stale. Refresh the library and try again.");
        }
        const slice = content.slice(startOffset, endOffset);
        const trimmed = slice.replace(/^\s+/, "");
        if (!/^\s*X:/.test(trimmed)) {
          throw new Error("Refusing to duplicate: tune offsets look stale. Refresh the library and try again.");
        }
        const expectedX = res.tune && res.tune.xNumber != null ? String(res.tune.xNumber).trim() : "";
        const sliceXMatch = trimmed.match(/^X:\s*([^\r\n]*)/);
        const sliceX = sliceXMatch ? String(sliceXMatch[1] || "").trim() : "";
        if (expectedX && sliceX !== expectedX) {
          throw new Error(`Refusing to duplicate: expected X:${expectedX}, found X:${sliceX || "?"}.`);
        }

        const newline = content.includes("\r\n") ? "\r\n" : "\n";
        let before = content.slice(0, endOffset);
        let after = content.slice(endOffset);
        let prepared = ensureCopyTitleInAbc(slice);
        if (prepared && !/\r?\n$/.test(prepared)) prepared += newline;
        if (before && !/\r?\n$/.test(before)) before += newline;
        if (/^\r?\n/.test(prepared) && /\r?\n$/.test(before)) prepared = prepared.replace(/^\r?\n/, "");
        if (/^\r?\n/.test(after) && /\r?\n$/.test(prepared)) after = after.replace(/^\r?\n/, "");

        const inserted = `${before}${prepared}${after}`;
        const renum = renumberXInTextKeepingFirst(inserted);
        if (!renum || !renum.ok || typeof renum.abcText !== "string") {
          throw new Error("Unable to renumber file after duplicating a tune.");
        }
        const updatedContent = renum.abcText;
        const writeRes = await writeFile(res.file.path, updatedContent, { expectedData: content });
        if (!writeRes || !writeRes.ok) throw new Error(writeRes && writeRes.error ? writeRes.error : "Unable to duplicate tune.");
        setFileContentInCache(res.file.path, updatedContent);
        const updatedFile = await refreshLibraryFile(res.file.path, { force: true });
        return { updatedContent, updatedFile };
      });
      const updatedContent = updated ? updated.updatedContent : null;
      const updatedFile = updated ? updated.updatedFile : null;
      setActiveFilePath(res.file.path);
      if (updatedFile && updatedFile.tunes && updatedFile.tunes.length) {
        const fallbackOriginalIdx = Number.isFinite(Number(res.tune.indexInFile)) ? Number(res.tune.indexInFile) - 1 : null;
        const originalIdx = fallbackOriginalIdx != null
          ? fallbackOriginalIdx
          : (Array.isArray(res.file.tunes) ? res.file.tunes.findIndex((t) => t && t.id === res.tune.id) : -1);
        const duplicateIdx = originalIdx >= 0 ? originalIdx + 1 : -1;
        const tune = (duplicateIdx >= 0 && duplicateIdx < updatedFile.tunes.length)
          ? updatedFile.tunes[duplicateIdx]
          : updatedFile.tunes[updatedFile.tunes.length - 1];
        setActiveTuneId(tune.id);
        markActiveTuneButton(tune.id);
        const tuneText = updatedContent ? updatedContent.slice(tune.startOffset, tune.endOffset) : "";
        setActiveTuneText(tuneText, {
          id: tune.id,
          path: updatedFile.path,
          basename: updatedFile.basename,
          xNumber: tune.xNumber,
          title: tune.title || "",
          composer: tune.composer || "",
          key: tune.key || "",
          startLine: tune.startLine,
          endLine: tune.endLine,
          startOffset: tune.startOffset,
          endOffset: tune.endOffset,
        });
      }
      setStatus("OK");
    } catch (e) {
      await showSaveError(e && e.message ? e.message : String(e));
    }
  }

  return {
    duplicateTuneById,
  };
}
