export function createTuneClipboardController({
  state = {},
  actions = {},
} = {}) {
  const {
    getLibraryIndex = () => null,
    getWorkingCopySnapshot = () => null,
  } = state;

  const {
    getFileContentFromCache = () => null,
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    readFile = async () => ({ ok: false }),
    resolveTuneEntryFromSnapshot = () => null,
    setBufferStatus = () => {},
    setFileContentInCache = () => {},
    setStatus = () => {},
    showSaveError = async () => {},
  } = actions;

  let clipboardTune = null;

  function getClipboardTune() {
    return clipboardTune;
  }

  function setClipboardTune(next) {
    clipboardTune = next && typeof next === "object" ? { ...next } : null;
    return clipboardTune;
  }

  function clearClipboardTune() {
    clipboardTune = null;
    setBufferStatus("");
  }

  function findTuneById(tuneId) {
    const libraryIndex = getLibraryIndex();
    if (!libraryIndex || !tuneId) return null;
    for (const file of libraryIndex.files || []) {
      const tune = (file.tunes || []).find((t) => t.id === tuneId);
      if (tune) return { tune, file };
    }
    return null;
  }

  async function getTuneText(tune, fileMeta) {
    const workingCopySnapshot = getWorkingCopySnapshot();
    if (
      fileMeta
      && fileMeta.path
      && workingCopySnapshot
      && workingCopySnapshot.path
      && pathsEqual(workingCopySnapshot.path, fileMeta.path)
    ) {
      const entry = resolveTuneEntryFromSnapshot(workingCopySnapshot, {
        tuneUid: tune && tune.tuneUid,
        tuneIndex: tune && tune.tuneIndex,
        startOffset: tune && tune.startOffset,
      });
      if (entry && Number.isFinite(Number(entry.start)) && Number.isFinite(Number(entry.end))) {
        const text = String(workingCopySnapshot.text || "");
        setFileContentInCache(fileMeta.path, text);
        return text.slice(entry.start, entry.end);
      }
    }
    let content = getFileContentFromCache(fileMeta.path);
    if (content == null) {
      const res = await readFile(fileMeta.path);
      if (!res.ok) throw new Error(res.error || "Unable to read file.");
      content = res.data;
      setFileContentInCache(fileMeta.path, content);
    }
    return content.slice(tune.startOffset, tune.endOffset);
  }

  async function copyTuneById(tuneId, mode) {
    const res = findTuneById(tuneId);
    if (!res) return;
    try {
      const text = await getTuneText(res.tune, res.file);
      setClipboardTune({
        text,
        sourcePath: res.file.path,
        tuneId,
        tuneUid: res.tune ? res.tune.tuneUid || null : null,
        tuneIndex: Number.isFinite(Number(res.tune && res.tune.tuneIndex)) ? Number(res.tune.tuneIndex) : null,
        startOffset: Number.isFinite(Number(res.tune && res.tune.startOffset)) ? Number(res.tune.startOffset) : null,
        mode,
      });
      setStatus(mode === "move" ? "Tune cut to buffer." : "Tune copied to buffer.");
      setBufferStatus(mode === "move" ? "Buffer: cut tune" : "Buffer: copied tune");
    } catch (e) {
      await showSaveError(e && e.message ? e.message : String(e));
    }
  }

  return {
    clearClipboardTune,
    copyTuneById,
    findTuneById,
    getClipboardTune,
    getTuneText,
    setClipboardTune,
  };
}
