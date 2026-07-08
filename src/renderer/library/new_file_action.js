export function createNewFileAction({
  api = null,
  SAVE_INTENT = {},
  constants = {},
  state = {},
  actions = {},
} = {}) {
  const {
    getActiveFilePath = () => "",
    getActiveTuneMeta = () => null,
    hasActiveErrorHighlight = () => false,
    hasEditor = () => false,
  } = state;
  const {
    newFileMinimalAbc = "X:1\nT:\nK:C\n",
    templateAbc = "X:1\nT:\nK:C\n",
  } = constants;
  const {
    clearActiveErrorHighlight = () => {},
    confirmOverwrite = async () => false,
    ensureSafeToAbandonCurrentDoc = async () => false,
    ensureXNumberInAbc = (text) => text,
    fileExists = async () => false,
    getDefaultSaveDir = () => "",
    getFileContentCached = async () => ({ ok: false }),
    getNextXNumber = () => "",
    getSuggestedBaseName = () => "",
    loadLibraryFileIntoEditor = async () => ({ ok: false }),
    markDirtyEditorSet = () => {},
    mkdirp = async () => {},
    patchCurrentDocument = () => {},
    recordNavFilePath = () => {},
    refreshHeaderLayers = async () => {},
    refreshLibraryFile = async () => null,
    refreshWorkingCopySnapshot = async () => null,
    resetPlaybackState = () => {},
    safeBasename = (path) => String(path || "").split("/").pop() || "",
    safeDirname = () => "",
    scheduleRenderNow = () => {},
    setActiveFilePath = () => {},
    setActiveTuneId = () => {},
    setActiveTuneMeta = () => {},
    setActiveTuneText = () => {},
    setDirtyIndicator = () => {},
    setEditorValue = () => {},
    setFileContentInCache = () => {},
    setFileNameMeta = () => {},
    setNewTuneDraft = () => {},
    setSaveSession = () => {},
    setTuneMetaText = () => {},
    showSaveDialog = async () => "",
    showSaveError = async () => {},
    showToast = () => {},
    stripFileExtension = (name) => String(name || "").replace(/\.[^.]*$/, ""),
    updateFileContext = () => {},
    updateFileHeaderPanel = () => {},
    updateWindowTitle = () => {},
    withFileLock = async (_path, fn) => fn(),
    writeFile = async () => ({ ok: false }),
  } = actions;

  async function fileNew() {
    const ok = await ensureSafeToAbandonCurrentDoc("creating a new file");
    if (!ok) return;
    const suggestedName = `${getSuggestedBaseName() || "NewTune"}.abc`;
    const suggestedDir = getDefaultSaveDir();
    const filePath = await showSaveDialog(suggestedName, suggestedDir);
    if (!filePath) return;
    const created = await createNewFileAtPath(filePath, newFileMinimalAbc, { confirmOverwrite: false });
    if (created) showToast("New file created.", 2200);
  }

  async function createNewFileAtPath(filePath, content, options = {}) {
    if (!filePath) return false;
    const dir = safeDirname(filePath);
    if (dir) await mkdirp(dir);
    if (await fileExists(filePath) && options.confirmOverwrite) {
      const ok = await confirmOverwrite(filePath);
      if (!ok) return false;
    }
    const writeRes = await withFileLock(filePath, async () => writeFile(filePath, content));
    if (!writeRes || !writeRes.ok) {
      await showSaveError((writeRes && writeRes.error) ? writeRes.error : "Unable to create file.");
      return false;
    }
    setFileContentInCache(filePath, content);
    patchCurrentDocument({ path: filePath, dirty: false }, { create: false });
    setDirtyIndicator(false);
    setFileNameMeta(stripFileExtension(safeBasename(filePath)));
    updateFileHeaderPanel();
    updateWindowTitle();
    try { await refreshLibraryFile(filePath, { force: true }); } catch {}
    const switched = await loadLibraryFileIntoEditor(filePath);
    if (switched && switched.ok) return true;
    setActiveFilePath(filePath);
    recordNavFilePath(filePath);
    try {
      if (api && typeof api.openWorkingCopy === "function") {
        await api.openWorkingCopy(filePath);
        await refreshWorkingCopySnapshot();
      }
    } catch {}
    setActiveTuneText(content, null, { markDirty: false });
    return true;
  }

  async function fileNewFromTemplate() {
    const ok = await ensureSafeToAbandonCurrentDoc("creating a new tune");
    if (!ok) return;

    const activeTuneMeta = getActiveTuneMeta();
    const targetPath = (activeTuneMeta && activeTuneMeta.path)
      ? String(activeTuneMeta.path)
      : (getActiveFilePath() ? String(getActiveFilePath()) : "");
    if (!targetPath) {
      setActiveTuneText(templateAbc, null, { markDirty: true });
      showToast("Template opened.", 1800);
      return;
    }

    let nextX = "";
    try {
      const res = await getFileContentCached(targetPath);
      if (res && res.ok) nextX = getNextXNumber(res.data || "");
    } catch {}

    const withX = ensureXNumberInAbc(templateAbc, nextX || "");
    setNewTuneDraftInActiveFile(withX, {
      filePath: targetPath,
      basename: (activeTuneMeta && activeTuneMeta.basename) ? activeTuneMeta.basename : safeBasename(targetPath),
      xNumber: nextX,
    });
    showToast("New tune draft from template (Save will append to the active file).", 3200);
  }

  function setNewTuneDraftInActiveFile(text, { filePath, basename, xNumber } = {}) {
    if (!hasEditor()) return;
    if (!filePath) return;
    if (hasActiveErrorHighlight()) clearActiveErrorHighlight("docReplaced");
    resetPlaybackState();

    markDirtyEditorSet(true);
    setEditorValue(text);
    markDirtyEditorSet(false);

    setNewTuneDraft(true);
    setActiveTuneMeta(null);
    setActiveTuneId(null);
    setActiveFilePath(filePath);
    setSaveSession({
      intent: SAVE_INTENT.APPEND_TO_FILE,
      targetPath: String(filePath || ""),
      targetTuneUid: "",
      source: "new_tune_draft",
    });

    refreshHeaderLayers().catch(() => {});
    const label = xNumber ? `New tune (X:${xNumber})` : "New tune";
    setTuneMetaText(label);
    setFileNameMeta(stripFileExtension(basename || safeBasename(filePath)));

    patchCurrentDocument({ path: null, content: text || "", dirty: true });
    updateFileContext();
    setDirtyIndicator(true);
    updateFileHeaderPanel();
    scheduleRenderNow({ clearOutput: true });
  }

  return {
    createNewFileAtPath,
    fileNew,
    fileNewFromTemplate,
    setNewTuneDraftInActiveFile,
  };
}
