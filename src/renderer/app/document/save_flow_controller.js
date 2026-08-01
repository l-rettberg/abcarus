export function createSaveFlowController({
  api = null,
  SAVE_INTENT = {},
  state = {},
  actions = {},
} = {}) {
  const {
    getActiveFilePath = () => "",
    getActiveTuneId = () => "",
    getActiveTuneMeta = () => null,
    getActiveTuneUid = () => "",
    getCurrentDocument = () => null,
    getCurrentDocumentPath = () => "",
    getFocusModeEnabled = () => false,
    getHeaderDirty = () => false,
    getHeaderEditorValue = () => "",
    getIsNewTuneDraft = () => false,
    getLibraryIndex = () => null,
    getRawMode = () => false,
    getWorkingCopySnapshot = () => null,
    getWorkingCopyOpenError = () => "",
    getChordProFullText = () => "",
    isChordProEnabled = () => false,
    isChordProFullView = () => false,
    isPayloadMode = () => false,
    resolveSaveSession = () => ({ intent: SAVE_INTENT.NONE }),
  } = state;

  const {
    attachTuneUidsToLibraryFile = () => {},
    createNewFileAtPath = async () => false,
    flushWorkingCopyFullSync = async () => {},
    flushWorkingCopyTuneSync = async () => {},
    getDefaultSaveDir = () => "",
    getEditorValue = () => "",
    getSuggestedBaseName = () => "untitled",
    fileExists = async () => false,
    confirmOverwrite = async () => "cancel",
    ensureWorkingCopyOpenForPath = async () => false,
    isHeaderEditorFilePath = () => false,
    isWorkingCopyOpenForFile = () => false,
    loadLibraryFileIntoEditor = async () => null,
    loadLibraryFromFolder = async () => null,
    markCurrentDocumentClean = () => null,
    markDiskConflictPath = () => {},
    markHeaderClean = () => {},
    normalizeLibraryPath = (p) => String(p || ""),
    patchCurrentDocument = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    performAppendFlow = async () => false,
    performRawSaveFlow = async () => false,
    reconcileActiveTuneAfterSave = () => {},
    recordRecentAction = () => {},
    refreshLibraryFile = async () => null,
    refreshWorkingCopySnapshot = async () => null,
    resetHeaderEditorFilePath = () => {},
    resetTransposePreviewState = () => {},
    resolveWorkingCopySaveConflictDefault = async () => null,
    safeBasename = (p) => String(p || "").split("/").pop() || "",
    safeDirname = () => "",
    scheduleAutoWcDump = () => {},
    scheduleRenderLibraryTree = () => {},
    selectTune = async () => {},
    serializeDocument = (doc) => (doc ? String(doc.content || "") : ""),
    setActiveFilePath = () => {},
    setDirtyIndicator = () => {},
    setFileContentInCache = () => {},
    setFileNameMeta = () => {},
    setStatus = () => {},
    showSaveDialog = async () => "",
    showSaveError = async () => {},
    showToastWithAction = () => {},
    stripFileExtension = (name) => String(name || "").replace(/\.[^.]*$/, ""),
    tryResolveActiveTuneUid = () => false,
    updateFileHeaderPanel = () => {},
    updateHeaderStateUI = () => {},
    updateLibraryStatus = () => {},
    updateWindowTitle = () => {},
    withFileLock = async (_path, fn) => fn(),
  } = actions;

  async function finalizeWorkingCopySave(filePath) {
    const normalized = String(filePath || "");
    if (!normalized) return false;

    markDiskConflictPath(normalized, false);
    markCurrentDocumentClean();
    resetTransposePreviewState();
    setDirtyIndicator(false);

    try {
      const snapshot = await refreshWorkingCopySnapshot();
      if (snapshot && snapshot.path && pathsEqual(snapshot.path, normalized)) {
        setFileContentInCache(normalized, snapshot.text);
        attachTuneUidsToLibraryFile(normalized, snapshot);
      }
    } catch {}

    try { await refreshLibraryFile(normalized, { force: true }); } catch {}
    updateLibraryStatus();
    scheduleRenderLibraryTree();
    scheduleAutoWcDump("save", normalized ? safeBasename(normalized) : "");
    return true;
  }

  async function handleMissingWorkingCopySave(filePath) {
    const p = String(filePath || "");
    if (!p) return { ok: false };
    if (!api || typeof api.confirmMissingOnDisk !== "function") return { ok: false };

    const choice = await api.confirmMissingOnDisk(p);
    if (choice === "recreate") {
      const snapshot = await refreshWorkingCopySnapshot();
      if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, p)) {
        await showSaveError("Unable to recreate: working copy no longer matches the missing file.");
        return { ok: false };
      }
      const forced = await api.commitWorkingCopyToDisk({
        force: true,
        expectedPath: p,
        expectedVersion: snapshot.version,
      });
      if (forced && forced.ok) {
        await finalizeWorkingCopySave(p);
        return { ok: true, path: p, action: "recreate" };
      }
      await showSaveError((forced && forced.error) ? forced.error : "Unable to recreate missing file.");
      return { ok: false };
    }
    if (choice === "save_as") {
      const ok = await performSaveAsFlow();
      if (!ok) return { ok: false };
      const snap = await refreshWorkingCopySnapshot();
      const nextPath = snap && snap.path ? String(snap.path) : "";
      return { ok: true, path: nextPath || p, action: "save_as" };
    }
    return { ok: false, cancelled: true };
  }

  function isPermissionDeniedSaveError(error) {
    const msg = String(error || "");
    return /\b(EACCES|EPERM)\b/i.test(msg) || /permission denied/i.test(msg);
  }

  async function handlePermissionDeniedSave(filePath, message) {
    const p = String(filePath || "");
    if (!p) return false;
    const msg = String(message || "");
    if (!isPermissionDeniedSaveError(msg)) return false;
    if (!api || typeof api.confirmSaveAsForPermissionDenied !== "function") return false;
    const choice = await api.confirmSaveAsForPermissionDenied(p, msg);
    if (choice !== "save_as") return false;
    return performSaveAsFlow();
  }

  async function performSimpleTuneSave(filePath, { includeHeader = false } = {}) {
    const p = String(filePath || "");
    if (!p) {
      await showSaveError("Unable to save: tune path is missing.");
      return false;
    }
    return withFileLock(p, async () => {
      if (!api || typeof api.commitWorkingCopyToDisk !== "function") {
        await showSaveError("Internal error: working copy save is unavailable.");
        return false;
      }
      const opened = await ensureWorkingCopyOpenForPath(p);
      if (!opened) {
        const reason = typeof getWorkingCopyOpenError === "function" ? String(getWorkingCopyOpenError() || "") : "";
        await showSaveError(reason
          ? `Unable to save: ${reason}`
          : "Unable to save: working copy could not be opened.");
        return false;
      }
      tryResolveActiveTuneUid();
      const syncRes = await flushWorkingCopyTuneSync();
      if (!syncRes || !syncRes.ok) {
        await showSaveError((syncRes && syncRes.error) ? syncRes.error : "Unable to synchronize the active tune.");
        return false;
      }
      let snapshot = await refreshWorkingCopySnapshot();
      if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, p)) {
        await showSaveError("Unable to save: working copy no longer matches the active file.");
        return false;
      }
      if (includeHeader) {
        if (typeof api.applyWorkingCopyHeaderText !== "function") {
          await showSaveError("Internal error: working copy header save is unavailable.");
          return false;
        }
        const headerRes = await api.applyWorkingCopyHeaderText(getHeaderEditorValue(), {
          expectedPath: p,
          expectedVersion: snapshot.version,
        });
        if (!headerRes || !headerRes.ok) {
          await showSaveError((headerRes && headerRes.error) ? headerRes.error : "Unable to synchronize the file header.");
          return false;
        }
        snapshot = await refreshWorkingCopySnapshot();
        if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, p)) {
          await showSaveError("Unable to save: working copy no longer matches the active file.");
          return false;
        }
      }

      const saveRes = await api.commitWorkingCopyToDisk({
        force: false,
        expectedPath: p,
        expectedVersion: snapshot.version,
      });
      if (!saveRes || !saveRes.ok) {
        if (saveRes && saveRes.conflict) {
          const resolved = await resolveWorkingCopySaveConflictDefault(p, {
            restoreTuneId: getActiveTuneUid() || getActiveTuneId(),
          });
          if (!resolved || !resolved.ok) {
            if (resolved && resolved.error) await showSaveError(resolved.error);
            return false;
          }
          if (resolved.action === "save_copy_as") return true;
          if (resolved.action === "discard_reload") return false;
        } else if (saveRes && saveRes.missingOnDisk) {
          const handled = await handleMissingWorkingCopySave(p);
          if (!handled || !handled.ok) return false;
          if (handled.action === "save_as") return true;
        } else {
          await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to save file.");
          return false;
        }
      }

      snapshot = await refreshWorkingCopySnapshot();
      if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, p)) {
        await showSaveError("Save completed, but the working copy could not be refreshed.");
        return false;
      }

      setFileContentInCache(p, snapshot.text);
      attachTuneUidsToLibraryFile(p, snapshot);
      patchCurrentDocument({ path: p, content: getEditorValue(), dirty: false }, { create: false });
      if (includeHeader) {
        markHeaderClean();
        updateHeaderStateUI();
      }
      markDiskConflictPath(p, false);
      resetTransposePreviewState();
      setDirtyIndicator(false);
      setActiveFilePath(p);
      const updatedFile = await refreshLibraryFile(p, { force: true });
      reconcileActiveTuneAfterSave(p, updatedFile);
      updateLibraryStatus();
      scheduleRenderLibraryTree();
      updateFileHeaderPanel();
      scheduleAutoWcDump("save-simple", safeBasename(p));
      recordRecentAction("save.simple_tune.ok", { path: p });
      return true;
    });
  }

  async function performSaveFlow() {
    const currentDocument = getCurrentDocument();
    if (!currentDocument) return false;
    const session = resolveSaveSession();
    const activeFilePath = getActiveFilePath();
    const activeTuneMeta = getActiveTuneMeta();
    const workingCopySnapshot = getWorkingCopySnapshot();

    recordRecentAction("save.start", {
      currentDocPath: currentDocument.path ? String(currentDocument.path) : null,
      currentDocDirty: Boolean(currentDocument.dirty),
      headerDirty: getHeaderDirty(),
      isNewTuneDraft: Boolean(getIsNewTuneDraft()),
      activeTunePath: activeTuneMeta && activeTuneMeta.path ? String(activeTuneMeta.path) : null,
      wcSnapshotPath: workingCopySnapshot && workingCopySnapshot.path ? String(workingCopySnapshot.path) : null,
      payloadMode: Boolean(isPayloadMode()),
      rawMode: Boolean(getRawMode()),
      focusMode: Boolean(getFocusModeEnabled()),
      saveIntent: session.intent,
      saveTargetPath: session.targetPath || null,
      saveSource: session.source || null,
    });

    const headerTargetPath = String(
      session.targetPath
      || activeFilePath
      || (activeTuneMeta && activeTuneMeta.path)
      || ""
    );
    const combineHeaderWithWorkingCopySave = Boolean(
      getHeaderDirty()
      && headerTargetPath
      && session.intent === SAVE_INTENT.REPLACE_TUNE
      && activeTuneMeta
      && activeTuneMeta.path
      && pathsEqual(activeTuneMeta.path, headerTargetPath)
    );
    if (getHeaderDirty() && headerTargetPath && !combineHeaderWithWorkingCopySave) {
      try {
        const headerRes = await saveFileHeaderText(headerTargetPath, getHeaderEditorValue());
        if (headerRes && headerRes.ok) {
          markHeaderClean();
          updateHeaderStateUI();
          setStatus(headerRes.action === "save_copy_as" ? "Saved copy and switched." : "Header saved.");
        } else if (headerRes && headerRes.action === "discard_reload") {
          resetHeaderEditorFilePath();
          markHeaderClean();
          updateHeaderStateUI();
          updateFileHeaderPanel();
          setStatus("Reloaded from disk.");
          return false;
        } else {
          setStatus("Save canceled.");
          updateHeaderStateUI();
          return false;
        }
      } catch (e) {
        await showSaveError(e && e.message ? e.message : String(e));
        updateHeaderStateUI();
        return false;
      }
    }

    if (isChordProEnabled()) {
      const filePath = activeFilePath || getCurrentDocumentPath() || "";
      if (!filePath) return performSaveAsFlow();
      const wcOk = await ensureWorkingCopyOpenForPath(filePath);
      if (!wcOk) {
        await showSaveError("Unable to save file: no working copy open.");
        return false;
      }
      await refreshWorkingCopySnapshot();
      try {
        await flushWorkingCopyFullSync();
      } catch {}
      if (api && typeof api.commitWorkingCopyToDisk === "function") {
        const snapshotToSave = await refreshWorkingCopySnapshot();
        if (!snapshotToSave || !snapshotToSave.path || !pathsEqual(snapshotToSave.path, filePath)) {
          await showSaveError("Unable to save: working copy no longer matches the active file.");
          return false;
        }
        const res = await api.commitWorkingCopyToDisk({
          force: false,
          expectedPath: filePath,
          expectedVersion: snapshotToSave.version,
        });
        if (res && res.missingOnDisk) {
          const handled = await handleMissingWorkingCopySave(filePath);
          return Boolean(handled && handled.ok);
        }
        if (res && res.ok) {
          markDiskConflictPath(filePath, false);
          const snap = await refreshWorkingCopySnapshot();
          if (snap && snap.path && pathsEqual(snap.path, filePath)) {
            setFileContentInCache(filePath, snap.text);
          }
          markCurrentDocumentClean();
          setDirtyIndicator(false);
          updateWindowTitle();
          return true;
        }
        if (res && res.conflict) {
          const resolved = await resolveWorkingCopySaveConflictDefault(filePath, { restoreTuneId: getActiveTuneUid() || getActiveTuneId() });
          if (resolved && resolved.ok && resolved.action === "overwrite") {
            const snap = await refreshWorkingCopySnapshot();
            if (snap && snap.path && pathsEqual(snap.path, filePath)) {
              setFileContentInCache(filePath, snap.text);
            }
            markCurrentDocumentClean();
            setDirtyIndicator(false);
            updateWindowTitle();
            return true;
          }
          if (resolved && resolved.ok && resolved.action === "save_copy_as") {
            setStatus("Saved copy and switched.");
            return true;
          }
          if (resolved && resolved.action === "discard_reload") {
            setStatus("Reloaded from disk.");
            return false;
          }
          if (resolved && resolved.error) await showSaveError(resolved.error);
          return false;
        }
        if (await handlePermissionDeniedSave(filePath, (res && res.error) ? res.error : "")) return true;
        await showSaveError((res && res.error) ? res.error : "Unable to save file.");
        return false;
      }
      await showSaveError("Internal error: working copy save is unavailable.");
      return false;
    }

    if (session.intent === SAVE_INTENT.APPEND_TO_FILE && session.targetPath) {
      setActiveFilePath(String(session.targetPath));
      const ok = await performAppendFlow();
      return Boolean(ok);
    }

    if (session.intent === SAVE_INTENT.REPLACE_TUNE && activeTuneMeta && activeTuneMeta.path) {
      const ok = await performSimpleTuneSave(activeTuneMeta.path, {
        includeHeader: Boolean(combineHeaderWithWorkingCopySave && getHeaderDirty()),
      });
      return Boolean(ok);
    }

    if (session.intent === SAVE_INTENT.FULL_FILE && getCurrentDocumentPath()) {
      const filePath = getCurrentDocumentPath();
      await showSaveError(
        isWorkingCopyOpenForFile(filePath)
          ? "Internal error: full-file content was not routed through its working copy."
          : "Unable to save safely: file context is missing. Re-open the file and try again."
      );
      return false;
    }

    if (session.intent === SAVE_INTENT.REPLACE_TUNE && (!activeTuneMeta || !activeTuneMeta.path)) {
      await showSaveError("Unable to save: tune context is missing. Re-open the tune and try again.");
      return false;
    }
    if (session.intent === SAVE_INTENT.APPEND_TO_FILE && !session.targetPath) {
      await showSaveError("Unable to save: append target is missing. Select/open the target file and try again.");
      return false;
    }

    return performSaveAsFlow();
  }

  async function performSaveAsFlow() {
    const currentDocument = getCurrentDocument();
    if (!currentDocument) return false;

    if (isChordProEnabled()) {
      try {
        await flushWorkingCopyFullSync();
      } catch {}

      const currentPath = getActiveFilePath() || getCurrentDocumentPath() || "";
      const base = currentPath ? safeBasename(currentPath) : "";
      const extMatch = base.match(/(\.[^.]+)$/);
      const suffix = extMatch ? extMatch[1] : ".cho";
      const suggestedName = `${stripFileExtension(base || "untitled")}${suffix}`;
      const suggestedDir = getDefaultSaveDir();
      if (currentPath) {
        const opened = await ensureWorkingCopyOpenForPath(currentPath);
        if (!opened) {
          const reason = typeof getWorkingCopyOpenError === "function" ? String(getWorkingCopyOpenError() || "") : "";
          await showSaveError(reason
            ? `Unable to save as: ${reason}`
            : "Unable to save as: source working copy could not be opened.");
          return false;
        }
      }
      const filePath = await showSaveDialog(suggestedName, suggestedDir);
      if (!filePath) return false;
      if (currentPath && pathsEqual(normalizeLibraryPath(filePath), normalizeLibraryPath(currentPath))) {
        await showSaveError("Save As destination must be different from the source file.");
        return false;
      }
      if (await fileExists(filePath) && (await confirmOverwrite(filePath)) !== "replace") return false;

      const hasWorkingCopy = Boolean(
        currentPath
        && isWorkingCopyOpenForFile(currentPath)
        && api
        && typeof api.writeWorkingCopyToPathAndSwitch === "function"
      );
      if (!hasWorkingCopy) {
        const content = String((isChordProFullView() ? getEditorValue() : getChordProFullText()) || "");
        const saved = await createNewFileAtPath(filePath, content, { confirmOverwrite: false });
        if (!saved) return false;
        patchCurrentDocument({ path: filePath, dirty: false }, { create: false });
        resetTransposePreviewState();
        setActiveFilePath(filePath);
        setFileNameMeta(stripFileExtension(safeBasename(filePath)));
        updateWindowTitle();
        return true;
      }

      const sourceSnapshot = await refreshWorkingCopySnapshot();
      if (!sourceSnapshot || !sourceSnapshot.path || !pathsEqual(sourceSnapshot.path, currentPath)) {
        await showSaveError("Unable to save as: working copy no longer matches the active file.");
        return false;
      }
      const out = await api.writeWorkingCopyToPathAndSwitch(filePath, {
        expectedPath: currentPath,
        expectedVersion: sourceSnapshot.version,
      });
      if (!out || !out.ok) {
        await showSaveError((out && out.error) ? out.error : "Unable to save file.");
        return false;
      }
      const snap = await refreshWorkingCopySnapshot();
      if (snap && snap.path && pathsEqual(snap.path, filePath)) {
        setFileContentInCache(filePath, snap.text);
      }
      patchCurrentDocument({ path: filePath, dirty: false }, { create: false });
      resetTransposePreviewState();
      setActiveFilePath(filePath);
      setDirtyIndicator(false);
      setFileNameMeta(stripFileExtension(safeBasename(filePath)));
      updateWindowTitle();
      return true;
    }

    try {
      await flushWorkingCopyTuneSync();
    } catch {}
    if (getHeaderDirty() && api && typeof api.applyWorkingCopyHeaderText === "function") {
      try {
        const headerSnapshot = await refreshWorkingCopySnapshot();
        const headerPath = headerSnapshot && headerSnapshot.path ? String(headerSnapshot.path) : "";
        const res = headerPath
          ? await api.applyWorkingCopyHeaderText(getHeaderEditorValue(), {
            expectedPath: headerPath,
            expectedVersion: headerSnapshot.version,
          })
          : { ok: false };
        if (res && res.ok) {
          markHeaderClean();
          updateHeaderStateUI();
        }
      } catch {}
    }

    const suggestedName = `${getSuggestedBaseName()}.abc`;
    const suggestedDir = getDefaultSaveDir();
    const filePath = await showSaveDialog(suggestedName, suggestedDir);
    if (!filePath) return false;
    const sourcePath = getActiveFilePath() || getCurrentDocumentPath() || "";
    if (sourcePath && pathsEqual(normalizeLibraryPath(filePath), normalizeLibraryPath(sourcePath))) {
      await showSaveError("Save As destination must be different from the source file.");
      return false;
    }
    if (await fileExists(filePath) && (await confirmOverwrite(filePath)) !== "replace") return false;

    const activeTuneMeta = getActiveTuneMeta();
    const workingCopySnapshot = getWorkingCopySnapshot();
    const hasWorkingCopy = Boolean(
      activeTuneMeta
      && activeTuneMeta.path
      && workingCopySnapshot
      && workingCopySnapshot.path
      && pathsEqual(workingCopySnapshot.path, activeTuneMeta.path)
      && api
      && typeof api.writeWorkingCopyToPathAndSwitch === "function"
    );
    if (!hasWorkingCopy) {
      const content = serializeDocument(currentDocument);
      const saved = await createNewFileAtPath(filePath, content, { confirmOverwrite: false });
      if (!saved) return false;
      const libraryIndex = getLibraryIndex();
      const root = libraryIndex && libraryIndex.root ? normalizeLibraryPath(libraryIndex.root) : "";
      const normalizedDest = normalizeLibraryPath(filePath);
      const inRoot = Boolean(
        root
        && (normalizedDest === root || normalizedDest.startsWith(root.endsWith("/") ? root : `${root}/`))
      );
      if (!inRoot) {
        const dirPath = safeDirname(filePath);
        showToastWithAction(
          "Saved file outside current Library.",
          "Load folder…",
          () => { loadLibraryFromFolder(dirPath).catch(() => {}); },
          8000
        );
      }
      setFileContentInCache(filePath, content);
      patchCurrentDocument({ path: filePath, dirty: false }, { create: false });
      setDirtyIndicator(false);
      setFileNameMeta(stripFileExtension(safeBasename(filePath)));
      updateFileHeaderPanel();
      updateWindowTitle();
      return true;
    }

    const out = await api.writeWorkingCopyToPathAndSwitch(filePath, {
      expectedPath: activeTuneMeta.path,
      expectedVersion: workingCopySnapshot.version,
    });
    if (!out || !out.ok) {
      await showSaveError((out && out.error) ? out.error : "Unable to save file.");
      return false;
    }
    try {
      await refreshLibraryFile(filePath, { force: true });
    } catch {}

    const switched = await loadLibraryFileIntoEditor(filePath, { skipConfirm: true });
    if (switched && switched.ok) {
      const libraryIndex = getLibraryIndex();
      const root = libraryIndex && libraryIndex.root ? normalizeLibraryPath(libraryIndex.root) : "";
      const normalizedDest = normalizeLibraryPath(filePath);
      const inRoot = Boolean(
        root
        && (normalizedDest === root || normalizedDest.startsWith(root.endsWith("/") ? root : `${root}/`))
      );
      if (!inRoot) {
        const dir = safeDirname(filePath);
        showToastWithAction(
          "Saved file outside current Library.",
          "Load folder…",
          () => { loadLibraryFromFolder(dir).catch(() => {}); },
          8000
        );
      }
      return true;
    }
    return true;
  }

  async function saveFileHeaderText(filePath, headerText) {
    const p = String(filePath || "");
    if (!p) throw new Error("Missing file path.");
    if (
      !api
      || typeof api.openWorkingCopy !== "function"
      || typeof api.applyWorkingCopyHeaderText !== "function"
      || typeof api.commitWorkingCopyToDisk !== "function"
    ) {
      throw new Error("Working copy header save is unavailable.");
    }

    return withFileLock(p, async () => {
      const opened = await api.openWorkingCopy(p);
      if (!opened || !opened.ok) {
        throw new Error((opened && opened.error) ? opened.error : "Unable to open working copy.");
      }
      const snapshotBefore = await refreshWorkingCopySnapshot();
      if (!snapshotBefore || !snapshotBefore.path || !pathsEqual(snapshotBefore.path, p)) {
        throw new Error("Working copy no longer matches the header file.");
      }
      const applyRes = await api.applyWorkingCopyHeaderText(String(headerText || ""), {
        expectedPath: p,
        expectedVersion: snapshotBefore.version,
      });
      if (!applyRes || !applyRes.ok) throw new Error((applyRes && applyRes.error) ? applyRes.error : "Unable to update header.");

      const snapshotToSave = await refreshWorkingCopySnapshot();
      if (!snapshotToSave || !snapshotToSave.path || !pathsEqual(snapshotToSave.path, p)) {
        throw new Error("Working copy no longer matches the header file.");
      }
      const saveRes = await api.commitWorkingCopyToDisk({
        force: false,
        expectedPath: p,
        expectedVersion: snapshotToSave.version,
      });
      if (saveRes && saveRes.missingOnDisk) {
        const handled = await handleMissingWorkingCopySave(p);
        if (handled && handled.ok) return { ok: true, action: "saved" };
        return { ok: false, action: "cancel" };
      }
      if (!saveRes || !saveRes.ok) {
        if (saveRes && saveRes.conflict) {
          const tuneIdToRestore = getRawMode() ? getActiveTuneId() : (getActiveTuneUid() || getActiveTuneId());
          const resolved = await resolveWorkingCopySaveConflictDefault(p, { restoreTuneId: tuneIdToRestore });
          if (resolved && resolved.ok && resolved.action === "overwrite") {
            // continue below
          } else if (resolved && resolved.ok && resolved.action === "save_copy_as") {
            return { ok: true, action: "save_copy_as" };
          } else {
            if (resolved && resolved.error) throw new Error(resolved.error);
            if (resolved && resolved.action === "discard_reload") return { ok: false, action: "discard_reload" };
            return { ok: false, cancelled: true, action: "cancel" };
          }
        } else {
          throw new Error((saveRes && saveRes.error) ? saveRes.error : "Unable to save header.");
        }
      }

      markDiskConflictPath(p, false);
      const snapshot = await refreshWorkingCopySnapshot();
      if (snapshot && snapshot.path && pathsEqual(snapshot.path, p)) {
        setFileContentInCache(p, snapshot.text);
        attachTuneUidsToLibraryFile(p, snapshot);
      }
      const updatedFile = await refreshLibraryFile(p, { force: true });
      try {
        if (updatedFile && updatedFile.path && pathsEqual(updatedFile.path, p) && isHeaderEditorFilePath(p)) {
          markHeaderClean();
          updateHeaderStateUI();
        }
      } catch {}
      const activeTuneMeta = getActiveTuneMeta();
      if (activeTuneMeta && pathsEqual(activeTuneMeta.path, p)) {
        const tuneIdToRestore = getRawMode() ? getActiveTuneId() : (getActiveTuneUid() || getActiveTuneId());
        if (tuneIdToRestore) await selectTune(tuneIdToRestore, { skipConfirm: true, suppressRecent: true });
        const label = updatedFile ? updatedFile.basename : safeBasename(p);
        setFileNameMeta(stripFileExtension(label || ""));
      }
      return { ok: true, action: "saved" };
    });
  }

  return {
    finalizeWorkingCopySave,
    handleMissingWorkingCopySave,
    performRawSaveFlow,
    performSaveAsFlow,
    performSaveFlow,
    performSimpleTuneSave,
    saveFileHeaderText,
  };
}
