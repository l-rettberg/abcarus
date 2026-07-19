export function createWorkingCopyRuntimeController({
  api = null,
  state = {},
  actions = {},
  utils = {},
} = {}) {
  const {
    getActiveTuneMeta = () => null,
    isCurrentDocumentDirty = () => false,
  } = state;

  const {
    attachTuneUidsToLibraryFile = () => {},
    logErr = () => {},
    logFilePerf = () => {},
    markStatusDirty = () => {},
    perfNowMs = () => Date.now(),
    recordRecentAction = () => {},
    renderUnifiedStatus = () => {},
    safeBasename = (p) => String(p || "").split("/").pop() || "",
    scheduleRenderLibraryTree = () => {},
    scheduleWorkingCopyTuneSync = () => {},
  } = actions;

  const {
    normalizeLibraryPath = (p) => String(p || ""),
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
  } = utils;

  let snapshot = null;
  let lazyOpenSeq = 0;
  const diskConflictPaths = new Set();

  function getSnapshot() {
    return snapshot;
  }

  function markDiskConflictPath(filePath, hasConflict) {
    const p = filePath ? normalizeLibraryPath(filePath) : "";
    if (!p) return;
    if (hasConflict) diskConflictPaths.add(p);
    else diskConflictPaths.delete(p);
    renderUnifiedStatus();
    markStatusDirty();
  }

  function hasDiskConflictPath(filePath) {
    const p = filePath ? normalizeLibraryPath(filePath) : "";
    if (!p) return false;
    return diskConflictPaths.has(p);
  }

  async function refreshSnapshot() {
    if (!api || typeof api.getWorkingCopySnapshot !== "function") return null;
    try {
      const res = await api.getWorkingCopySnapshot();
      if (!res || !res.ok || !res.snapshot) {
        snapshot = null;
        renderUnifiedStatus();
        recordRecentAction("wc.snapshot.missing", {
          ok: Boolean(res && res.ok),
          error: (res && res.error) ? String(res.error) : null,
        });
        return null;
      }
      snapshot = res.snapshot;
      renderUnifiedStatus();
      recordRecentAction("wc.snapshot", {
        path: snapshot && snapshot.path ? String(snapshot.path) : null,
        version: snapshot && Number.isFinite(Number(snapshot.version)) ? Number(snapshot.version) : null,
        dirty: snapshot ? Boolean(snapshot.dirty) : null,
      });
      return snapshot;
    } catch (err) {
      logErr(err);
      snapshot = null;
      renderUnifiedStatus();
      recordRecentAction("wc.snapshot.error", { error: err && err.message ? String(err.message) : String(err) });
      return null;
    }
  }

  async function ensureOpenForPath(filePath) {
    const p = String(filePath || "");
    if (!p) return false;
    if (!api || typeof api.getWorkingCopyMeta !== "function" || typeof api.openWorkingCopy !== "function") return false;

    try {
      const metaRes = await api.getWorkingCopyMeta();
      const metaPath = (metaRes && metaRes.ok && metaRes.meta && metaRes.meta.path) ? String(metaRes.meta.path) : "";
      recordRecentAction("wc.meta", {
        ok: Boolean(metaRes && metaRes.ok),
        path: metaPath || null,
        dirty: (metaRes && metaRes.ok && metaRes.meta) ? Boolean(metaRes.meta.dirty) : null,
        version: (metaRes && metaRes.ok && metaRes.meta && Number.isFinite(Number(metaRes.meta.version))) ? Number(metaRes.meta.version) : null,
      });
      if (metaPath && pathsEqual(metaPath, p)) return true;
    } catch {}

    try {
      recordRecentAction("wc.open", { path: p, reason: "ensureWorkingCopyOpenForPath" });
      await api.openWorkingCopy(p);
      const metaRes2 = await api.getWorkingCopyMeta();
      const metaPath2 = (metaRes2 && metaRes2.ok && metaRes2.meta && metaRes2.meta.path) ? String(metaRes2.meta.path) : "";
      if (metaPath2 && pathsEqual(metaPath2, p)) {
        await refreshSnapshot();
        return true;
      }
    } catch {}

    return false;
  }

  function scheduleLazyOpenForActiveFile(filePath, reason = "selectTune") {
    const p = String(filePath || "");
    if (!p) return;
    if (!api || typeof api.openWorkingCopy !== "function") return;
    if (snapshot && snapshot.path && pathsEqual(snapshot.path, p)) return;

    const seq = (lazyOpenSeq += 1);
    const perfOn = Boolean(state.isFilePerfEnabled && state.isFilePerfEnabled());
    const t0 = perfOn ? perfNowMs() : 0;
    recordRecentAction("wc.open.lazy", { path: p, reason });

    api.openWorkingCopy(p).then(async (res) => {
      if (seq !== lazyOpenSeq) return;
      if (res && res.ok === false) {
        if (perfOn) logFilePerf("lazyWorkingCopyOpen: failed", { ms: Math.round(perfNowMs() - t0), file: safeBasename(p), error: res.error || "" });
        return;
      }
      const nextSnapshot = await refreshSnapshot();
      if (seq !== lazyOpenSeq) return;
      if (!nextSnapshot || !nextSnapshot.path || !pathsEqual(nextSnapshot.path, p)) return;
      attachTuneUidsToLibraryFile(p, nextSnapshot);
      scheduleRenderLibraryTree();
      if (perfOn) logFilePerf("lazyWorkingCopyOpen: done", { ms: Math.round(perfNowMs() - t0), file: safeBasename(p) });

      const activeTuneMeta = getActiveTuneMeta();
      if (
        activeTuneMeta
        && activeTuneMeta.path
        && pathsEqual(activeTuneMeta.path, p)
        && isCurrentDocumentDirty()
      ) {
        scheduleWorkingCopyTuneSync();
      }
    }).catch((err) => {
      if (perfOn) logFilePerf("lazyWorkingCopyOpen: error", {
        ms: Math.round(perfNowMs() - t0),
        file: safeBasename(p),
        error: err && err.message ? String(err.message) : String(err),
      });
    });
  }

  return {
    ensureOpenForPath,
    getSnapshot,
    hasDiskConflictPath,
    markDiskConflictPath,
    refreshSnapshot,
    scheduleLazyOpenForActiveFile,
  };
}
