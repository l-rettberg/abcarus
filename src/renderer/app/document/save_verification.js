function createWorkingCopySaveVerifier({
  state = {},
  actions = {},
  utils = {},
} = {}) {
  const {
    getActiveTuneIndex = () => null,
    getActiveTuneMeta = () => null,
    getActiveTuneUid = () => "",
    getEditorValue = () => "",
    getWorkingCopySnapshot = () => null,
  } = state;

  const {
    ensureXNumberInAbc = (text) => String(text || ""),
    readFile = async () => ({ ok: false }),
    refreshWorkingCopySnapshot = async () => null,
    resolveTuneEntryFromSnapshot = () => null,
  } = actions;

  const {
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
  } = utils;

  async function verifyWorkingCopySaveReachedDisk(filePath) {
    const p = String(filePath || "");
    if (!p) return { ok: false, error: "Missing file path for save verification." };

    const snapshot = await refreshWorkingCopySnapshot();
    if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, p)) {
      return { ok: false, error: "Unable to verify save: working copy snapshot is unavailable." };
    }

    const readRes = await readFile(p);
    if (!readRes || !readRes.ok) {
      return { ok: false, error: (readRes && readRes.error) ? readRes.error : "Unable to verify save: cannot read file from disk." };
    }
    if (String(readRes.data || "") !== String(snapshot.text || "")) {
      return { ok: false, error: "Save verification failed: disk file does not match the committed working copy." };
    }

    const activeTuneMeta = getActiveTuneMeta();
    if (activeTuneMeta && activeTuneMeta.path && pathsEqual(activeTuneMeta.path, p)) {
      const tuneEntry = resolveTuneEntryFromSnapshot(snapshot, {
        tuneUid: getActiveTuneUid(),
        tuneIndex: getActiveTuneIndex(),
        startOffset: activeTuneMeta.startOffset,
      });
      if (!tuneEntry) {
        return { ok: false, error: "Save verification failed: active tune was not found in the committed file." };
      }
      const targetX = activeTuneMeta && activeTuneMeta.xNumber != null
        ? String(activeTuneMeta.xNumber || "").trim()
        : "";
      const expectedTuneText = targetX
        ? ensureXNumberInAbc(getEditorValue(), targetX)
        : ensureXNumberInAbc(getEditorValue(), "");
      const actualTuneText = String(snapshot.text || "").slice(tuneEntry.start, tuneEntry.end);
      if (actualTuneText !== expectedTuneText) {
        return { ok: false, error: "Save verification failed: the active editor text is not in the committed file." };
      }
    }

    return { ok: true, snapshot: getWorkingCopySnapshot() || snapshot };
  }

  return {
    verifyWorkingCopySaveReachedDisk,
  };
}

export {
  createWorkingCopySaveVerifier,
};
