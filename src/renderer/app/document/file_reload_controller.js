function createFileReloadController({ api = null, state = {}, actions = {}, utils = {} } = {}) {
  const { getRawMode = () => false } = state;
  const {
    refreshLibraryFile = async () => null,
    readFile = async () => ({ ok: false }),
    writeFile = async () => ({ ok: false }),
    fileExists = async () => false,
    confirmOverwrite = async () => "cancel",
    safeBasename = (p) => String(p || "").split("/").pop() || "",
    safeDirname = () => "",
    selectTune = async () => {},
    switchFileContext = () => {},
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

  async function confirmReloadFromDisk(filePath) {
    if (!api || typeof api.confirmReloadFromDisk !== "function") return false;
    return Boolean(await api.confirmReloadFromDisk(filePath));
  }

  async function discardAndReloadFileFromDisk(filePath, { restoreTuneId = null } = {}) {
    const p = String(filePath || "");
    if (!p) return { ok: false, error: "Missing file path." };
    const disk = await readFile(p);
    if (!disk || !disk.ok) return { ok: false, error: disk && disk.error ? disk.error : "Unable to read file from disk." };
    const text = String(disk.data || "");
    setFileContentInCache(p, text);
    const updatedFile = await refreshLibraryFile(p, { force: true });
    if (updatedFile && Number.isFinite(updatedFile.headerEndOffset)) setRawModeHeaderEndOffset(updatedFile.headerEndOffset);
    if (getRawMode()) {
      const parts = splitFileIntoHeaderAndBody(text);
      setHeaderEditorValueClean(parts.headerText);
      setEditorValueClean(parts.bodyText);
      setHeaderClean();
      updateHeaderStateUI();
      patchCurrentDocument({ path: p, content: parts.bodyText, dirty: false }, { create: false });
      setRawModeFilePath(p);
    } else if (restoreTuneId) {
      try { await selectTune(restoreTuneId, { skipConfirm: true, suppressRecent: true }); } catch {}
    }
    setDirtyIndicator(false);
    markDiskConflictPath(p, false);
    return { ok: true, updatedFile };
  }

  async function saveFileCopyAsAndSwitch(sourcePath, { restoreTuneId = null } = {}) {
    const fromPath = String(sourcePath || "");
    if (!fromPath || !api || typeof api.showSaveDialog !== "function") return { ok: false, error: "Save Copy As is unavailable." };
    const targetPath = await api.showSaveDialog(`${stripFileExtension(safeBasename(fromPath)) || "Untitled"}_Copy.abc`, safeDirname(fromPath) || undefined);
    if (!targetPath) return { ok: false, cancelled: true };
    if (await fileExists(targetPath) && (await confirmOverwrite(targetPath)) !== "replace") return { ok: false, cancelled: true };
    const source = await readFile(fromPath);
    if (!source || !source.ok) return { ok: false, error: source && source.error ? source.error : "Unable to read source file." };
    const sourceText = String(source.data || "");
    return withFileLock(targetPath, async () => {
      const writeRes = await writeFile(targetPath, sourceText, { expectedData: null });
      if (!writeRes || !writeRes.ok) return { ok: false, error: writeRes && writeRes.error ? writeRes.error : "Unable to save copy." };
      setFileContentInCache(targetPath, sourceText);
      const updatedFile = await refreshLibraryFile(targetPath, { force: true });
      if (updatedFile && updatedFile.basename) setFileNameMeta(stripFileExtension(updatedFile.basename));
      switchFileContext(targetPath, { rawMode: getRawMode(), source: "save_copy_as" });
      if (getRawMode()) {
        const parts = splitFileIntoHeaderAndBody(sourceText);
        setHeaderEditorValueClean(parts.headerText);
        setEditorValueClean(parts.bodyText);
        setHeaderClean();
        updateHeaderStateUI();
        patchCurrentDocument({ path: targetPath, content: parts.bodyText, dirty: false }, { create: false });
        setRawModeFilePath(targetPath);
      } else if (restoreTuneId) {
        try { await selectTune(restoreTuneId, { skipConfirm: true, suppressRecent: true }); } catch {}
      }
      setDirtyIndicator(false);
      markDiskConflictPath(fromPath, false);
      markDiskConflictPath(targetPath, false);
      return { ok: true, updatedFile, targetPath };
    });
  }

  async function resolveFileSaveConflictDefault(filePath) {
    markDiskConflictPath(filePath, true);
    return { ok: false, cancelled: true, action: "cancel", error: "File changed on disk. Reload it before saving." };
  }

  return { confirmReloadFromDisk, discardAndReloadFileFromDisk, resolveFileSaveConflictDefault, saveFileCopyAsAndSwitch };
}

export { createFileReloadController };
