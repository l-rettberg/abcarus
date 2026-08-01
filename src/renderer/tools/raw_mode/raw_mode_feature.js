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
  getCurrentDoc = () => null,
  patchCurrentDoc = () => {},
  getActiveFilePath = () => "",
  beginRawFullFileContext = () => {},
  getActiveTuneId = () => "",
  getActiveTuneMeta = () => null,
  setRawActiveTuneContext = () => {},
  clearUnsavedDiscardState = () => {},
  getHeaderDirty = () => false,
  setHeaderClean = () => {},
  getHeaderText = () => "",
  getEditorText = () => "",
  getEditorView = () => null,
  scrollEditor = () => {},
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
  normalizeCleanStateBeforeRaw = async () => {},
  ensureWorkingCopyOpenForPath = async () => {},
  refreshWorkingCopySnapshot = async () => null,
  handleMissingWorkingCopySave = async () => ({ ok: false }),
  resolveWorkingCopySaveConflictDefault = async () => ({ ok: false }),
  markDiskConflictPath = () => {},
  setFileContentInCache = () => {},
  attachTuneUidsToLibraryFile = () => {},
  updateHeaderStateUI = () => {},
  updateFileHeaderPanel = () => {},
  updateFileContext = () => {},
  setDirtyIndicator = () => {},
  ensureSafeToAbandonCurrentDoc = async () => true,
  ensureSafeToEnterRaw = null,
  confirmUnsavedChanges = async () => "cancel",
  setTuneMetaText = () => {},
  buildTuneMetaLabel = () => "",
  markActiveTuneButton = () => {},
} = {}) {
  const state = {
    rawMode: false,
    rawModeFilePath: null,
    rawModeHeaderEndOffset: 0,
    rawModeOriginalTuneId: null,
    transitionInProgress: false,
  };

  function patchState(patch = {}) {
    if (Object.prototype.hasOwnProperty.call(patch, "rawMode")) state.rawMode = Boolean(patch.rawMode);
    if (Object.prototype.hasOwnProperty.call(patch, "rawModeFilePath")) state.rawModeFilePath = patch.rawModeFilePath || null;
    if (Object.prototype.hasOwnProperty.call(patch, "rawModeHeaderEndOffset")) state.rawModeHeaderEndOffset = Number(patch.rawModeHeaderEndOffset) || 0;
    if (Object.prototype.hasOwnProperty.call(patch, "rawModeOriginalTuneId")) state.rawModeOriginalTuneId = patch.rawModeOriginalTuneId || null;
  }

  function isEnabled() {
    return Boolean(state.rawMode);
  }

  function getFilePath() {
    return state.rawModeFilePath || null;
  }

  function setFilePath(filePath) {
    state.rawModeFilePath = filePath || null;
  }

  function getHeaderEndOffset() {
    return Number(state.rawModeHeaderEndOffset) || 0;
  }

  function setHeaderEndOffset(value) {
    state.rawModeHeaderEndOffset = Number(value) || 0;
  }

  function resetState() {
    state.rawModeFilePath = null;
    state.rawModeHeaderEndOffset = 0;
    state.rawModeOriginalTuneId = null;
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
    updateFileContext();
  }

  async function save() {
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

      const opened = await api.openWorkingCopy(filePath);
      if (!opened || !opened.ok) {
        await showSaveError((opened && opened.error) ? opened.error : "Unable to open working copy for raw save.");
        return false;
      }
      const snapshotBefore = await refreshWorkingCopySnapshot();
      if (!snapshotBefore || !snapshotBefore.path || !pathsEqual(snapshotBefore.path, filePath)) {
        await showSaveError("Working copy no longer matches the raw file.");
        return false;
      }
      const applyRes = await api.applyWorkingCopyFullText(fullText, {
        expectedPath: filePath,
        expectedVersion: snapshotBefore.version,
      });
      if (!applyRes || !applyRes.ok) {
        await showSaveError((applyRes && applyRes.error) ? applyRes.error : "Unable to update working copy for raw save.");
        return false;
      }

      const snapshotToSave = await refreshWorkingCopySnapshot();
      if (!snapshotToSave || !snapshotToSave.path || !pathsEqual(snapshotToSave.path, filePath)) {
        await showSaveError("Working copy no longer matches the raw file.");
        return false;
      }
      const saveRes = await api.commitWorkingCopyToDisk({
        force: false,
        expectedPath: filePath,
        expectedVersion: snapshotToSave.version,
      });
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
      updateFileContext();
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
    setRawActiveTuneContext(tuneId, meta);
    markActiveTuneButton(tuneId);
    setTuneMetaText(buildTuneMetaLabel(meta));
  }

  function scrollToTune(tuneId) {
    const res = findTuneById(tuneId);
    if (!res) return;
    const bodyStart = getHeaderEndOffset();
    const pos = Math.max(0, Number(res.tune.startOffset) - bodyStart);
    scrollToPosInEditor(pos, { y: "start" });
    const win = documentRef && documentRef.defaultView;
    if (win && typeof win.requestAnimationFrame === "function") {
      win.requestAnimationFrame(() => scrollToPosInEditor(pos, { y: "start" }));
    }
  }

  function scrollToPosInEditor(pos, { y = "start" } = {}) {
    scrollEditor(getEditorView(), pos, { y });
  }

  async function confirmLeave(contextLabel, { save: saveAction } = {}) {
    const currentDoc = getCurrentDoc();
    const fileDirty = Boolean(currentDoc && currentDoc.dirty);
    const headerDirty = Boolean(getHeaderDirty());
    if (!fileDirty && !headerDirty) return true;
    const choice = await confirmUnsavedChanges(contextLabel || "continuing");
    if (choice === "cancel") return false;
    if (choice === "save") {
      const saved = typeof saveAction === "function" ? await saveAction() : await save();
      return Boolean(saved);
    }
    if (choice === "dont_save") {
      discardUnsavedRawState();
      return true;
    }
    return false;
  }

  async function enter() {
    if (state.transitionInProgress || isEnabled()) return;
    state.transitionInProgress = true;
    try {
      const activeTuneMeta = getActiveTuneMeta();
      const currentDoc = getCurrentDoc();
      const filePath = (activeTuneMeta && activeTuneMeta.path)
        ? activeTuneMeta.path
        : (getActiveFilePath() || (currentDoc && currentDoc.path) || null);
      if (!filePath) {
        showToast("No active file to open in raw mode.", 2200);
        return;
      }

      try { await flushWorkingCopyTuneSync(); } catch {}
      try { await flushWorkingCopyFullSync(); } catch {}

      let fullText = "";
      let usingWorkingCopyText = false;
      try {
        const snapshot = await refreshWorkingCopySnapshot();
        if (snapshot && snapshot.path && pathsEqual(snapshot.path, filePath) && typeof snapshot.text === "string") {
          fullText = String(snapshot.text || "");
          usingWorkingCopyText = true;
        }
      } catch {}
      if (!usingWorkingCopyText) {
        const readRes = await readFile(filePath);
        if (!readRes || !readRes.ok) {
          await showOpenError((readRes && readRes.error) ? readRes.error : "Unable to read file.");
          return;
        }
        fullText = String(readRes.data || "");
      }

      try { await normalizeCleanStateBeforeRaw(filePath, fullText); } catch {}
      const ok = typeof ensureSafeToEnterRaw === "function"
        ? await ensureSafeToEnterRaw(filePath, "switching to raw mode")
        : await ensureSafeToAbandonCurrentDoc("switching to raw mode");
      if (!ok) return;

      try { stopPlaybackTransport(); } catch {}

      try {
        await ensureWorkingCopyOpenForPath(filePath);
        if (!usingWorkingCopyText && api && typeof api.reloadWorkingCopyFromDisk === "function") {
          const snapshotBeforeReload = await refreshWorkingCopySnapshot();
          if (
            snapshotBeforeReload
            && snapshotBeforeReload.path
            && pathsEqual(snapshotBeforeReload.path, filePath)
          ) {
            await api.reloadWorkingCopyFromDisk({
              expectedPath: filePath,
              expectedVersion: snapshotBeforeReload.version,
            });
          }
        }
        await refreshWorkingCopySnapshot();
      } catch {}

      beginRawFullFileContext(filePath, "raw_mode");
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
      try {
        setEditorText(bodyText);
      } finally {
        setSuppressDirty(false);
      }
      patchCurrentDoc({ path: filePath, content: bodyText, dirty: false });
      setUi(true);
      updateFileHeaderPanel();
      setDirtyIndicator(false);
      const restore = state.rawModeOriginalTuneId;
      if (restore) {
        setActiveTune(restore);
        scrollToTune(restore);
      }
      setStatus("Raw mode.");
    } finally {
      state.transitionInProgress = false;
    }
  }

  async function exit() {
    if (state.transitionInProgress) return;
    if (!isEnabled()) return;
    state.transitionInProgress = true;
    try {
      const currentDoc = getCurrentDoc();
      const fileDirty = Boolean(currentDoc && currentDoc.dirty);
      const hdrDirty = Boolean(getHeaderDirty());
      if (fileDirty || hdrDirty) {
        const ok = await confirmLeave("leaving raw mode", { save });
        if (!ok) return;
      }
      setUi(false);
      const tuneToRestore = getActiveTuneId() || state.rawModeOriginalTuneId;
      patchState({ rawModeFilePath: null, rawModeHeaderEndOffset: 0, rawModeOriginalTuneId: null });
      const selected = await restoreTuneOrFirst(tuneToRestore);
      if (!selected) await restoreTuneOrFirst("");
      setStatus("Ready");
    } finally {
      state.transitionInProgress = false;
    }
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

  async function leaveForAction(contextLabel) {
    if (state.transitionInProgress) return false;
    if (!isEnabled()) return true;
    state.transitionInProgress = true;
    try {
      const currentDoc = getCurrentDoc();
      const fileDirty = Boolean(currentDoc && currentDoc.dirty);
      const hdrDirty = Boolean(getHeaderDirty());
      if (fileDirty || hdrDirty) {
        const ok = await confirmLeave(contextLabel || "continuing", { save });
        if (!ok) return false;
      }
      setUi(false);
      patchState({ rawModeFilePath: null, rawModeHeaderEndOffset: 0, rawModeOriginalTuneId: null });
      return true;
    } finally {
      state.transitionInProgress = false;
    }
  }

  function discardUnsavedRawState() {
    clearUnsavedDiscardState();
    const currentDoc = getCurrentDoc();
    if (currentDoc) {
      patchCurrentDoc({ dirty: false }, { create: false });
    }
    setHeaderClean();
    updateHeaderStateUI();
    updateFileHeaderPanel();
    setDirtyIndicator(false);
  }

  return {
    buildRawFileText,
    confirmLeave,
    discardUnsavedRawState,
    enter,
    exit,
    getFilePath,
    getHeaderEndOffset,
    isEnabled,
    leaveForAction,
    resetState,
    save,
    scrollToTune,
    setActiveTune,
    setFilePath,
    setHeaderEndOffset,
    setUi,
  };
}

export {
  buildRawFileText,
  createRawModeFeature,
};
