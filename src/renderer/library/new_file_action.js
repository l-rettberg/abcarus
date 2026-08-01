import {
  NEW_FILE_MINIMAL_ABC,
  NEW_FILE_TEMPLATE_ABC,
} from "../abc/default_documents.js";

export function createNewFileAction({
  api = null,
  actions = {},
} = {}) {
  const {
    confirmOverwrite = async () => false,
    ensureSafeToAbandonCurrentDoc = async () => false,
    ensureXNumberInAbc = (text) => text,
    fileExists = async () => false,
    getDefaultSaveDir = () => "",
    getSuggestedBaseName = () => "",
    loadLibraryFileIntoEditor = async () => ({ ok: false }),
    mkdirp = async () => {},
    patchCurrentDocument = () => {},
    refreshLibraryFile = async () => null,
    refreshWorkingCopySnapshot = async () => null,
    safeBasename = (path) => String(path || "").split("/").pop() || "",
    safeDirname = () => "",
    setActiveFilePath = () => {},
    setActiveTuneText = () => {},
    setDirtyIndicator = () => {},
    setFileContentInCache = () => {},
    setFileNameMeta = () => {},
    showSaveDialog = async () => "",
    showSaveError = async () => {},
    showToast = () => {},
    stripFileExtension = (name) => String(name || "").replace(/\.[^.]*$/, ""),
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
    const created = await createNewFileAtPath(filePath, NEW_FILE_MINIMAL_ABC, { confirmOverwrite: false });
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
    const switched = await loadLibraryFileIntoEditor(filePath, { skipConfirm: true });
    setActiveFilePath(filePath);
    try {
      if (api && typeof api.openWorkingCopy === "function") {
        await api.openWorkingCopy(filePath);
        await refreshWorkingCopySnapshot();
      }
    } catch {}
    if (switched && switched.ok) {
      patchCurrentDocument({ path: filePath, dirty: false }, { create: false });
      setDirtyIndicator(false);
      updateWindowTitle();
      return true;
    }
    setActiveTuneText(content, null, { markDirty: false });
    patchCurrentDocument({ path: filePath, content, dirty: false }, { create: false });
    setDirtyIndicator(false);
    updateWindowTitle();
    return true;
  }

  async function fileNewFromTemplate() {
    const ok = await ensureSafeToAbandonCurrentDoc("creating a new file from template");
    if (!ok) return;

    const suggestedName = `${getSuggestedBaseName() || "NewTune"}.abc`;
    const suggestedDir = getDefaultSaveDir();
    const filePath = await showSaveDialog(suggestedName, suggestedDir);
    if (!filePath) return;

    const content = ensureXNumberInAbc(NEW_FILE_TEMPLATE_ABC, 1);
    const created = await createNewFileAtPath(filePath, content, { confirmOverwrite: false });
    if (created) showToast("New file from template created.", 2200);
  }

  return {
    createNewFileAtPath,
    fileNew,
    fileNewFromTemplate,
  };
}
