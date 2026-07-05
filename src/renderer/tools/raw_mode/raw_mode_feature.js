function buildRawFileText({ headerText, bodyText }) {
  let header = String(headerText || "");
  const body = String(bodyText || "");
  if (header && !/[\r\n]$/.test(header) && /^\s*X:/.test(body)) {
    header += "\n";
  }
  return header ? header + body : body;
}

function createRawModeFeature({
  api,
  documentRef = typeof document !== "undefined" ? document : null,
  elements = {},
  getState = () => ({}),
  patchState = () => {},
  getCurrentDoc = () => null,
  patchCurrentDoc = () => {},
  getActiveFilePath = () => "",
  setActiveFilePath = () => {},
  getActiveTuneId = () => "",
  getActiveTuneMeta = () => null,
  setRawActiveTuneMeta = () => {},
  clearUnsavedDiscardState = () => {},
  getHeaderDirty = () => false,
  setHeaderClean = () => {},
  getHeaderText = () => "",
  getEditorText = () => "",
  setEditorText = () => {},
  setSuppressDirty = () => {},
  setFocusModeEnabled = () => {},
  setBarMismatchMarkers = () => {},
  applyRightSplitSizesFromRatio = () => {},
  updateSourceLinkPanel = () => {},
  showToast = () => {},
  showOpenError = async () => {},
  showSaveError = async () => {},
  setStatus = () => {},
  withFileLock = async (_filePath, operation) => operation(),
  pathsEqual = (a, b) => String(a || "") === String(b || ""),
  readFile = async () => ({ ok: false, error: "Unable to read file." }),
  refreshLibraryFile = async () => null,
  getActiveFileEntry = () => null,
  findHeaderEndOffset = () => 0,
  findTuneById = () => null,
  safeFirstTuneId = () => "",
  selectTune = async () => ({ ok: false }),
  stopPlaybackTransport = () => {},
  flushWorkingCopyTuneSync = async () => {},
  flushWorkingCopyFullSync = async () => {},
  ensureWorkingCopyOpenForPath = async () => {},
  refreshWorkingCopySnapshot = async () => null,
  handleMissingWorkingCopySave = async () => ({ ok: false }),
  resolveWorkingCopySaveConflictDefault = async () => ({ ok: false }),
  markDiskConflictPath = () => {},
  setFileContentInCache = () => {},
  attachTuneUidsToLibraryFile = () => {},
  updateHeaderStateUI = () => {},
  updateFileHeaderPanel = () => {},
  setDirtyIndicator = () => {},
  setSaveFullFileSession = () => {},
  ensureSafeToAbandonCurrentDoc = async () => true,
  setTuneMetaText = () => {},
  buildTuneMetaLabel = () => "",
  markActiveTuneButton = () => {},
  scrollToPosInEditor = () => {},
} = {}) {
  function isEnabled() {
    return Boolean(getState().rawMode);
  }

  function setUi(enabled) {
    const next = Boolean(enabled);
    patchState({ rawMode: next });
    if (next) setFocusModeEnabled(false);
    if (next) setBarMismatchMarkers([]);
    if (documentRef && documentRef.body) documentRef.body.classList.toggle("raw-mode", next);
    if (elements.rawButton) elements.rawButton.classList.toggle("toggle-active", next);
    applyRightSplitSizesFromRatio();
    if (elements.playPauseButton) elements.playPauseButton.disabled = next;
    if (elements.stopButton) elements.stopButton.disabled = next;
    if (elements.followButton) elements.followButton.disabled = next;
    if (elements.errorsButton) elements.errorsButton.disabled = next;
    if (elements.scanErrorsButton) elements.scanErrorsButton.disabled = next;
    if (elements.errorsIndicator) elements.errorsIndicator.disabled = next;
    updateSourceLinkPanel();
  }

  async function save() {
    const state = getState();
    const currentDoc = getCurrentDoc();
    const activeFilePath = getActiveFilePath();
    const filePath = state.rawModeFilePath || (currentDoc && currentDoc.path) || activeFilePath;
    if (!filePath) {
      await showSaveError("No file path available for raw save.");
      return false;
    }
    const activeTuneMeta = getActiveTuneMeta();
    const preferred = (activeTuneMeta && pathsEqual(activeTuneMeta.path, filePath))
      ? { xNumber: activeTuneMeta.xNumber || "", indexInFile: activeTuneMeta.indexInFile || 0 }
      : { xNumber: "", indexInFile: 0 };
    const headerText = getHeaderText();
    const bodyText = getEditorText();
    const fullText = buildRawFileText({ headerText, bodyText });

    return withFileLock(filePath, async () => {
      if (
        !api
        || typeof api.openWorkingCopy !== "function"
        || typeof api.applyWorkingCopyFullText !== "function"
        || typeof api.commitWorkingCopyToDisk !== "function"
      ) {
        await showSaveError("Internal error: working copy raw save is unavailable.");
        return false;
      }

      await api.openWorkingCopy(filePath);
      const applyRes = await api.applyWorkingCopyFullText(fullText);
      if (!applyRes || !applyRes.ok) {
        await showSaveError((applyRes && applyRes.error) ? applyRes.error : "Unable to update working copy for raw save.");
        return false;
      }

      const saveRes = await api.commitWorkingCopyToDisk({ force: false });
      if (saveRes && saveRes.missingOnDisk) {
        const handled = await handleMissingWorkingCopySave(filePath);
        if (handled && handled.ok) {
          const nextPath = handled.path || filePath;
          setHeaderClean();
          updateHeaderStateUI();
          patchCurrentDoc({ path: nextPath, content: bodyText, dirty: false });
          setDirtyIndicator(false);
          setStatus("File saved.");
          return true;
        }
        return false;
      }
      if (!saveRes || !saveRes.ok) {
        if (saveRes && saveRes.conflict) {
          const resolved = await resolveWorkingCopySaveConflictDefault(filePath, { restoreTuneId: null });
          if (resolved && resolved.ok && resolved.action === "overwrite") {
            // continue below
          } else if (resolved && resolved.ok && resolved.action === "save_copy_as") {
            setStatus("Saved copy.");
            return true;
          } else {
            if (resolved && resolved.action === "discard_reload") {
              setStatus("Reloaded from disk.");
            } else if (resolved && resolved.error) {
              await showSaveError(resolved.error);
            } else {
              setStatus("Save canceled.");
            }
            return false;
          }
        }
        await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to save file.");
        return false;
      }

      markDiskConflictPath(filePath, false);
      const snapshot = await refreshWorkingCopySnapshot();
      if (snapshot && snapshot.path && pathsEqual(snapshot.path, filePath)) {
        setFileContentInCache(filePath, snapshot.text);
        attachTuneUidsToLibraryFile(filePath, snapshot);
      } else {
        setFileContentInCache(filePath, fullText);
      }
      setHeaderClean();
      updateHeaderStateUI();
      patchCurrentDoc({ path: filePath, content: bodyText, dirty: false });
      setDirtyIndicator(false);

      const updatedFile = await refreshLibraryFile(filePath, { force: true });
      if (updatedFile && Number.isFinite(updatedFile.headerEndOffset)) {
        patchState({ rawModeHeaderEndOffset: Number(updatedFile.headerEndOffset) || 0 });
      }
      if (isEnabled()) {
        const entry = updatedFile || getActiveFileEntry();
        const tunes = entry && entry.tunes ? entry.tunes : [];
        if (tunes.length) {
          let nextTune = null;
          if (!nextTune && Number.isFinite(Number(preferred.indexInFile)) && Number(preferred.indexInFile) > 0) {
            nextTune = tunes[Math.min(tunes.length - 1, Math.max(0, Number(preferred.indexInFile) - 1))];
          }
          if (!nextTune && preferred.xNumber) {
            nextTune = tunes.find((t) => String(t.xNumber || "") === String(preferred.xNumber));
          }
          if (!nextTune) nextTune = tunes[0];
          if (nextTune && nextTune.id) {
            if (elements.tuneSelect) elements.tuneSelect.value = nextTune.id;
            setActiveTune(nextTune.id);
          }
        }
      }
      setStatus("File saved.");
      return true;
    });
  }

  function setActiveTune(tuneId) {
    if (!tuneId) return;
    const res = findTuneById(tuneId);
    if (!res) return;
    const meta = {
      id: res.tune.id,
      path: res.file.path,
      basename: res.file.basename,
      indexInFile: res.tune.indexInFile,
      xNumber: res.tune.xNumber,
      title: res.tune.title || "",
      composer: res.tune.composer || "",
      key: res.tune.key || "",
      startLine: res.tune.startLine,
      endLine: res.tune.endLine,
      startOffset: res.tune.startOffset,
      endOffset: res.tune.endOffset,
    };
    setRawActiveTuneMeta(tuneId, meta);
    markActiveTuneButton(tuneId);
    setTuneMetaText(buildTuneMetaLabel(meta));
  }

  function scrollToTune(tuneId) {
    const res = findTuneById(tuneId);
    if (!res) return;
    const bodyStart = Number(getState().rawModeHeaderEndOffset) || 0;
    const pos = Math.max(0, Number(res.tune.startOffset) - bodyStart);
    scrollToPosInEditor(pos, { y: "start" });
  }

  async function enter() {
    const activeTuneMeta = getActiveTuneMeta();
    const currentDoc = getCurrentDoc();
    const filePath = (activeTuneMeta && activeTuneMeta.path)
      ? activeTuneMeta.path
      : (getActiveFilePath() || (currentDoc && currentDoc.path) || null);
    if (!filePath) {
      showToast("No active file to open in raw mode.", 2200);
      return;
    }
    const ok = await ensureSafeToAbandonCurrentDoc("switching to raw mode");
    if (!ok) return;

    try { stopPlaybackTransport(); } catch {}
    try { await flushWorkingCopyTuneSync(); } catch {}
    try { await flushWorkingCopyFullSync(); } catch {}

    const readRes = await readFile(filePath);
    if (!readRes || !readRes.ok) {
      await showOpenError((readRes && readRes.error) ? readRes.error : "Unable to read file.");
      return;
    }
    const fullText = String(readRes.data || "");

    try {
      await ensureWorkingCopyOpenForPath(filePath);
      if (api && typeof api.reloadWorkingCopyFromDisk === "function") {
        await api.reloadWorkingCopyFromDisk();
      }
      await refreshWorkingCopySnapshot();
    } catch {}

    setActiveFilePath(filePath);
    setSaveFullFileSession(filePath, "raw_mode");
    setFileContentInCache(filePath, fullText);
    const updatedFile = await refreshLibraryFile(filePath, { force: true });
    const entry = updatedFile || getActiveFileEntry();
    const headerEndOffset = entry && Number.isFinite(entry.headerEndOffset)
      ? Number(entry.headerEndOffset)
      : findHeaderEndOffset(fullText);
    const bodyText = String(fullText || "").slice(headerEndOffset);

    patchState({
      rawModeFilePath: filePath,
      rawModeHeaderEndOffset: headerEndOffset,
      rawModeOriginalTuneId: getActiveTuneId(),
    });

    setSuppressDirty(true);
    setEditorText(bodyText);
    setSuppressDirty(false);
    patchCurrentDoc({ path: filePath, content: bodyText, dirty: false });
    setUi(true);
    updateFileHeaderPanel();
    setDirtyIndicator(false);
    const restore = getState().rawModeOriginalTuneId;
    if (restore) {
      setActiveTune(restore);
      scrollToTune(restore);
    }
    setStatus("Raw mode.");
  }

  async function exit({ ensureSafe } = {}) {
    if (!isEnabled()) return;
    const currentDoc = getCurrentDoc();
    const fileDirty = Boolean(currentDoc && currentDoc.dirty);
    const hdrDirty = Boolean(getHeaderDirty());
    if (fileDirty || hdrDirty) {
      const ok = await ensureSafe("leaving raw mode", { save: save });
      if (!ok) return;
    }
    setUi(false);
    const tuneToRestore = getActiveTuneId() || getState().rawModeOriginalTuneId;
    patchState({ rawModeFilePath: null, rawModeHeaderEndOffset: 0, rawModeOriginalTuneId: null });
    const selected = await restoreTuneOrFirst(tuneToRestore);
    if (!selected) await restoreTuneOrFirst("");
    setStatus("Ready");
  }

  async function restoreTuneOrFirst(tuneId) {
    if (tuneId) {
      const res = await selectTune(tuneId, { skipConfirm: true });
      if (res && res.ok) return true;
    }
    const firstId = safeFirstTuneId();
    if (firstId) {
      const res = await selectTune(firstId, { skipConfirm: true });
      return Boolean(res && res.ok);
    }
    return false;
  }

  async function leaveForAction(contextLabel, { ensureSafe } = {}) {
    if (!isEnabled()) return true;
    const currentDoc = getCurrentDoc();
    const fileDirty = Boolean(currentDoc && currentDoc.dirty);
    const hdrDirty = Boolean(getHeaderDirty());
    if (fileDirty || hdrDirty) {
      const ok = await ensureSafe(contextLabel || "continuing", { save });
      if (!ok) return false;
    }
    setUi(false);
    patchState({ rawModeFilePath: null, rawModeHeaderEndOffset: 0, rawModeOriginalTuneId: null });
    return true;
  }

  function discardUnsavedRawState() {
    clearUnsavedDiscardState();
    updateFileHeaderPanel();
    setDirtyIndicator(false);
  }

  return {
    buildRawFileText,
    discardUnsavedRawState,
    enter,
    exit,
    isEnabled,
    leaveForAction,
    save,
    scrollToTune,
    setActiveTune,
    setUi,
  };
}

export {
  buildRawFileText,
  createRawModeFeature,
};
