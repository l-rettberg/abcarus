function createFileOperationGuard({
  state = {},
  actions = {},
  utils = {},
} = {}) {
  const {
    getActiveEditFilePath = () => "",
    hasGlobalUnsavedChanges = () => false,
  } = state;

  const {
    showSaveError = async () => {},
  } = actions;

  const {
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
  } = utils;

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
    requireCleanForFileOp,
  };
}

export {
  createFileOperationGuard,
};
