import { appendTuneToContent } from "../abc/text_transforms.js";

export function createPasteMoveTuneAction({
  state = {},
  actions = {},
} = {}) {
  const {
    getActiveFilePath = () => "",
    getActiveTuneId = () => "",
    getActiveTuneMeta = () => null,
    getClipboardTune = () => null,
    getHeaderDirty = () => false,
    getIsNewTuneDraft = () => false,
    hasGlobalUnsavedChanges = () => false,
    isCurrentDocumentDirty = () => false,
  } = state;

  const {
    clearClipboardTune = () => {},
    confirmAppendToFile = async () => "",
    ensureXNumberInAbc = (text) => text,
    findTuneById = () => null,
    getActiveEditFilePath = () => "",
    getNextXNumber = () => 1,
    getTuneText = async () => "",
    markDiskConflictPath = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    readFile = async () => ({ ok: false }),
    refreshLibraryFile = async () => null,
    removeTuneFromContent = (text, start, end) => String(text || "").slice(0, start) + String(text || "").slice(end),
    renumberXInTextKeepingFirst = () => ({ ok: false }),
    requireCleanForFileOp = async () => false,
    setActiveFilePath = () => {},
    setActiveTuneId = () => {},
    setClipboardTune = () => {},
    setStatus = () => {},
    selectTune = async () => ({ ok: false }),
    showSaveError = async () => {},
    withFileLock = async (_path, fn) => fn(),
    withFileLocks = async (_paths, fn) => fn(),
    writeFile = async () => ({ ok: false }),
  } = actions;

  async function moveTuneToFile(tuneId, targetPath) {
    if (!tuneId || !targetPath) return;
    const res = findTuneById(tuneId);
    if (!res) return;
    if (pathsEqual(res.file.path, targetPath)) {
      await showSaveError("Target file is the same as source.");
      return;
    }
    try {
      const text = await getTuneText(res.tune, res.file);
      setClipboardTune({
        text,
        sourcePath: res.file.path,
        tuneId,
        mode: "move",
      });
      await pasteClipboardToFile(targetPath);
    } catch (e) {
      await showSaveError(e && e.message ? e.message : String(e));
    }
  }

  async function appendTuneTextToFileUnlocked(filePath, text) {
    const activePath = getActiveEditFilePath();
    if (hasGlobalUnsavedChanges() && activePath && !pathsEqual(activePath, filePath)) {
      throw new Error("Please Save/Discard your current changes before modifying other files.");
    }
    const res = await readFile(filePath);
    if (!res.ok) throw new Error(res.error || "Unable to read file.");
    const before = String(res.data || "");
    const verifyRes = await readFile(filePath);
    if (!verifyRes || !verifyRes.ok) throw new Error((verifyRes && verifyRes.error) ? verifyRes.error : "Unable to verify file before appending.");
    const verifyText = String(verifyRes.data || "");
    if (verifyText !== before) throw new Error("Refusing to append: file changed on disk. Refresh/reopen the file and try again.");
    const nextX = getNextXNumber(res.data || "");
    const prepared = ensureXNumberInAbc(text, nextX);
    const updated = appendTuneToContent(before, prepared);
    const writeRes = await writeFile(filePath, updated, { expectedData: before });
    if (!writeRes.ok) {
      if (writeRes.conflict) markDiskConflictPath(filePath, true);
      throw new Error(writeRes.error || "Unable to append to file.");
    }
    return updated;
  }

  async function appendTuneTextToFile(filePath, text) {
    return withFileLock(filePath, async () => appendTuneTextToFileUnlocked(filePath, text));
  }

  async function pasteClipboardToFile(targetPath) {
    const clipboardTune = getClipboardTune();
    if (!clipboardTune || !clipboardTune.text) {
      await showSaveError("Nothing to paste yet.");
      return;
    }
    if (!targetPath) {
      await showSaveError("Select a target file in the Library panel first.");
      return;
    }
    if (!(await requireCleanForFileOp(targetPath, clipboardTune && clipboardTune.mode === "move" ? "moving a tune" : "pasting a tune"))) {
      return;
    }
    if (clipboardTune.sourcePath && clipboardTune.sourcePath === targetPath) {
      await showSaveError("Target file is the same as source.");
      return;
    }

    if (clipboardTune.mode === "move") {
      const sourcePath = clipboardTune.sourcePath ? String(clipboardTune.sourcePath) : "";
      if (!sourcePath) {
        await showSaveError("Unable to move: source path missing.");
        return;
      }
      if (sourcePath === targetPath) {
        await showSaveError("Target file is the same as source.");
        return;
      }
      if (!(await requireCleanForFileOp(sourcePath, "moving a tune"))) return;

      const found = findTuneById(clipboardTune.tuneId);
      if (!found || !found.file || !found.file.path) {
        await showSaveError("Unable to move: source tune not found. Refresh the library and try again.");
        return;
      }
    }

    const confirm = await confirmAppendToFile(targetPath);
    if (confirm !== "append") return;

    try {
      const sourceCandidate = clipboardTune && clipboardTune.mode === "move" ? clipboardTune.sourcePath : "";
      await withFileLocks([targetPath, sourceCandidate].filter(Boolean), async () => {
        if (clipboardTune.mode !== "move") {
          await appendTuneTextToFileUnlocked(targetPath, clipboardTune.text);
          await refreshLibraryFile(targetPath, { force: true });
          setActiveFilePath(targetPath);
          return;
        }

        const found = findTuneById(clipboardTune.tuneId);
        if (!found || !found.file || !found.file.path) {
          throw new Error("Unable to move: source tune not found. Refresh the library and try again.");
        }
        const sourcePath = found.file.path;
        if (!sourcePath) throw new Error("Unable to move: source path missing.");
        if (sourcePath === targetPath) throw new Error("Target file is the same as source.");

        const hasUnsavedInActiveFile = isCurrentDocumentDirty() || getHeaderDirty() || Boolean(getIsNewTuneDraft());
        const activeTuneMeta = getActiveTuneMeta();
        const activePath = activeTuneMeta && activeTuneMeta.path ? String(activeTuneMeta.path) : (getActiveFilePath() ? String(getActiveFilePath()) : "");
        if (
          activePath
          && hasUnsavedInActiveFile
          && (pathsEqual(activePath, sourcePath) || pathsEqual(activePath, targetPath))
        ) {
          throw new Error("Refusing to move: please Save/Discard your unsaved changes in the source/target file first.");
        }
        let sourceContent = "";
        let startOffset = Number(found.tune.startOffset);
        let endOffset = Number(found.tune.endOffset);
        const sourceRes = await readFile(sourcePath);
        if (!sourceRes.ok) throw new Error(sourceRes.error || "Unable to read source file.");
        sourceContent = String(sourceRes.data || "");

        const targetRes = await readFile(targetPath);
        if (!targetRes.ok) throw new Error(targetRes.error || "Unable to read target file.");
        const targetContent = String(targetRes.data || "");

        if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || startOffset < 0 || endOffset <= startOffset || endOffset > sourceContent.length) {
          throw new Error("Refusing to move: tune offsets look stale. Reload/refresh the library and try again.");
        }

        const sourceSlice = sourceContent.slice(startOffset, endOffset);
        const expectedSlice = String(clipboardTune.text || "");
        if (sourceSlice !== expectedSlice) {
          throw new Error("Refusing to move: tune offsets look stale. Reload/refresh the library and try again.");
        }
        const trimmedSourceSlice = sourceSlice.replace(/^\s+/, "");
        if (!/^\s*X:/.test(trimmedSourceSlice)) {
          throw new Error("Refusing to move: tune offsets look stale. Reload/refresh the library and try again.");
        }

        const nextX = getNextXNumber(targetContent);
        const prepared = ensureXNumberInAbc(expectedSlice, nextX);
        const updatedTarget = appendTuneToContent(targetContent, prepared);
        const renumTarget = renumberXInTextKeepingFirst(updatedTarget);
        if (!renumTarget || !renumTarget.ok || typeof renumTarget.abcText !== "string") {
          throw new Error("Unable to renumber target file after move.");
        }
        const finalTarget = renumTarget.abcText;

        const updatedSource = removeTuneFromContent(sourceContent, startOffset, endOffset);
        let finalSource = updatedSource;
        if (/^[\t ]*X:/m.test(updatedSource)) {
          const renumSource = renumberXInTextKeepingFirst(updatedSource);
          if (!renumSource || !renumSource.ok || typeof renumSource.abcText !== "string") {
            throw new Error("Unable to renumber source file after move.");
          }
          finalSource = renumSource.abcText;
        }

        const writeTargetRes = await writeFile(targetPath, finalTarget, { expectedData: targetContent });
        if (!writeTargetRes.ok) {
          if (writeTargetRes.conflict) markDiskConflictPath(targetPath, true);
          throw new Error(writeTargetRes.error || "Unable to update target file.");
        }

        const writeSourceRes = await writeFile(sourcePath, finalSource, { expectedData: sourceContent });
        if (!writeSourceRes.ok) {
          if (writeSourceRes.conflict) markDiskConflictPath(sourcePath, true);
          const rollback = await writeFile(targetPath, targetContent, { expectedData: finalTarget });
          if (rollback && rollback.ok) {
            throw new Error(writeSourceRes.error || "Unable to update source file.");
          }
          throw new Error((writeSourceRes && writeSourceRes.error)
            ? `${writeSourceRes.error} (rollback failed; the tune may now be duplicated)`
            : "Unable to update source file (rollback failed; the tune may now be duplicated)");
        }

        const updatedTargetFile = await refreshLibraryFile(targetPath, { force: true });
        await refreshLibraryFile(sourcePath, { force: true });
        setActiveFilePath(targetPath);

        if (getActiveTuneId() === clipboardTune.tuneId) {
          const targetTunes = updatedTargetFile && Array.isArray(updatedTargetFile.tunes) ? updatedTargetFile.tunes : [];
          const movedTune = targetTunes.length ? targetTunes[targetTunes.length - 1] : null;
          const movedTuneId = movedTune ? (movedTune.tuneUid || movedTune.id) : "";
          if (!movedTuneId) {
            throw new Error("Tune was moved, but the target tune could not be found after reindexing. Reopen the target file and try again.");
          }
          await selectTune(movedTuneId, { skipConfirm: true, suppressRecent: true });
        }

        clearClipboardTune();
      });
      setStatus("OK");
    } catch (e) {
      await showSaveError(e && e.message ? e.message : String(e));
    }
  }

  return {
    appendTuneTextToFile,
    appendTuneTextToFileUnlocked,
    moveTuneToFile,
    pasteClipboardToFile,
  };
}
