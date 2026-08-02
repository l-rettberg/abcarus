export function createDuplicateTuneAction({
  actions = {},
} = {}) {
  const {
    ensureCopyTitleInAbc = (text) => text,
    findTuneById = () => null,
    markActiveTuneButton = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    readFile = async () => ({ ok: false }),
    refreshLibraryFile = async () => null,
    renumberXInTextKeepingFirst = () => ({ ok: false }),
    requireCleanForFileOp = async () => false,
    selectTune = async () => {},
    setActiveFilePath = () => {},
    setActiveTuneId = () => {},
    setActiveTuneText = () => {},
    setFileContentInCache = () => {},
    setStatus = () => {},
    showSaveError = async () => {},
    withFileLock = async (_path, fn) => fn(),
    writeFile = async () => ({ ok: false }),
  } = actions;

  async function duplicateTuneById(tuneId) {
    const res = findTuneById(tuneId);
    if (!res) return;
    if (!(await requireCleanForFileOp(res.file.path, "duplicating a tune"))) return;
    try {
      const updated = await withFileLock(res.file.path, async () => {
        const readRes = await readFile(res.file.path);
        if (!readRes || !readRes.ok) throw new Error(readRes && readRes.error ? readRes.error : "Unable to read file.");
        const content = String(readRes.data || "");
        const verifyRes = await readFile(res.file.path);
        if (!verifyRes || !verifyRes.ok) throw new Error(verifyRes && verifyRes.error ? verifyRes.error : "Unable to verify file.");
        if (String(verifyRes.data || "") !== content) {
          throw new Error("Refusing to duplicate: file changed on disk. Refresh/reopen the file and try again.");
        }
        const startOffset = Number(res.tune.startOffset);
        const endOffset = Number(res.tune.endOffset);
        if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || startOffset < 0 || endOffset <= startOffset || endOffset > content.length) {
          throw new Error("Refusing to duplicate: tune offsets look stale. Refresh the library and try again.");
        }
        const slice = content.slice(startOffset, endOffset);
        const trimmed = slice.replace(/^\s+/, "");
        if (!/^\s*X:/.test(trimmed)) {
          throw new Error("Refusing to duplicate: tune offsets look stale. Refresh the library and try again.");
        }
        const expectedX = res.tune && res.tune.xNumber != null ? String(res.tune.xNumber).trim() : "";
        const sliceXMatch = trimmed.match(/^X:\s*([^\r\n]*)/);
        const sliceX = sliceXMatch ? String(sliceXMatch[1] || "").trim() : "";
        if (expectedX && sliceX !== expectedX) {
          throw new Error(`Refusing to duplicate: expected X:${expectedX}, found X:${sliceX || "?"}.`);
        }

        const newline = content.includes("\r\n") ? "\r\n" : "\n";
        let before = content.slice(0, endOffset);
        let after = content.slice(endOffset);
        let prepared = ensureCopyTitleInAbc(slice);
        if (prepared && !/\r?\n$/.test(prepared)) prepared += newline;
        if (before && !/\r?\n$/.test(before)) before += newline;
        if (/^\r?\n/.test(prepared) && /\r?\n$/.test(before)) prepared = prepared.replace(/^\r?\n/, "");
        if (/^\r?\n/.test(after) && /\r?\n$/.test(prepared)) after = after.replace(/^\r?\n/, "");

        const inserted = `${before}${prepared}${after}`;
        const renum = renumberXInTextKeepingFirst(inserted);
        if (!renum || !renum.ok || typeof renum.abcText !== "string") {
          throw new Error("Unable to renumber file after duplicating a tune.");
        }
        const updatedContent = renum.abcText;
        const writeRes = await writeFile(res.file.path, updatedContent, { expectedData: content });
        if (!writeRes || !writeRes.ok) throw new Error(writeRes && writeRes.error ? writeRes.error : "Unable to duplicate tune.");
        setFileContentInCache(res.file.path, updatedContent);
        const updatedFile = await refreshLibraryFile(res.file.path, { force: true });
        return { updatedContent, updatedFile };
      });
      const updatedContent = updated ? updated.updatedContent : null;
      const updatedFile = updated ? updated.updatedFile : null;
      setActiveFilePath(res.file.path);
      if (updatedFile && updatedFile.tunes && updatedFile.tunes.length) {
        const fallbackOriginalIdx = Number.isFinite(Number(res.tune.indexInFile)) ? Number(res.tune.indexInFile) - 1 : null;
        const originalIdx = fallbackOriginalIdx != null
          ? fallbackOriginalIdx
          : (Array.isArray(res.file.tunes) ? res.file.tunes.findIndex((t) => t && t.id === res.tune.id) : -1);
        const duplicateIdx = originalIdx >= 0 ? originalIdx + 1 : -1;
        const tune = (duplicateIdx >= 0 && duplicateIdx < updatedFile.tunes.length)
          ? updatedFile.tunes[duplicateIdx]
          : updatedFile.tunes[updatedFile.tunes.length - 1];
        setActiveTuneId(tune.id);
        markActiveTuneButton(tune.id);
        const tuneText = updatedContent ? updatedContent.slice(tune.startOffset, tune.endOffset) : "";
        setActiveTuneText(tuneText, {
          id: tune.id,
          path: updatedFile.path,
          basename: updatedFile.basename,
          xNumber: tune.xNumber,
          title: tune.title || "",
          composer: tune.composer || "",
          key: tune.key || "",
          startLine: tune.startLine,
          endLine: tune.endLine,
          startOffset: tune.startOffset,
          endOffset: tune.endOffset,
        });
      }
      setStatus("OK");
    } catch (e) {
      await showSaveError(e && e.message ? e.message : String(e));
    }
  }

  return {
    duplicateTuneById,
  };
}
