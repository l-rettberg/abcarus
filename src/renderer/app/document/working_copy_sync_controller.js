export function resolveTuneEntryFromSnapshot(snapshot, { tuneUid, tuneIndex, startOffset } = {}) {
  if (!snapshot || !Array.isArray(snapshot.tunes)) return null;
  const tunes = snapshot.tunes;
  let idx = -1;
  if (tuneUid) {
    idx = tunes.findIndex((t) => t && t.tuneUid && t.tuneUid === tuneUid);
    if (idx < 0) return null;
  }
  if (!tuneUid && idx < 0 && Number.isFinite(Number(tuneIndex))) {
    const candidate = Number(tuneIndex);
    if (candidate >= 0 && candidate < tunes.length) idx = candidate;
  }
  if (!tuneUid && idx < 0 && Number.isFinite(Number(startOffset))) {
    const target = Number(startOffset);
    if (Number.isFinite(target)) {
      idx = tunes.findIndex((t) => Number.isFinite(Number(t && t.start)) && Number(t.start) === target);
    }
  }
  if (idx < 0 || idx >= tunes.length) return null;
  const tune = tunes[idx];
  if (!tune) return null;
  const start = Number(tune.start);
  const end = Number(tune.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null;
  return {
    tuneUid: tune.tuneUid || "",
    tuneIndex: idx,
    start,
    end,
  };
}

function parseTuneIdentity(text) {
  const source = String(text || "");
  const xMatch = source.match(/^\s*X:\s*([^\r\n]*)/);
  const titleMatch = source.match(/^T:\s*(.*)$/m);
  return {
    xNumber: xMatch ? String(xMatch[1] || "").trim() : "",
    title: titleMatch ? String(titleMatch[1] || "").trim() : "",
  };
}

export function createWorkingCopySyncController({
  api = null,
  state = {},
  actions = {},
  debounceMs = {},
} = {}) {
  const {
    getActiveFilePath = () => "",
    getActiveTuneIndex = () => null,
    getActiveTuneMeta = () => null,
    getActiveTuneUid = () => "",
    getChordProFullText = () => "",
    getCurrentDocumentPath = () => "",
    getRawMode = () => false,
    getWorkingCopySnapshot = () => null,
    isChordProEnabled = () => false,
    isChordProFullView = () => false,
    isPayloadMode = () => false,
  } = state;

  const {
    ensureXNumberInAbc = (text) => String(text || ""),
    getEditorValue = () => "",
    markCurrentDocumentClean = () => false,
    patchCurrentDocument = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    refreshWorkingCopySnapshot = async () => null,
    setActiveTuneIndex = () => {},
    setActiveTuneMetaOffsets = () => {},
    setActiveTuneUid = () => {},
    setDirtyIndicator = () => {},
    setEditorValueClean = () => {},
    setFileContentInCache = () => {},
  } = actions;

  const tuneDebounceMs = Number.isFinite(Number(debounceMs.tune)) ? Number(debounceMs.tune) : 450;
  const fullDebounceMs = Number.isFinite(Number(debounceMs.full)) ? Number(debounceMs.full) : 450;

  let tuneSyncTimer = null;
  let tuneSyncInFlight = false;
  let tuneSyncQueued = false;
  let tuneSyncEpoch = 0;
  let tuneSyncRunPromise = null;

  let fullSyncTimer = null;
  let fullSyncInFlight = false;
  let fullSyncQueued = false;
  let fullSyncEpoch = 0;

  function scheduleTuneSync() {
    const activeTuneMeta = getActiveTuneMeta();
    if (getRawMode()) return;
    if (isPayloadMode()) return;
    if (isChordProEnabled()) return;
    if (!activeTuneMeta || !activeTuneMeta.path) return;
    if (!getActiveTuneUid() && !tryResolveActiveTuneUidFromSnapshot()) return;
    if (!api || typeof api.applyWorkingCopyTuneText !== "function") return;
    if (tuneSyncTimer) clearTimeout(tuneSyncTimer);
    tuneSyncTimer = setTimeout(() => {
      tuneSyncTimer = null;
      flushTuneSync().catch(() => {});
    }, tuneDebounceMs);
  }

  function scheduleFullSync() {
    if (getRawMode()) return;
    if (isPayloadMode()) return;
    if (!isChordProEnabled()) return;
    if (!api || typeof api.applyWorkingCopyFullText !== "function") return;
    const filePath = String(getActiveFilePath() || getCurrentDocumentPath() || "");
    if (!filePath) return;
    if (fullSyncTimer) clearTimeout(fullSyncTimer);
    fullSyncTimer = setTimeout(() => {
      fullSyncTimer = null;
      flushFullSync().catch(() => {});
    }, fullDebounceMs);
  }

  function tryResolveActiveTuneUidFromSnapshot() {
    const activeTuneMeta = getActiveTuneMeta();
    const workingCopySnapshot = getWorkingCopySnapshot();
    if (getRawMode()) return false;
    if (isPayloadMode()) return false;
    if (!activeTuneMeta || !activeTuneMeta.path) return false;
    if (!workingCopySnapshot || !workingCopySnapshot.path || !pathsEqual(workingCopySnapshot.path, activeTuneMeta.path)) return false;

    const activeTuneUid = getActiveTuneUid();
    if (activeTuneUid) {
      const byUid = resolveTuneEntryFromSnapshot(workingCopySnapshot, {
        tuneUid: activeTuneUid,
        tuneIndex: null,
        startOffset: null,
      });
      if (byUid && byUid.tuneUid) {
        if (Number.isFinite(Number(byUid.tuneIndex))) setActiveTuneIndex(Number(byUid.tuneIndex));
        setActiveTuneMetaOffsets(byUid.start, byUid.end);
        return true;
      }
    }

    const expectedX = activeTuneMeta.xNumber != null ? String(activeTuneMeta.xNumber).trim() : "";
    const expectedTitle = activeTuneMeta.title != null ? String(activeTuneMeta.title).trim() : "";
    if (!expectedX && !expectedTitle) return false;

    const candidates = workingCopySnapshot.tunes.map((tune, index) => {
      const start = Number(tune && tune.start);
      const end = Number(tune && tune.end);
      if (!tune || !tune.tuneUid || !Number.isFinite(start) || !Number.isFinite(end)) return null;
      const identity = parseTuneIdentity(String(workingCopySnapshot.text || "").slice(start, end));
      const identityMatches = (!expectedX || identity.xNumber === expectedX)
        && (!expectedTitle || identity.title === expectedTitle);
      if (!identityMatches) return null;
      return {
        tuneUid: tune.tuneUid,
        tuneIndex: index,
        start,
        end,
      };
    }).filter(Boolean);

    const expectedStart = Number(activeTuneMeta.startOffset);
    let resolved = Number.isFinite(expectedStart)
      ? candidates.find((candidate) => candidate.start === expectedStart) || null
      : null;
    if (!resolved && candidates.length === 1) resolved = candidates[0];
    if (!resolved || !resolved.tuneUid) return false;
    setActiveTuneUid(resolved.tuneUid);
    if (Number.isFinite(Number(resolved.tuneIndex))) setActiveTuneIndex(Number(resolved.tuneIndex));
    setActiveTuneMetaOffsets(Number(resolved.start), Number(resolved.end));
    return true;
  }

  async function flushTuneSync() {
    if (tuneSyncTimer) {
      clearTimeout(tuneSyncTimer);
      tuneSyncTimer = null;
    }
    const epoch = tuneSyncEpoch;
    if (tuneSyncInFlight) {
      tuneSyncQueued = true;
      if (tuneSyncRunPromise) {
        return tuneSyncRunPromise;
      }
      return { ok: false, error: "Tune sync is already running." };
    }
    if (getRawMode()) return { ok: false, skipped: true, reason: "raw_mode" };
    if (isPayloadMode()) return { ok: false, skipped: true, reason: "payload_mode" };
    if (isChordProEnabled()) return { ok: false, skipped: true, reason: "chordpro_mode" };
    if (!getActiveTuneUid() && !tryResolveActiveTuneUidFromSnapshot()) {
      return { ok: false, error: "Stable active tune identity is missing. Re-open the tune and try again." };
    }
    const activeTuneMeta = getActiveTuneMeta();
    if (!activeTuneMeta || !activeTuneMeta.path) return { ok: false, error: "Active tune path is missing." };
    if (!api || typeof api.applyWorkingCopyTuneText !== "function") {
      return { ok: false, error: "Working copy tune sync is unavailable." };
    }

    const filePath = String(activeTuneMeta.path || "");
    if (!filePath) return { ok: false, error: "Active tune path is missing." };
    const workingCopySnapshot = getWorkingCopySnapshot();
    if (!workingCopySnapshot || !workingCopySnapshot.path || !pathsEqual(workingCopySnapshot.path, filePath)) {
      return { ok: false, error: "Working copy snapshot does not match the active tune file." };
    }

    const tuneTextRaw = getEditorValue();
    const targetX = (activeTuneMeta && activeTuneMeta.xNumber != null)
      ? String(activeTuneMeta.xNumber || "").trim()
      : "";
    const tuneText = targetX
      ? ensureXNumberInAbc(tuneTextRaw, targetX)
      : ensureXNumberInAbc(tuneTextRaw, "");
    tuneSyncInFlight = true;
    const runPromise = (async () => {
      let result = { ok: false, error: "Working copy tune sync did not complete." };
      try {
        const res = await api.applyWorkingCopyTuneText({
          tuneUid: getActiveTuneUid(),
          tuneIndex: getActiveTuneIndex(),
          expectedPath: filePath,
          expectedVersion: workingCopySnapshot.version,
          text: tuneText,
          expected: {
            xNumber: targetX,
            title: activeTuneMeta && activeTuneMeta.title ? String(activeTuneMeta.title) : "",
            startOffset: activeTuneMeta && Number.isFinite(Number(activeTuneMeta.startOffset))
              ? Number(activeTuneMeta.startOffset)
              : null,
          },
        });
        if (epoch !== tuneSyncEpoch) {
          result = { ok: false, stale: true, error: "Working copy tune sync was superseded." };
          return result;
        }
        if (!res || !res.ok) {
          result = { ok: false, error: (res && res.error) ? String(res.error) : "Unable to apply tune text to working copy." };
          return result;
        }

        const snapshot = await refreshWorkingCopySnapshot();
        if (epoch !== tuneSyncEpoch) {
          result = { ok: false, stale: true, error: "Working copy tune sync was superseded." };
          return result;
        }
        if (snapshot && snapshot.path && pathsEqual(snapshot.path, filePath)) {
          setFileContentInCache(filePath, snapshot.text);
          const tuneEntry = resolveTuneEntryFromSnapshot(snapshot, {
            tuneUid: getActiveTuneUid(),
            tuneIndex: getActiveTuneIndex(),
            startOffset: activeTuneMeta && activeTuneMeta.startOffset,
          });
          if (tuneEntry && Number.isFinite(Number(tuneEntry.tuneIndex))) {
            setActiveTuneIndex(tuneEntry.tuneIndex);
          }
          if (tuneEntry) {
            setActiveTuneMetaOffsets(tuneEntry.start, tuneEntry.end);
          }
          result = { ok: true, path: filePath };
        } else {
          result = { ok: false, error: "Working copy snapshot was not refreshed after tune sync." };
        }
      } finally {
        tuneSyncInFlight = false;
        if (epoch === tuneSyncEpoch && tuneSyncQueued) {
          tuneSyncQueued = false;
          result = await flushTuneSync();
        }
      }
      return result;
    })();
    tuneSyncRunPromise = runPromise;
    try {
      return await runPromise;
    } finally {
      if (tuneSyncRunPromise === runPromise) {
        tuneSyncRunPromise = null;
      }
    }
  }

  function resetTuneSyncDebounce() {
    tuneSyncEpoch += 1;
    if (tuneSyncTimer) clearTimeout(tuneSyncTimer);
    tuneSyncTimer = null;
    tuneSyncQueued = false;
  }

  async function flushFullSync() {
    const epoch = fullSyncEpoch;
    if (fullSyncInFlight) {
      fullSyncQueued = true;
      return { ok: false, error: "Full working-copy sync is already running." };
    }
    if (getRawMode()) return { ok: false, error: "Cannot synchronize ChordPro content in raw mode." };
    if (isPayloadMode()) return { ok: false, error: "Cannot synchronize ChordPro content in payload mode." };
    if (!isChordProEnabled()) return { ok: false, error: "ChordPro synchronization is not enabled." };
    if (!api || typeof api.applyWorkingCopyFullText !== "function") {
      return { ok: false, error: "Working copy full-file sync is unavailable." };
    }

    const filePath = String(getActiveFilePath() || getCurrentDocumentPath() || "");
    if (!filePath) return { ok: false, error: "Active ChordPro file path is missing." };
    const workingCopySnapshot = getWorkingCopySnapshot();
    if (!workingCopySnapshot || !workingCopySnapshot.path || !pathsEqual(workingCopySnapshot.path, filePath)) {
      return { ok: false, error: "Working copy snapshot does not match the active ChordPro file." };
    }

    fullSyncInFlight = true;
    let result = { ok: false, error: "Working copy full-file sync did not complete." };
    try {
      const nextText = isChordProFullView() ? getEditorValue() : getChordProFullText();
      const res = await api.applyWorkingCopyFullText(String(nextText || ""), {
        expectedPath: filePath,
        expectedVersion: workingCopySnapshot.version,
      });
      if (epoch !== fullSyncEpoch) {
        result = { ok: false, error: "Working copy full-file sync was superseded." };
        return result;
      }
      if (!res || !res.ok) {
        result = { ok: false, error: (res && res.error) ? String(res.error) : "Unable to apply full ChordPro text to working copy." };
        return result;
      }
      const snapshot = await refreshWorkingCopySnapshot();
      if (epoch !== fullSyncEpoch) {
        result = { ok: false, error: "Working copy full-file sync was superseded." };
        return result;
      }
      if (snapshot && snapshot.path && pathsEqual(snapshot.path, filePath)) {
        setFileContentInCache(filePath, snapshot.text);
        result = { ok: true, path: filePath };
      } else {
        result = { ok: false, error: "Working copy snapshot was not refreshed after full sync." };
      }
    } finally {
      fullSyncInFlight = false;
      if (epoch === fullSyncEpoch && fullSyncQueued) {
        fullSyncQueued = false;
        result = await flushFullSync();
      }
    }
    return result;
  }

  function resetAllSyncDebounce() {
    tuneSyncEpoch += 1;
    if (tuneSyncTimer) clearTimeout(tuneSyncTimer);
    tuneSyncTimer = null;
    tuneSyncQueued = false;
    fullSyncEpoch += 1;
    if (fullSyncTimer) clearTimeout(fullSyncTimer);
    fullSyncTimer = null;
    fullSyncQueued = false;
  }

  async function discardChangesForActiveFile() {
    resetAllSyncDebounce();

    const activeTuneMeta = getActiveTuneMeta();
    if (getRawMode()) return false;
    if (isChordProEnabled()) return false;
    if (!activeTuneMeta || !activeTuneMeta.path) return false;
    if (!api || typeof api.reloadWorkingCopyFromDisk !== "function") return false;

    try {
      const before = getWorkingCopySnapshot();
      if (!before || !before.path || !pathsEqual(before.path, activeTuneMeta.path)) return false;
      const res = await api.reloadWorkingCopyFromDisk({
        force: true,
        expectedPath: activeTuneMeta.path,
        expectedVersion: before.version,
      });
      if (!res || !res.ok) return false;
      const snapshot = await refreshWorkingCopySnapshot();
      if (snapshot && snapshot.path && pathsEqual(snapshot.path, activeTuneMeta.path)) {
        setFileContentInCache(snapshot.path, snapshot.text);
      }
      if (markCurrentDocumentClean()) setDirtyIndicator(false);
      return true;
    } catch {
      return false;
    }
  }

  function reloadActiveTuneTextFromSnapshot() {
    const workingCopySnapshot = getWorkingCopySnapshot();
    const activeTuneMeta = getActiveTuneMeta();
    if (getRawMode()) return false;
    if (!workingCopySnapshot || !workingCopySnapshot.path || !workingCopySnapshot.text) return false;
    if (!activeTuneMeta || !activeTuneMeta.path) return false;
    if (!pathsEqual(workingCopySnapshot.path, activeTuneMeta.path)) return false;

    const tuneIndex = Number.isFinite(Number(getActiveTuneIndex())) ? Number(getActiveTuneIndex()) : null;
    if (tuneIndex == null) return false;
    const t = Array.isArray(workingCopySnapshot.tunes) ? workingCopySnapshot.tunes[tuneIndex] : null;
    if (!t || !Number.isFinite(Number(t.start)) || !Number.isFinite(Number(t.end))) return false;

    const from = Number(t.start);
    const to = Number(t.end);
    const text = String(workingCopySnapshot.text).slice(from, to);
    setEditorValueClean(text);
    patchCurrentDocument({ content: text, dirty: false }, { create: false });
    setActiveTuneMetaOffsets(from, to);
    setDirtyIndicator(false);
    return true;
  }

  return {
    discardChangesForActiveFile,
    flushFullSync,
    flushTuneSync,
    reloadActiveTuneTextFromSnapshot,
    resetTuneSyncDebounce,
    resolveTuneEntryFromSnapshot,
    scheduleFullSync,
    scheduleTuneSync,
    tryResolveActiveTuneUidFromSnapshot,
  };
}
