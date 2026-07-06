const SAVE_INTENT = Object.freeze({
  NONE: "none",
  REPLACE_TUNE: "replace_tune",
  APPEND_TO_FILE: "append_to_file",
  FULL_FILE: "full_file",
});

function createBlankDocument(content = "") {
  return {
    path: null,
    dirty: false,
    content: String(content || ""),
  };
}

function serializeDocument(doc) {
  return doc ? String(doc.content || "") : "";
}

function deserializeToDocument(data) {
  return {
    path: null,
    dirty: false,
    content: String(data || ""),
  };
}

function createEmptySaveSession() {
  return {
    intent: SAVE_INTENT.NONE,
    targetPath: "",
    targetTuneUid: "",
    source: "",
  };
}

function normalizeSaveSession(next = {}) {
  const n = next || {};
  const intent = String(n.intent || SAVE_INTENT.NONE);
  return {
    intent: Object.values(SAVE_INTENT).includes(intent) ? intent : SAVE_INTENT.NONE,
    targetPath: String(n.targetPath || ""),
    targetTuneUid: String(n.targetTuneUid || ""),
    source: String(n.source || ""),
  };
}

function createDocumentSessionController({
  api = null,
  state = {},
  actions = {},
} = {}) {
  const {
    getCurrentDoc = () => null,
    getActiveFilePath = () => "",
    getActiveTuneMeta = () => null,
    getActiveTuneUid = () => "",
    getCurrentNavFilePath = () => "",
    getHeaderDirty = () => false,
    hasUnsavedChangesInActiveEditContext = () => false,
    isChordProEnabled = () => false,
    isNewTuneDraft = () => false,
    isPayloadMode = () => false,
    isRawMode = () => false,
    getRawModeFilePath = () => "",
  } = state;

  const {
    discardWorkingCopyChangesForActiveFile = async () => false,
    flushLibraryPrefsSave = async () => {},
    markHeaderClean = () => {},
    performRawSaveFlow = async () => false,
    performSaveAsFlow = async () => false,
    performSaveFlow = async () => false,
    setDirtyIndicator = () => {},
    showToast = () => {},
    clearCurrentDocument = () => {},
    updateHeaderStateUI = () => {},
  } = actions;

  let saveSession = createEmptySaveSession();
  let abandonFlowInProgress = false;

  function clearSaveSession() {
    saveSession = createEmptySaveSession();
  }

  function setSaveSession(next) {
    saveSession = normalizeSaveSession(next);
  }

  function resolveSaveSession() {
    const currentDoc = getCurrentDoc();
    const activeFilePath = String(getActiveFilePath() || "");
    const activeTuneMeta = getActiveTuneMeta();
    const activeTuneUid = String(getActiveTuneUid() || "");
    const currentNavFilePath = String(getCurrentNavFilePath() || "");

    if (isChordProEnabled()) {
      const path = String(activeFilePath || (currentDoc && currentDoc.path) || currentNavFilePath || "");
      if (path) return { intent: SAVE_INTENT.FULL_FILE, targetPath: path, targetTuneUid: "", source: "chordpro" };
    }
    if (isRawMode()) {
      const path = String(getRawModeFilePath() || activeFilePath || (currentDoc && currentDoc.path) || currentNavFilePath || "");
      if (path) return { intent: SAVE_INTENT.FULL_FILE, targetPath: path, targetTuneUid: "", source: "raw" };
    }
    if (isNewTuneDraft()) {
      const path = String(activeFilePath || currentNavFilePath || "");
      if (path) return { intent: SAVE_INTENT.APPEND_TO_FILE, targetPath: path, targetTuneUid: "", source: "draft" };
    }
    if (activeTuneMeta && activeTuneMeta.path) {
      const path = String(activeTuneMeta.path || "");
      if (path) {
        return {
          intent: SAVE_INTENT.REPLACE_TUNE,
          targetPath: path,
          targetTuneUid: activeTuneUid,
          source: "active_tune",
        };
      }
    }
    if (currentDoc && currentDoc.path) {
      return { intent: SAVE_INTENT.FULL_FILE, targetPath: String(currentDoc.path), targetTuneUid: "", source: "doc_path" };
    }
    if (saveSession && saveSession.intent && saveSession.intent !== SAVE_INTENT.NONE) {
      return { ...saveSession };
    }
    return createEmptySaveSession();
  }

  async function confirmUnsavedChanges(contextLabel) {
    if (!api || typeof api.confirmUnsavedChanges !== "function") return "cancel";
    return api.confirmUnsavedChanges(contextLabel);
  }

  async function confirmAbandonIfDirty(contextLabel) {
    const currentDoc = getCurrentDoc();
    const tuneDirty = Boolean(currentDoc && currentDoc.dirty);
    const hdrDirty = Boolean(getHeaderDirty());
    const fileDirty = Boolean(hasUnsavedChangesInActiveEditContext());
    if (!tuneDirty && !hdrDirty && !fileDirty) return true;

    const choice = await confirmUnsavedChanges(contextLabel);
    if (choice === "cancel") return false;
    if (choice === "dont_save") {
      markHeaderClean();
      updateHeaderStateUI();
      if (tuneDirty) {
        await discardWorkingCopyChangesForActiveFile();
      }
      return true;
    }

    const ok = isRawMode() ? await performRawSaveFlow() : await performSaveFlow();
    return Boolean(ok);
  }

  async function ensureSafeToAbandonCurrentDoc(actionLabel) {
    return confirmAbandonIfDirty(actionLabel);
  }

  async function fileSave() {
    if (!getCurrentDoc()) return;
    if (isPayloadMode()) {
      showToast("Payload Mode is diagnostics-only (no saves).", 2600);
      return;
    }
    if (isRawMode()) {
      await performRawSaveFlow();
      return;
    }
    await performSaveFlow();
  }

  async function fileSaveAs() {
    if (!getCurrentDoc()) return;
    if (isPayloadMode()) {
      showToast("Exit Payload Mode to Save As.", 2400);
      return;
    }
    await performSaveAsFlow();
  }

  async function requestCloseDocument() {
    if (abandonFlowInProgress) return;
    if (!getCurrentDoc()) return;
    abandonFlowInProgress = true;
    try {
      const ok = await confirmAbandonIfDirty("closing this file");
      if (!ok) return;
      clearCurrentDocument();
      setDirtyIndicator(false);
    } finally {
      abandonFlowInProgress = false;
    }
  }

  async function requestQuitApplication() {
    if (abandonFlowInProgress) return;
    abandonFlowInProgress = true;
    let quitRequested = false;
    try {
      if (api && typeof api.cancelQuitRequest === "function") {
        try { await api.cancelQuitRequest(); } catch {}
      }
      const ok = await confirmAbandonIfDirty("quitting");
      if (!ok) return;
      await flushLibraryPrefsSave();
      if (api && typeof api.quitApplication === "function") {
        quitRequested = true;
        await api.quitApplication();
      }
    } finally {
      if (!quitRequested && api && typeof api.cancelQuitRequest === "function") {
        try { await api.cancelQuitRequest(); } catch {}
      }
      abandonFlowInProgress = false;
    }
  }

  async function fileClose() {
    await requestCloseDocument();
  }

  return {
    clearSaveSession,
    confirmAbandonIfDirty,
    confirmUnsavedChanges,
    deserializeToDocument,
    ensureSafeToAbandonCurrentDoc,
    fileClose,
    fileSave,
    fileSaveAs,
    resolveSaveSession,
    requestCloseDocument,
    requestQuitApplication,
    serializeDocument,
    setSaveSession,
  };
}

export {
  SAVE_INTENT,
  createBlankDocument,
  createDocumentSessionController,
  deserializeToDocument,
  serializeDocument,
};
