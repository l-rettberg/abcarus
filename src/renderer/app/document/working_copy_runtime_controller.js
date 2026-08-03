export function createWorkingCopyRuntimeController({ api = null, actions = {}, utils = {} } = {}) {
  const { recordRecentAction = () => {}, renderUnifiedStatus = () => {}, markStatusDirty = () => {}, logErr = () => {} } = actions;
  const { normalizeLibraryPath = (p) => String(p || "") } = utils;
  let snapshot = null;
  const diskConflictPaths = new Set();

  async function refreshSnapshot() {
    if (!api || typeof api.getWorkingCopySnapshot !== "function") return null;
    try {
      const res = await api.getWorkingCopySnapshot();
      snapshot = res && res.ok && res.snapshot ? res.snapshot : null;
      recordRecentAction("wc.snapshot", { path: snapshot && snapshot.path ? String(snapshot.path) : null, dirty: Boolean(snapshot && snapshot.dirty) });
      renderUnifiedStatus();
      return snapshot;
    } catch (err) {
      snapshot = null;
      logErr(err);
      renderUnifiedStatus();
      return null;
    }
  }

  function markDiskConflictPath(filePath, hasConflict) {
    const path = normalizeLibraryPath(filePath);
    if (!path) return;
    if (hasConflict) diskConflictPaths.add(path);
    else diskConflictPaths.delete(path);
    renderUnifiedStatus();
    markStatusDirty();
  }

  return {
    getSnapshot: () => snapshot,
    hasDiskConflictPath: (filePath) => diskConflictPaths.has(normalizeLibraryPath(filePath)),
    markDiskConflictPath,
    refreshSnapshot,
  };
}
