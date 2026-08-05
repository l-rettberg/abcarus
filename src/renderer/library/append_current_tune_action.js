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
  } = state;

  const {
    confirmAppendToFile = async () => "",
    ensureSafeToAbandonCurrentDoc = async () => false,
    ensureXNumberInAbc = (text) => text,
    getActiveFileEntry = () => null,
    getNextXNumber = () => 1,
    markHeaderClean = () => {},
    markDiskConflictPath = () => {},
    parseTuneIdentityFields = () => null,
    patchCurrentDocument = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    refreshLibraryFile = async () => null,
    readFile = async () => ({ ok: false }),
    selectTune = async () => {},
    setActiveFilePath = () => {},
    setIsNewTuneDraft = () => {},
    setStatus = () => {},
    setDirtyIndicator = () => {},
    showSaveError = async () => {},
    showToast = () => {},
    updateHeaderStateUI = () => {},
    withFileLock = async (_path, fn) => fn(),
    writeFile = async () => ({ ok: false }),
  } = actions;

  async function appendTextToFileNow(filePath, tuneText, { toastOk = "" } = {}) {
    const p = String(filePath || "");
    if (!p) return false;
    const raw = String(tuneText || "");
    if (!raw.trim()) return false;
    return withFileLock(p, async () => {
      const readRes = await readFile(p);
      if (!readRes || !readRes.ok) {
        await showSaveError((readRes && readRes.error) ? readRes.error : "Unable to read append target.");
        return false;
      }
      const before = String(readRes.data || "");
      const nextX = getNextXNumber(before);
      const prepared = ensureXNumberInAbc(raw, nextX);
      const newline = before.includes("\r\n") ? "\r\n" : "\n";
      const tune = prepared.replace(/\s+$/, "");
      const separator = !before.trim() ? "" : (before.endsWith("\n\n") ? "" : (before.endsWith("\n") ? newline : `${newline}${newline}`));
      const updated = `${before}${separator}${tune}${newline}`;
      const saveRes = await writeFile(p, updated, { expectedData: before });
      if (!saveRes || !saveRes.ok) {
        if (saveRes && saveRes.conflict) markDiskConflictPath(p, true);
        await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to save file.");
        return false;
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
    const filePath = String(getActiveFilePath() || getCurrentNavFilePath() || getCurrentDocumentPath() || "");
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
