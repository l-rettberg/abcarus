function createWorkingCopyConflictController({
  api = null,
  state = {},
  actions = {},
  utils = {},
} = {}) {
  const { getRawMode = () => false } = state;

  const {
    attachTuneUidsToLibraryFile = () => {},
    refreshLibraryFile = async () => null,
    refreshWorkingCopySnapshot = async () => null,
    safeBasename = (p) => String(p || "").split("/").pop() || "",
    safeDirname = () => "",
    selectTune = async () => {},
    switchWorkingCopyFileContext = () => {},
    setDirtyIndicator = () => {},
    setEditorValueClean = () => {},
    setFileContentInCache = () => {},
    setFileNameMeta = () => {},
    setHeaderClean = () => {},
    setHeaderEditorValueClean = () => {},
    setRawModeFilePath = () => {},
    setRawModeHeaderEndOffset = () => {},
    stripFileExtension = (name) => String(name || "").replace(/\.[^.]*$/, ""),
    updateHeaderStateUI = () => {},
    patchCurrentDocument = () => {},
    markDiskConflictPath = () => {},
    splitFileIntoHeaderAndBody = (text) => ({ headerText: "", bodyText: String(text || "") }),
    withFileLock = async (_path, fn) => fn(),
  } = actions;

  const { pathsEqual = (a, b) => String(a || "") === String(b || "") } = utils;

  async function confirmReloadFromDisk(filePath) {
    if (!api || typeof api.confirmReloadFromDisk !== "function") return false;
    return Boolean(await api.confirmReloadFromDisk(filePath));
  }

  async function resolveWorkingCopySaveConflictDefault(filePath, { restoreTuneId = null } = {}) {
    const p = String(filePath || "");
    if (!p) return { ok: false, cancelled: true, action: "cancel" };
    if (!api || typeof api.confirmSaveConflict !== "function") {
      markDiskConflictPath(p, true);
      return { ok: false, action: "cancel", error: "File changed on disk. Save conflict dialog is unavailable." };
    }
    const choice = await api.confirmSaveConflict(p);
    if (choice === "save_copy_as") return saveWorkingCopyCopyAsAndSwitch(p, { restoreTuneId });
    if (choice === "discard_reload") return discardAndReloadWorkingCopyFromDisk(p, { restoreTuneId });
    if (choice !== "overwrite") {
      markDiskConflictPath(p, true);
      return { ok: false, cancelled: true, action: "cancel" };
    }
    const snapshot = await refreshWorkingCopySnapshot();
    if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, p)) {
      markDiskConflictPath(p, true);
      return { ok: false, action: "overwrite", error: "Working copy no longer matches the file being saved." };
    }
    const forced = await api.commitWorkingCopyToDisk({
      force: true,
      expectedPath: p,
      expectedVersion: snapshot.version,
    });
    if (forced && forced.ok) {
      markDiskConflictPath(p, false);
      return { ok: true, action: "overwrite" };
    }
    markDiskConflictPath(p, true);
    return { ok: false, action: "overwrite", error: (forced && forced.error) ? forced.error : "Unable to save file." };
  }

  async function discardAndReloadWorkingCopyFromDisk(filePath, { restoreTuneId = null } = {}) {
    const p = String(filePath || "");
    if (!p) return { ok: false, error: "Missing file path." };
    if (!api || typeof api.openWorkingCopy !== "function" || typeof api.reloadWorkingCopyFromDisk !== "function") {
      return { ok: false, error: "Working copy reload is unavailable." };
    }

    const opened = await api.openWorkingCopy(p);
    if (!opened || !opened.ok) {
      return { ok: false, error: (opened && opened.error) ? opened.error : "Unable to open working copy." };
    }
    const snapshotBefore = await refreshWorkingCopySnapshot();
    if (!snapshotBefore || !snapshotBefore.path || !pathsEqual(snapshotBefore.path, p)) {
      return { ok: false, error: "Working copy no longer matches the file being reloaded." };
    }
    const reloaded = await api.reloadWorkingCopyFromDisk({
      force: true,
      expectedPath: p,
      expectedVersion: snapshotBefore.version,
    });
    if (!reloaded || !reloaded.ok) return { ok: false, error: "Unable to reload from disk." };

    const snapReloaded = await refreshWorkingCopySnapshot();
    if (snapReloaded && snapReloaded.path && pathsEqual(snapReloaded.path, p)) {
      setFileContentInCache(p, snapReloaded.text);
      attachTuneUidsToLibraryFile(p, snapReloaded);
    }

    const updatedFile = await refreshLibraryFile(p, { force: true });
    if (updatedFile && Number.isFinite(updatedFile.headerEndOffset)) setRawModeHeaderEndOffset(updatedFile.headerEndOffset);
    if (getRawMode()) {
      const parts = splitFileIntoHeaderAndBody((snapReloaded && snapReloaded.text) ? snapReloaded.text : "");
      setHeaderEditorValueClean(parts.headerText);
      setEditorValueClean(parts.bodyText);
      setHeaderClean();
      updateHeaderStateUI();
      patchCurrentDocument({ path: p, content: parts.bodyText, dirty: false }, { create: false });
      setDirtyIndicator(false);
    } else if (restoreTuneId) {
      try { await selectTune(restoreTuneId, { skipConfirm: true, suppressRecent: true }); } catch {}
    }

    markDiskConflictPath(p, false);
    return { ok: true, updatedFile };
  }

  async function saveWorkingCopyCopyAsAndSwitch(sourcePath, { restoreTuneId = null } = {}) {
    const fromPath = String(sourcePath || "");
    if (!fromPath) return { ok: false, error: "Missing file path." };
    if (
      !api
      || typeof api.showSaveDialog !== "function"
      || typeof api.openWorkingCopy !== "function"
      || typeof api.writeWorkingCopyToPathAndSwitch !== "function"
    ) return { ok: false, error: "Save Copy As is unavailable." };

    const dir = safeDirname(fromPath);
    const base = stripFileExtension(safeBasename(fromPath));
    const suggestedName = `${base || "Untitled"}_Copy.abc`;
    const targetPath = await api.showSaveDialog(suggestedName, dir || undefined);
    if (!targetPath) return { ok: false, cancelled: true };

    await withFileLock(targetPath, async () => {
      const opened = await api.openWorkingCopy(fromPath);
      if (!opened || !opened.ok) {
        throw new Error((opened && opened.error) ? opened.error : "Unable to open working copy.");
      }
      const sourceSnapshot = await refreshWorkingCopySnapshot();
      if (!sourceSnapshot || !sourceSnapshot.path || !pathsEqual(sourceSnapshot.path, fromPath)) {
        throw new Error("Working copy no longer matches the file being copied.");
      }
      const writeRes = await api.writeWorkingCopyToPathAndSwitch(targetPath, {
        expectedPath: fromPath,
        expectedVersion: sourceSnapshot.version,
      });
      if (!writeRes || !writeRes.ok) throw new Error((writeRes && writeRes.error) ? writeRes.error : "Unable to save copy.");
    });

    const snap = await refreshWorkingCopySnapshot();
    if (snap && snap.path && pathsEqual(snap.path, targetPath)) {
      setFileContentInCache(targetPath, snap.text);
      attachTuneUidsToLibraryFile(targetPath, snap);
    }
    const updatedFile = await refreshLibraryFile(targetPath, { force: true });
    if (updatedFile && updatedFile.basename) setFileNameMeta(stripFileExtension(updatedFile.basename || ""));
    if (updatedFile && Number.isFinite(updatedFile.headerEndOffset)) setRawModeHeaderEndOffset(updatedFile.headerEndOffset);
    switchWorkingCopyFileContext(targetPath, { rawMode: getRawMode(), source: "save_copy_as" });
    if (getRawMode()) {
      const parts = splitFileIntoHeaderAndBody((snap && snap.text) ? snap.text : "");
      setHeaderEditorValueClean(parts.headerText);
      setEditorValueClean(parts.bodyText);
      setHeaderClean();
      updateHeaderStateUI();
      patchCurrentDocument({ path: targetPath, content: parts.bodyText, dirty: false }, { create: false });
      setDirtyIndicator(false);
    } else if (restoreTuneId) {
      try { await selectTune(restoreTuneId, { skipConfirm: true, suppressRecent: true }); } catch {}
    }

    markDiskConflictPath(fromPath, false);
    markDiskConflictPath(targetPath, false);
    return { ok: true, updatedFile, targetPath };
  }

  return {
    confirmReloadFromDisk,
    discardAndReloadWorkingCopyFromDisk,
    resolveWorkingCopySaveConflictDefault,
    saveWorkingCopyCopyAsAndSwitch,
  };
}

export {
  createWorkingCopyConflictController,
};
