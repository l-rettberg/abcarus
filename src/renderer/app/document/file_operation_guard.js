function createFileOperationGuard({
  state = {},
  actions = {},
  utils = {},
} = {}) {
  const {
    getActiveEditFilePath = () => "",
    getWorkingCopySnapshot = () => null,
    hasGlobalUnsavedChanges = () => false,
  } = state;

  const {
    showSaveError = async () => {},
  } = actions;

  const {
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
  } = utils;

  function isWorkingCopyOpenForFile(filePath) {
    const p = String(filePath || "");
    if (!p) return false;
    const workingCopySnapshot = getWorkingCopySnapshot();
    return Boolean(workingCopySnapshot && workingCopySnapshot.path && pathsEqual(workingCopySnapshot.path, p));
  }

  async function requireCleanForFileOp(targetPath, actionLabel) {
    const p = String(targetPath || "");
    const label = String(actionLabel || "this action");
    const activePath = getActiveEditFilePath();
    if (!hasGlobalUnsavedChanges()) return true;
    if (activePath && p && !pathsEqual(activePath, p)) {
      await showSaveError(`Please Save/Discard your current changes before ${label}.`);
      return false;
    }
    await showSaveError(`${label} is disabled while the file has unsaved changes. Save/Discard first.`);
    return false;
  }

  return {
    isWorkingCopyOpenForFile,
    requireCleanForFileOp,
  };
}

export {
  createFileOperationGuard,
};
