import { createAppendCurrentTuneAction } from "./append_current_tune_action.js";
import { createDeleteTuneAction } from "./delete_tune_action.js";
import { createDuplicateTuneAction } from "./duplicate_tune_action.js";
import { createNewFileAction } from "./new_file_action.js";
import { createPasteMoveTuneAction } from "./paste_move_tune_action.js";
import { createRenumberXAction } from "./renumber_x_action.js";
import { createTuneClipboardController } from "./tune_clipboard_controller.js";

function createLibraryCrudDomain({
  api = null,
  SAVE_INTENT = {},
  state = {},
  actions = {},
  constants = {},
} = {}) {
  let tuneClipboardController = null;

  const findTuneById = (tuneId) => tuneClipboardController
    ? tuneClipboardController.findTuneById(tuneId)
    : null;
  const getTuneText = (tune, fileMeta) => tuneClipboardController
    ? tuneClipboardController.getTuneText(tune, fileMeta)
    : "";
  const getClipboardTune = () => tuneClipboardController
    ? tuneClipboardController.getClipboardTune()
    : null;
  const setClipboardTune = (next) => tuneClipboardController
    ? tuneClipboardController.setClipboardTune(next)
    : null;
  const clearClipboardTune = () => {
    if (tuneClipboardController) tuneClipboardController.clearClipboardTune();
  };

  tuneClipboardController = createTuneClipboardController({
    state: {
      getLibraryIndex: state.getLibraryIndex,
      getWorkingCopySnapshot: actions.getWorkingCopySnapshot,
    },
    actions: {
      getFileContentFromCache: actions.getFileContentFromCache,
      pathsEqual: actions.pathsEqual,
      readFile: actions.readFile,
      resolveTuneEntryFromSnapshot: actions.resolveTuneEntryFromSnapshot,
      setBufferStatus: actions.setBufferStatus,
      setFileContentInCache: actions.setFileContentInCache,
      setStatus: actions.setStatus,
      showSaveError: actions.showSaveError,
    },
  });

  const appendCurrentTuneAction = createAppendCurrentTuneAction({
    api,
    SAVE_INTENT,
    state: {
      getActiveFilePath: state.getActiveFilePath,
      getActiveTuneMeta: state.getActiveTuneMeta,
      getActiveTuneUid: state.getActiveTuneUid,
      getCurrentDocumentPath: state.getCurrentDocumentPath,
      getCurrentNavFilePath: state.getCurrentNavFilePath,
      getEditorText: state.getEditorText,
      getSaveSession: state.getSaveSession,
    },
    actions: {
      confirmAppendToFile: actions.confirmAppendToFile,
      ensureSafeToAbandonCurrentDoc: actions.ensureSafeToAbandonCurrentDoc,
      ensureXNumberInAbc: actions.ensureXNumberInAbc,
      getActiveFileEntry: actions.getActiveFileEntry,
      getNextXNumber: actions.getNextXNumber,
      markDiskConflictPath: actions.markDiskConflictPath,
      markHeaderClean: actions.markHeaderClean,
      parseTuneIdentityFields: actions.parseTuneIdentityFields,
      patchCurrentDocument: actions.patchCurrentDocument,
      pathsEqual: actions.pathsEqual,
      refreshLibraryFile: actions.refreshLibraryFile,
      refreshWorkingCopySnapshot: actions.refreshWorkingCopySnapshot,
      resolveWorkingCopySaveConflictDefault: actions.resolveWorkingCopySaveConflictDefault,
      selectTune: actions.selectTune,
      setActiveFilePath: actions.libraryDocumentContext.setActiveFile,
      setFileContentInCache: actions.setFileContentInCache,
      setIsNewTuneDraft: actions.setIsNewTuneDraft,
      setSaveSession: actions.setSaveSession,
      setStatus: actions.setStatus,
      setDirtyIndicator: actions.setDirtyIndicator,
      showSaveError: actions.showSaveError,
      showToast: actions.showToast,
      syncLibraryFileFromWorkingCopySnapshot: actions.syncLibraryFileFromWorkingCopySnapshot,
      updateHeaderStateUI: actions.updateHeaderStateUI,
      withFileLock: actions.withFileLock,
    },
  });

  const newFileAction = createNewFileAction({
    api,
    constants: {
      newFileMinimalAbc: constants.newFileMinimalAbc,
      templateAbc: constants.templateAbc,
    },
    actions: {
      confirmOverwrite: actions.confirmOverwrite,
      ensureSafeToAbandonCurrentDoc: actions.ensureSafeToAbandonCurrentDoc,
      ensureXNumberInAbc: actions.ensureXNumberInAbc,
      fileExists: actions.fileExists,
      getDefaultSaveDir: actions.getDefaultSaveDir,
      getSuggestedBaseName: actions.getSuggestedBaseName,
      loadLibraryFileIntoEditor: actions.loadLibraryFileIntoEditor,
      mkdirp: actions.mkdirp,
      patchCurrentDocument: actions.patchCurrentDocument,
      recordNavFilePath: actions.recordNavFilePath,
      refreshLibraryFile: actions.refreshLibraryFile,
      refreshWorkingCopySnapshot: actions.refreshWorkingCopySnapshot,
      safeBasename: actions.safeBasename,
      safeDirname: actions.safeDirname,
      setActiveFilePath: actions.libraryDocumentContext.setActiveFile,
      setActiveTuneText: actions.libraryDocumentContext.setActiveTuneTextForLibrary,
      setDirtyIndicator: actions.setDirtyIndicator,
      setFileContentInCache: actions.setFileContentInCache,
      setFileNameMeta: actions.setFileNameMeta,
      showSaveDialog: actions.showSaveDialog,
      showSaveError: actions.showSaveError,
      showToast: actions.showToast,
      stripFileExtension: actions.stripFileExtension,
      updateFileHeaderPanel: actions.updateFileHeaderPanel,
      updateWindowTitle: actions.updateWindowTitle,
      withFileLock: actions.withFileLock,
      writeFile: actions.writeFile,
    },
  });

  const deleteTuneAction = createDeleteTuneAction({
    api,
    state: {
      getLibraryIndex: state.getLibraryIndex,
      getActiveFilePath: state.getActiveFilePath,
      getActiveTuneId: state.getActiveTuneId,
      getRawMode: state.getRawMode,
      getHeaderDirty: state.getHeaderDirty,
      getIsNewTuneDraft: state.getIsNewTuneDraft,
      isCurrentDocumentDirty: state.isCurrentDocumentDirty,
    },
    actions: {
      attachTuneUidsToLibraryFile: actions.attachTuneUidsToLibraryFile,
      clearActiveTune: actions.libraryDocumentContext.clearActiveTune,
      confirmDeleteTune: actions.confirmDeleteTune,
      discardWorkingCopyChangesForActiveFile: actions.discardWorkingCopyChangesForActiveFile,
      ensureSafeToAbandonCurrentDoc: actions.ensureSafeToAbandonCurrentDoc,
      findTuneById,
      markCurrentDocumentClean: actions.markCurrentDocumentClean,
      pathsEqual: actions.pathsEqual,
      refreshLibraryFile: actions.refreshLibraryFile,
      refreshWorkingCopySnapshot: actions.refreshWorkingCopySnapshot,
      requireCleanForFileOp: actions.requireCleanForFileOp,
      selectTune: actions.selectTune,
      setActiveFilePath: actions.libraryDocumentContext.setActiveFile,
      setDirtyIndicator: actions.setDirtyIndicator,
      setFileContentInCache: actions.setFileContentInCache,
      showCleanFileDocument: actions.libraryDocumentContext.showCleanFileDocument,
      showSaveError: actions.showSaveError,
      syncLibraryFileFromWorkingCopySnapshot: actions.syncLibraryFileFromWorkingCopySnapshot,
    },
  });

  const duplicateTuneAction = createDuplicateTuneAction({
    api,
    state: {
      isWorkingCopyOpenForFile: state.isWorkingCopyOpenForFile,
    },
    actions: {
      attachTuneUidsToLibraryFile: actions.attachTuneUidsToLibraryFile,
      ensureCopyTitleInAbc: actions.ensureCopyTitleInAbc,
      findTuneById,
      markActiveTuneButton: actions.markActiveTuneButton,
      markDiskConflictPath: actions.markDiskConflictPath,
      pathsEqual: actions.pathsEqual,
      readFile: actions.readFile,
      refreshLibraryFile: actions.refreshLibraryFile,
      refreshWorkingCopySnapshot: actions.refreshWorkingCopySnapshot,
      renumberXInTextKeepingFirst: actions.renumberXInTextKeepingFirst,
      requireCleanForFileOp: actions.requireCleanForFileOp,
      selectTune: actions.selectTune,
      setActiveFilePath: actions.libraryDocumentContext.setActiveFile,
      setActiveTuneId: actions.libraryDocumentContext.setActiveTuneIdOnly,
      setActiveTuneText: actions.libraryDocumentContext.setActiveTuneTextForLibrary,
      setFileContentInCache: actions.setFileContentInCache,
      setStatus: actions.setStatus,
      showSaveError: actions.showSaveError,
      syncLibraryFileFromWorkingCopySnapshot: actions.syncLibraryFileFromWorkingCopySnapshot,
      withFileLock: actions.withFileLock,
      writeFile: actions.writeFile,
    },
  });

  const pasteMoveTuneAction = createPasteMoveTuneAction({
    api,
    state: {
      getActiveFilePath: state.getActiveFilePath,
      getActiveTuneId: state.getActiveTuneId,
      getActiveTuneMeta: state.getActiveTuneMeta,
      getClipboardTune,
      getHeaderDirty: state.getHeaderDirty,
      getIsNewTuneDraft: state.getIsNewTuneDraft,
      getWorkingCopySnapshot: actions.getWorkingCopySnapshot,
      hasGlobalUnsavedChanges: state.hasGlobalUnsavedChanges,
      isCurrentDocumentDirty: state.isCurrentDocumentDirty,
      isWorkingCopyOpenForFile: state.isWorkingCopyOpenForFile,
    },
    actions: {
      clearClipboardTune,
      confirmAppendToFile: actions.confirmAppendToFile,
      ensureXNumberInAbc: actions.ensureXNumberInAbc,
      findTuneById,
      flushWorkingCopyTuneSync: actions.flushWorkingCopyTuneSync,
      getActiveEditFilePath: actions.getActiveEditFilePath,
      getNextXNumber: actions.getNextXNumber,
      getTuneText,
      markDiskConflictPath: actions.markDiskConflictPath,
      pathsEqual: actions.pathsEqual,
      readFile: actions.readFile,
      refreshLibraryFile: actions.refreshLibraryFile,
      refreshWorkingCopySnapshot: actions.refreshWorkingCopySnapshot,
      removeTuneFromContent: actions.removeTuneFromContent,
      renumberXInTextKeepingFirst: actions.renumberXInTextKeepingFirst,
      requireCleanForFileOp: actions.requireCleanForFileOp,
      resolveTuneEntryFromSnapshot: actions.resolveTuneEntryFromSnapshot,
      setActiveFilePath: actions.libraryDocumentContext.setActiveFile,
      setActiveTuneId: actions.libraryDocumentContext.setActiveTuneIdOnly,
      setClipboardTune,
      setFileContentInCache: actions.setFileContentInCache,
      setStatus: actions.setStatus,
      selectTune: actions.selectTune,
      showSaveError: actions.showSaveError,
      syncLibraryFileFromWorkingCopySnapshot: actions.syncLibraryFileFromWorkingCopySnapshot,
      withFileLock: actions.withFileLock,
      withFileLocks: actions.withFileLocks,
      writeFile: actions.writeFile,
    },
  });

  const renumberXAction = createRenumberXAction({
    api,
    state: {
      getActiveFilePath: state.getActiveFilePath,
      getActiveTuneIndex: state.getActiveTuneIndex,
      getActiveTuneMeta: state.getActiveTuneMeta,
      getActiveTuneUid: state.getActiveTuneUid,
      getCurrentDocumentPath: state.getCurrentDocumentPath,
      getHeaderDirty: state.getHeaderDirty,
      getIsNewTuneDraft: state.getIsNewTuneDraft,
      getLibraryIndex: state.getLibraryIndex,
      getRawMode: state.getRawMode,
      isCurrentDocumentDirty: state.isCurrentDocumentDirty,
      isWorkingCopyOpenForFile: state.isWorkingCopyOpenForFile,
    },
    actions: {
      attachTuneUidsToLibraryFile: actions.attachTuneUidsToLibraryFile,
      flushWorkingCopyTuneSync: actions.flushWorkingCopyTuneSync,
      getActiveFileEntry: actions.getActiveFileEntry,
      hasUnsavedChangesForFile: actions.hasUnsavedChangesForFile,
      markCurrentDocumentClean: actions.markCurrentDocumentClean,
      markDiskConflictPath: actions.markDiskConflictPath,
      pathsEqual: actions.pathsEqual,
      patchCurrentDocument: actions.patchCurrentDocument,
      readFile: actions.readFile,
      refreshLibraryFile: actions.refreshLibraryFile,
      refreshWorkingCopySnapshot: actions.refreshWorkingCopySnapshot,
      renumberXLinesConsecutive: actions.renumberXLinesConsecutive,
      resetWorkingCopyTuneSyncDebounce: actions.resetWorkingCopyTuneSyncDebounce,
      scheduleRenderLibraryTree: actions.scheduleRenderLibraryTree,
      selectTune: actions.selectTune,
      setDirtyIndicator: actions.setDirtyIndicator,
      setFileContentInCache: actions.setFileContentInCache,
      setStatus: actions.setStatus,
      showSaveError: actions.showSaveError,
      showToast: actions.showToast,
      updateFileContext: actions.updateFileContext,
      withFileLock: actions.withFileLock,
      writeFile: actions.writeFile,
    },
  });

  return {
    appendCurrentTuneAction,
    clearClipboardTune,
    copyTuneById: (tuneId, mode) => tuneClipboardController.copyTuneById(tuneId, mode),
    deleteTuneAction,
    duplicateTuneAction,
    findTuneById,
    getClipboardTune,
    getTuneText,
    newFileAction,
    pasteMoveTuneAction,
    renumberXAction,
    setClipboardTune,
    tuneClipboardController,
  };
}

export {
  createLibraryCrudDomain,
};
