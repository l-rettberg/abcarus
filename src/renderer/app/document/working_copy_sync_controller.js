export function resolveTuneEntryFromSnapshot(snapshot, { tuneUid, tuneIndex, startOffset } = {}) {
  if (!snapshot || !Array.isArray(snapshot.tunes)) return null;
  const tunes = snapshot.tunes;
  let idx = -1;
  if (tuneUid) idx = tunes.findIndex((t) => t && t.tuneUid && t.tuneUid === tuneUid);
  if (!tuneUid && Number.isFinite(Number(tuneIndex))) {
    const candidate = Number(tuneIndex);
    if (candidate >= 0 && candidate < tunes.length) idx = candidate;
  }
  if (!tuneUid && idx < 0 && Number.isFinite(Number(startOffset))) {
    idx = tunes.findIndex((t) => Number(t && t.start) === Number(startOffset));
  }
  if (idx < 0 || idx >= tunes.length) return null;
  const tune = tunes[idx];
  const start = Number(tune && tune.start);
  const end = Number(tune && tune.end);
  if (!tune || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null;
  return { tuneUid: tune.tuneUid || "", tuneIndex: idx, start, end };
}

export function createWorkingCopySyncController({ api = null, state = {}, actions = {} } = {}) {
  const {
    getActiveTuneIndex = () => null,
    getActiveTuneMeta = () => null,
    getActiveTuneUid = () => "",
    getRawMode = () => false,
    getWorkingCopySnapshot = () => null,
    isChordProEnabled = () => false,
  } = state;
  const {
    markCurrentDocumentClean = () => false,
    patchCurrentDocument = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    refreshWorkingCopySnapshot = async () => null,
    readFile = async () => ({ ok: false }),
    setActiveTuneMetaOffsets = () => {},
    setDirtyIndicator = () => {},
    setEditorValueClean = () => {},
    setFileContentInCache = () => {},
  } = actions;

  async function discardChangesForActiveFile() {
    const activeTuneMeta = getActiveTuneMeta();
    if (getRawMode() || isChordProEnabled() || !activeTuneMeta || !activeTuneMeta.path) return false;
    try {
      const res = await readFile(activeTuneMeta.path);
      if (!res || !res.ok) return false;
      setFileContentInCache(activeTuneMeta.path, String(res.data || ""));
      if (markCurrentDocumentClean()) setDirtyIndicator(false);
      return true;
    } catch {
      return false;
    }
  }

  function reloadActiveTuneTextFromSnapshot() {
    const snapshot = getWorkingCopySnapshot();
    const activeTuneMeta = getActiveTuneMeta();
    if (getRawMode() || !snapshot || !snapshot.path || snapshot.text == null) return false;
    if (!activeTuneMeta || !activeTuneMeta.path || !pathsEqual(snapshot.path, activeTuneMeta.path)) return false;
    const index = Number.isFinite(Number(getActiveTuneIndex())) ? Number(getActiveTuneIndex()) : null;
    const tune = index == null || !Array.isArray(snapshot.tunes) ? null : snapshot.tunes[index];
    if (!tune || !Number.isFinite(Number(tune.start)) || !Number.isFinite(Number(tune.end))) return false;
    const from = Number(tune.start);
    const to = Number(tune.end);
    const text = String(snapshot.text).slice(from, to);
    setEditorValueClean(text);
    patchCurrentDocument({ content: text, dirty: false }, { create: false });
    setActiveTuneMetaOffsets(from, to);
    setDirtyIndicator(false);
    return true;
  }

  return {
    discardChangesForActiveFile,
    reloadActiveTuneTextFromSnapshot,
    resolveTuneEntryFromSnapshot,
  };
}
