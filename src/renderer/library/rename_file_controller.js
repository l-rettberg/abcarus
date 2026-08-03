function createRenameFileController({
  elements = {},
  state = {},
  actions = {},
  io = {},
  utils = {},
} = {}) {
  const {
    libraryTree = null,
  } = elements;

  const {
    getActiveEditFilePath = () => "",
    hasGlobalUnsavedChanges = () => false,
    hasUnsavedChangesForFile = () => false,
  } = state;

  const {
    renderLibraryTree = () => {},
    renameLibraryFile = async () => {},
    showSaveError = async () => {},
    showToast = () => {},
    withFileLocks = async (_paths, operation) => operation(),
  } = actions;

  const {
    fileExists = async () => false,
    renameFile = async () => ({ ok: false, error: "Unable to rename file." }),
  } = io;

  const {
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    safeDirname = () => "",
  } = utils;

  let renamingFilePath = null;
  let renameInFlight = false;

  function getRenamingFilePath() {
    return renamingFilePath;
  }

  function setRenamingFilePath(filePath) {
    renamingFilePath = filePath || null;
  }

  function buildRenameTargetPath(oldPath, inputName) {
    const trimmed = String(inputName || "").trim();
    if (!trimmed) return "";
    if (/[\\/]/.test(trimmed)) return "";
    let name = trimmed;
    if (!/\.[^.]+$/.test(name)) name += ".abc";
    const dir = safeDirname(oldPath);
    if (!dir) return "";
    return `${dir}/${name}`;
  }

  function beginRenameFile(filePath) {
    if (!filePath) return;
    const activePath = getActiveEditFilePath();
    if (hasGlobalUnsavedChanges() && activePath && !pathsEqual(activePath, filePath)) {
      showToast("Save/Discard your current changes before renaming files.", 2600);
      return;
    }
    if (hasUnsavedChangesForFile(filePath)) {
      showToast("Save/Discard changes before renaming files.", 2600);
      return;
    }
    renamingFilePath = filePath;
    renderLibraryTree();
    requestAnimationFrame(() => {
      const input = libraryTree
        ? libraryTree.querySelector(`input[data-file-path="${CSS.escape(filePath)}"]`)
        : null;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  async function commitRenameFile(oldPath, inputName) {
    if (renameInFlight) return;
    if (!renamingFilePath || renamingFilePath !== oldPath) return;
    renameInFlight = true;
    try {
      const activePath = getActiveEditFilePath();
      if (hasGlobalUnsavedChanges() && activePath && !pathsEqual(activePath, oldPath)) {
        await showSaveError("Refusing to rename: you have unsaved changes in another file. Save/Discard them and try again.");
        renamingFilePath = null;
        renderLibraryTree();
        return;
      }
      if (hasUnsavedChangesForFile(oldPath)) {
        await showSaveError("Refusing to rename: the file has unsaved changes. Save/Discard them and try again.");
        renamingFilePath = null;
        renderLibraryTree();
        return;
      }
      const newPath = buildRenameTargetPath(oldPath, inputName);
      if (!newPath) {
        renamingFilePath = null;
        renderLibraryTree();
        return;
      }
      if (newPath === oldPath) {
        renamingFilePath = null;
        renderLibraryTree();
        return;
      }
      await withFileLocks([oldPath, newPath], async () => {
        if (await fileExists(newPath)) {
          await showSaveError("A file with that name already exists.");
          renamingFilePath = null;
          renderLibraryTree();
          return;
        }
        const res = await renameFile(oldPath, newPath);
        if (!res || !res.ok) {
          await showSaveError(res && res.error ? res.error : "Unable to rename file.");
          renamingFilePath = null;
          renderLibraryTree();
          return;
        }
        renamingFilePath = null;
        await renameLibraryFile(oldPath, newPath);
      });
    } finally {
      renameInFlight = false;
    }
  }

  return {
    beginRenameFile,
    commitRenameFile,
    getRenamingFilePath,
    setRenamingFilePath,
  };
}

export {
  createRenameFileController,
};
