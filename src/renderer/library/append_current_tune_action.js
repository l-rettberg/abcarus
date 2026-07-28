function buildNewTuneDraftTemplate(nextX) {
  const x = Number.isFinite(Number(nextX)) ? Number(nextX) : "";
  const xLine = x ? `X:${x}` : "X:";
  return [
    xLine,
    "T:",
    "C:",
    "M:4/4",
    "L:1/8",
    "Q:1/4=120",
    "K:C",
    "",
  ].join("\n");
}

export function createAppendCurrentTuneAction({
  api = null,
  SAVE_INTENT = {},
  state = {},
  actions = {},
} = {}) {
  const {
    getActiveFilePath = () => "",
    getActiveTuneMeta = () => null,
    getActiveTuneUid = () => "",
    getCurrentDocumentPath = () => "",
    getCurrentNavFilePath = () => "",
    getEditorText = () => "",
    getSaveSession = () => ({}),
  } = state;

  const {
    confirmAppendToFile = async () => "",
    ensureSafeToAbandonCurrentDoc = async () => false,
    ensureXNumberInAbc = (text) => text,
    getActiveFileEntry = () => null,
    getNextXNumber = () => 1,
    markDiskConflictPath = () => {},
    markHeaderClean = () => {},
    parseTuneIdentityFields = () => null,
    patchCurrentDocument = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    refreshLibraryFile = async () => null,
    refreshWorkingCopySnapshot = async () => null,
    resolveWorkingCopySaveConflictDefault = async () => null,
    selectTune = async () => {},
    setActiveFilePath = () => {},
    setFileContentInCache = () => {},
    setIsNewTuneDraft = () => {},
    setSaveSession = () => {},
    setStatus = () => {},
    setDirtyIndicator = () => {},
    showSaveError = async () => {},
    showToast = () => {},
    syncLibraryFileFromWorkingCopySnapshot = () => {},
    updateHeaderStateUI = () => {},
    withFileLock = async (_path, fn) => fn(),
  } = actions;

  async function appendTextToFileNow(filePath, tuneText, { toastOk = "" } = {}) {
    const p = String(filePath || "");
    if (!p) return false;
    const raw = String(tuneText || "");
    if (!raw.trim()) return false;
    if (
      !api
      || typeof api.openWorkingCopy !== "function"
      || typeof api.insertWorkingCopyTuneAfter !== "function"
      || typeof api.commitWorkingCopyToDisk !== "function"
    ) {
      await showSaveError("Internal error: working copy is unavailable.");
      return false;
    }

    return withFileLock(p, async () => {
      const opened = await api.openWorkingCopy(p);
      if (!opened || !opened.ok) {
        await showSaveError((opened && opened.error) ? opened.error : "Unable to open working copy.");
        return false;
      }
      const snap = await refreshWorkingCopySnapshot();
      if (!snap || !snap.path || !pathsEqual(snap.path, p)) {
        await showSaveError("Unable to open working copy.");
        return false;
      }

      const nextX = getNextXNumber(String(snap.text || ""));
      const prepared = ensureXNumberInAbc(raw, nextX);
      const insertRes = await api.insertWorkingCopyTuneAfter({
        append: true,
        text: prepared,
        expectedPath: p,
        expectedVersion: snap.version,
      });
      if (!insertRes || !insertRes.ok) {
        await showSaveError((insertRes && insertRes.error) ? insertRes.error : "Unable to add tune.");
        return false;
      }

      const snapshotToSave = await refreshWorkingCopySnapshot();
      if (!snapshotToSave || !snapshotToSave.path || !pathsEqual(snapshotToSave.path, p)) {
        await showSaveError("Working copy no longer matches the append target.");
        return false;
      }
      const saveRes = await api.commitWorkingCopyToDisk({
        force: false,
        expectedPath: p,
        expectedVersion: snapshotToSave.version,
      });
      if (!saveRes || !saveRes.ok) {
        if (saveRes && saveRes.conflict) {
          const resolved = await resolveWorkingCopySaveConflictDefault(p, { restoreTuneId: null });
          if (resolved && resolved.ok && resolved.action === "overwrite") {
            // continue below
          } else if (resolved && resolved.ok && resolved.action === "save_copy_as") {
            showToast("Saved copy and switched.", 3000);
            return true;
          } else {
            if (resolved && resolved.action === "discard_reload") showToast("Reloaded from disk.", 2200);
            else if (resolved && resolved.error) await showSaveError(resolved.error);
            else setStatus("Save canceled.");
            return false;
          }
        }
        await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to save file.");
        return false;
      }

      markDiskConflictPath(p, false);
      const snapAfter = await refreshWorkingCopySnapshot();
      if (snapAfter && snapAfter.path && pathsEqual(snapAfter.path, p)) {
        setFileContentInCache(p, snapAfter.text);
        syncLibraryFileFromWorkingCopySnapshot(p, snapAfter);
      }

      const updatedFile = await refreshLibraryFile(p, { force: true });
      setActiveFilePath(p);
      if (updatedFile && Array.isArray(updatedFile.tunes) && updatedFile.tunes.length) {
        const last = updatedFile.tunes[updatedFile.tunes.length - 1];
        if (last && last.id) await selectTune(last.tuneUid || last.id, { skipConfirm: true, suppressRecent: true });
      }

      markHeaderClean();
      updateHeaderStateUI();
      patchCurrentDocument({ path: p, dirty: false }, { create: false });
      setIsNewTuneDraft(false);
      setDirtyIndicator(false);
      if (toastOk) showToast(toastOk, 1800);
      return true;
    });
  }

  async function performAppendFlow() {
    const session = getSaveSession();
    const filePath = String(session.targetPath || getActiveFilePath() || getCurrentNavFilePath() || "");
    if (!filePath) {
      await showSaveError("Select a target file in the Library panel first.");
      return false;
    }

    const editorText = getEditorText();
    patchCurrentDocument({ content: editorText }, { create: false });

    const deriveTuneLabel = () => {
      try {
        const parsed = parseTuneIdentityFields(editorText);
        const xPart = parsed && parsed.xNumber ? `X:${parsed.xNumber}` : "";
        const title = parsed && parsed.title ? String(parsed.title) : "";
        return `${xPart} ${title}`.trim() || "Untitled";
      } catch {
        return "Untitled";
      }
    };
    const confirm = (api && typeof api.confirmAppendToFileDetailed === "function")
      ? await api.confirmAppendToFileDetailed(filePath, deriveTuneLabel())
      : await confirmAppendToFile(filePath);
    if (confirm !== "append") return false;

    const ok = await appendTextToFileNow(filePath, editorText);
    if (!ok) return false;
    setSaveSession({
      intent: SAVE_INTENT.REPLACE_TUNE,
      targetPath: filePath,
      targetTuneUid: String(getActiveTuneUid() || ""),
      source: "append_saved",
    });
    return true;
  }

  async function fileNewTuneAndAppendNow() {
    const entry = getActiveFileEntry();
    const activeTuneMeta = getActiveTuneMeta();
    const filePath = String(
      (entry && entry.path)
      || (activeTuneMeta && activeTuneMeta.path)
      || getActiveFilePath()
      || getCurrentNavFilePath()
      || getCurrentDocumentPath()
      || ""
    );
    if (!filePath) {
      showToast("Open/select a file first.", 2400);
      return;
    }

    const ok = await ensureSafeToAbandonCurrentDoc("creating a new tune");
    if (!ok) return;

    const template = buildNewTuneDraftTemplate("");
    await appendTextToFileNow(filePath, template, { toastOk: "New tune added." });
  }

  async function fileNewTune() {
    await fileNewTuneAndAppendNow();
  }

  return {
    appendTextToFileNow,
    fileNewTune,
    fileNewTuneAndAppendNow,
    performAppendFlow,
  };
}
