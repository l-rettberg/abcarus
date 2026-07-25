import { createAppendTuneToActiveFileAction } from "./append_tune_action.js";
import { createLibraryActions } from "./actions.js";
import { createLibraryContextMenu } from "./context_menu.js";
import { buildGroupEntries as buildGroupEntriesCore } from "./group_entries.js";
import { createLibraryShellController } from "./library_shell_controller.js";
import { createMoveTuneModalController } from "./move_tune_modal_controller.js";
import { createRenameFileController } from "./rename_file_controller.js";
import { getEntryTuneCount } from "./sorting_filtering.js";
import { createLibraryViewStore } from "./store.js";
import { createLibraryTreeView } from "./tree_view.js";
import {
  createLibraryUiStateController,
  normalizeTitleKey as normalizeLibraryTitleKey,
} from "./ui_state_controller.js";
import { createXIssuesModalController } from "./x_issues_modal_controller.js";

function createLibraryUiDomain({
  api = null,
  documentRef = typeof document !== "undefined" ? document : null,
  windowRef = typeof window !== "undefined" ? window : null,
  navigatorRef = typeof navigator !== "undefined" ? navigator : null,
  elements = {},
  state = {},
  actions = {},
  utils = {},
  constants = {},
  hooks = {},
} = {}) {
  const {
    safeBasename = (value) => String(value || ""),
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    normalizeTitleKey = normalizeLibraryTitleKey,
  } = utils;
  const {
    main = null,
    libraryTree = null,
    tuneSelect = null,
    librarySearch = null,
    groupBy = null,
    sortBy = null,
    sortTunesBy = null,
    moveTuneModal = null,
    moveTuneClose = null,
    moveTuneCancel = null,
    moveTuneTarget = null,
    moveTuneApply = null,
    xIssuesModal = null,
    xIssuesInfo = null,
    xIssuesClose = null,
    xIssuesCopy = null,
    xIssuesJump = null,
    xIssuesAutoFix = null,
  } = elements;

  let shellController = null;
  let uiStateController = null;
  let treeView = null;

  const viewStore = createLibraryViewStore({
    getIndex: () => (typeof state.getLibraryIndex === "function" ? state.getLibraryIndex() : null),
    safeBasename,
  });

  shellController = createLibraryShellController({
    api,
    documentRef,
    windowRef,
    elements: { main },
    state: {
      getLibraryVisible: () => (typeof state.getLibraryVisible === "function" ? state.getLibraryVisible() : false),
      setLibraryVisibleState: (value) => {
        if (typeof state.setLibraryVisibleState === "function") state.setLibraryVisibleState(Boolean(value));
      },
      isLibraryDisabled: () => (typeof state.isLibraryDisabled === "function" ? state.isLibraryDisabled() : false),
      getLastSidebarWidth: () => uiStateController ? uiStateController.getLastSidebarWidth() : 280,
      getLibraryIndex: () => (typeof state.getLibraryIndex === "function" ? state.getLibraryIndex() : null),
    },
    actions: {
      ensureSafeToAbandonCurrentDoc: actions.ensureSafeToAbandonCurrentDoc,
      loadLibraryFromFolder: actions.loadLibraryFromFolder,
      renderBufferStatus: actions.renderBufferStatus,
      resetRightPaneSplit: actions.resetRightPaneSplit,
      scheduleSaveLibraryPrefs: (patch) => uiStateController && uiStateController.scheduleSaveLibraryPrefs(patch),
      setPaneSizes: actions.setPaneSizes,
      setStatus: actions.setStatus,
      showOpenFolderDialog: actions.showOpenFolderDialog,
      showToast: actions.showToast,
    },
    constants,
  });

  function setLibraryTextFilter(value) {
    if (typeof state.setLibraryTextFilter === "function") state.setLibraryTextFilter(value);
    if (librarySearch) librarySearch.value = String(value || "").trim();
  }

  function getVisibleLibraryFiles() {
    const libraryFilter = typeof state.getLibraryFilter === "function" ? state.getLibraryFilter() : null;
    if (libraryFilter) return libraryFilter;
    const libraryIndex = typeof state.getLibraryIndex === "function" ? state.getLibraryIndex() : null;
    return libraryIndex ? (libraryIndex.files || []) : [];
  }

  function buildGroupEntries(files, mode) {
    return buildGroupEntriesCore(files, mode, { normalizeTitleKey });
  }

  function scheduleRenderLibraryTree(files = null) {
    if (treeView) treeView.schedule(files);
  }

  function renderLibraryTree(files = null) {
    if (treeView) treeView.render(files);
  }

  function updateModalRows() {
    if (!documentRef) return;
    const rows = viewStore.getModalRows();
    documentRef.dispatchEvent(new CustomEvent("library-modal:update-rows", { detail: { rows } }));
  }

  uiStateController = createLibraryUiStateController({
    windowRef,
    api,
    documentRef,
    safeBasename,
    pathsEqual,
    getLibraryIndex: () => (typeof state.getLibraryIndex === "function" ? state.getLibraryIndex() : null),
    getLibraryFilter: () => (typeof state.getLibraryFilter === "function" ? state.getLibraryFilter() : null),
    getLibraryTextFilter: () => (typeof state.getLibraryTextFilter === "function" ? state.getLibraryTextFilter() : ""),
    setLibraryTextFilter,
    getActiveFilePath: () => (typeof state.getActiveFilePath === "function" ? state.getActiveFilePath() : ""),
    setActiveFilePath: (filePath) => {
      if (typeof state.setActiveFilePath === "function") state.setActiveFilePath(filePath || null);
    },
    getActiveTuneId: () => (typeof state.getActiveTuneId === "function" ? state.getActiveTuneId() : ""),
    getActiveTuneMeta: () => (typeof state.getActiveTuneMeta === "function" ? state.getActiveTuneMeta() : null),
    setLibraryVisible: (visible, options) => shellController.setLibraryVisible(visible, options),
    scheduleRenderLibraryTree,
    renderLibraryTree,
    updateLibraryStatus: actions.updateLibraryStatus,
    updateLibraryRootUI: actions.updateLibraryRootUI,
    libraryViewStore: viewStore,
    buildGroupEntries,
    selectTune: actions.selectTune,
    refreshLibraryFile: actions.refreshLibraryFile,
    hasFullLibraryIndex: actions.hasFullLibraryIndex,
    ensureFullLibraryIndex: actions.ensureFullLibraryIndex,
    onModalRowsChanged: updateModalRows,
    searchDebounceMs: 180,
  });

  const libraryActions = createLibraryActions({
    openTuneFromSelection: actions.openTuneFromLibrarySelection,
  });

  const renameFileController = createRenameFileController({
    elements: {
      libraryTree,
    },
    state: {
      getActiveEditFilePath: actions.getActiveEditFilePath,
      hasGlobalUnsavedChanges: actions.hasGlobalUnsavedChanges,
      hasUnsavedChangesForFile: actions.hasUnsavedChangesForFile,
      isWorkingCopyOpenForFile: actions.isWorkingCopyOpenForFile,
    },
    actions: {
      renderLibraryTree,
      renameLibraryFile: actions.renameLibraryFile,
      showSaveError: actions.showSaveError,
      showToast: actions.showToast,
      withFileLocks: actions.withFileLocks,
    },
    io: {
      fileExists: actions.fileExists,
      renameFile: actions.renameFile,
    },
    utils: {
      pathsEqual,
      safeDirname: actions.safeDirname,
    },
  });

  function moveTuneToFile(tuneId, targetPath) {
    if (typeof actions.moveTuneToFile === "function") return actions.moveTuneToFile(tuneId, targetPath);
    return Promise.resolve();
  }

  const moveTuneModalController = createMoveTuneModalController({
    modal: moveTuneModal,
    closeButton: moveTuneClose,
    cancelButton: moveTuneCancel,
    targetSelect: moveTuneTarget,
    applyButton: moveTuneApply,
    safeBasename,
    enableDraggableModal: actions.enableDraggableModal,
    showError: actions.showSaveError,
    onMove: moveTuneToFile,
  });

  function openMoveTuneModal(tuneId) {
    const libraryIndex = typeof state.getLibraryIndex === "function" ? state.getLibraryIndex() : null;
    moveTuneModalController.open(tuneId, {
      files: libraryIndex && Array.isArray(libraryIndex.files) ? libraryIndex.files : [],
      activeFilePath: typeof state.getActiveFilePath === "function" ? state.getActiveFilePath() : "",
    });
  }

  const xIssuesModalController = createXIssuesModalController({
    modal: xIssuesModal,
    infoElement: xIssuesInfo,
    closeButton: xIssuesClose,
    copyButton: xIssuesCopy,
    jumpButton: xIssuesJump,
    autoFixButton: xIssuesAutoFix,
    safeBasename,
    enableDraggableModal: actions.enableDraggableModal,
    getFileEntry: (filePath) => {
      const libraryIndex = typeof state.getLibraryIndex === "function" ? state.getLibraryIndex() : null;
      return libraryIndex && Array.isArray(libraryIndex.files)
        ? libraryIndex.files.find((f) => pathsEqual(f.path, filePath))
        : null;
    },
    refreshFile: actions.refreshLibraryFile,
    loadFile: actions.requestLoadLibraryFile,
    selectTune: actions.selectTune,
    autoFixFile: actions.renumberXInActiveFile,
    showToast: actions.showToast,
  });

  const appendTuneToActiveFileAction = createAppendTuneToActiveFileAction({
    api,
    getActiveTuneMeta: () => (typeof state.getActiveTuneMeta === "function" ? state.getActiveTuneMeta() : null),
    getCurrentDocDirty: state.getCurrentDocDirty,
    getHeaderDirty: state.getHeaderDirty,
    getRawMode: state.isRawMode,
    findTuneById: actions.findTuneById,
    getTuneText: actions.getTuneText,
    pathsEqual,
    withFileLock: actions.withFileLock,
    refreshWorkingCopySnapshot: actions.refreshWorkingCopySnapshot,
    markDiskConflictPath: actions.markDiskConflictPath,
    setFileContentInCache: actions.setFileContentInCache,
    syncLibraryFileFromWorkingCopySnapshot: actions.syncLibraryFileFromWorkingCopySnapshot,
    appendTuneTextToFileUnlocked: actions.appendTuneTextToFileUnlocked,
    refreshLibraryFile: actions.refreshLibraryFile,
    setActiveFilePath: (filePath) => {
      if (typeof state.setActiveFilePath === "function") state.setActiveFilePath(filePath || null);
    },
    selectTune: actions.selectTune,
    getNextXNumber: actions.getNextXNumber,
    ensureXNumberInAbc: actions.ensureXNumberInAbc,
    confirmAppendToFile: actions.confirmAppendToFile,
    showToast: actions.showToast,
  });

  treeView = createLibraryTreeView({
    documentRef,
    windowRef,
    treeElement: libraryTree,
    tuneSelectElement: tuneSelect,
    collapsedFiles: uiStateController.getCollapsedFiles(),
    collapsedGroups: uiStateController.getCollapsedGroups(),
    getVisibleLibraryFiles,
    getLibraryTextFilter: () => (typeof state.getLibraryTextFilter === "function" ? state.getLibraryTextFilter() : ""),
    applyLibraryTextFilter: (files, query) => uiStateController.applyLibraryTextFilter(files, query),
    sortLibraryFiles: (files) => uiStateController.sortLibraryFiles(files),
    buildGroupEntries: (files) => buildGroupEntries(files, uiStateController.getGroupMode()),
    sortGroupEntries: (entries) => uiStateController.sortGroupEntries(entries),
    sortTunes: (tunes) => uiStateController.sortTunes(tunes, uiStateController.getTuneSortMode()),
    getEntryTuneCount,
    getRenamingFilePath: () => renameFileController.getRenamingFilePath(),
    setRenamingFilePath: (value) => renameFileController.setRenamingFilePath(value),
    getActiveFilePath: () => (typeof state.getActiveFilePath === "function" ? state.getActiveFilePath() : ""),
    setActiveFilePath: (value) => {
      if (typeof state.setActiveFilePath === "function") state.setActiveFilePath(value || null);
    },
    getActiveEditorFilePath: actions.getActiveEditorFilePath,
    getActiveTuneId: () => (typeof state.getActiveTuneId === "function" ? state.getActiveTuneId() : ""),
    getActiveTuneUid: () => (typeof state.getActiveTuneUid === "function" ? state.getActiveTuneUid() : ""),
    isPayloadMode: state.isPayloadMode,
    isRawMode: state.isRawMode,
    pathsEqual,
    commitRenameFile: (oldPath, inputName) => renameFileController.commitRenameFile(oldPath, inputName),
    requestLoadLibraryFile: actions.requestLoadLibraryFile,
    moveTuneToFile,
    showContextMenuAt: actions.showContextMenuAt,
    scheduleSaveLibraryUiState: () => uiStateController.scheduleSaveLibraryUiState(),
    updateFileHeaderPanel: actions.updateFileHeaderPanel,
    showHoverStatus: actions.showHoverStatus,
    restoreHoverStatus: actions.restoreHoverStatus,
    pinHoverStatus: actions.pinHoverStatus,
    selectTuneInRaw: actions.selectTuneInRaw,
    openTuneFromLibrarySelection: actions.openTuneFromLibrarySelection,
    showToast: actions.showToast,
  });

  const contextMenu = createLibraryContextMenu({
    documentRef,
    windowRef,
    navigatorRef,
    getLibraryIndex: () => (typeof state.getLibraryIndex === "function" ? state.getLibraryIndex() : null),
    getLibraryTextFilter: () => (typeof state.getLibraryTextFilter === "function" ? state.getLibraryTextFilter() : ""),
    setLibraryTextFilter,
    getActiveTuneId: () => (typeof state.getActiveTuneId === "function" ? state.getActiveTuneId() : ""),
    getActiveTuneUid: () => (typeof state.getActiveTuneUid === "function" ? state.getActiveTuneUid() : ""),
    getActiveTuneMeta: () => (typeof state.getActiveTuneMeta === "function" ? state.getActiveTuneMeta() : null),
    getCurrentDocDirty: state.getCurrentDocDirty,
    getHeaderDirty: state.getHeaderDirty,
    getIsNewTuneDraft: () => (typeof state.getIsNewTuneDraft === "function" ? state.getIsNewTuneDraft() : false),
    getRawMode: state.isRawMode,
    getClipboardTune: actions.getClipboardTune,
    getEditorView: actions.getEditorView,
    getWindowApi: () => api,
    pathsEqual,
    safeBasename,
    findTuneById: actions.findTuneById,
    hasUnsavedChangesForFile: actions.hasUnsavedChangesForFile,
    isWorkingCopyOpenForFile: actions.isWorkingCopyOpenForFile,
    hasDiskConflictPath: actions.hasDiskConflictPath,
    confirmReloadFromDisk: actions.confirmReloadFromDisk,
    discardAndReloadWorkingCopyFromDisk: actions.discardAndReloadWorkingCopyFromDisk,
    requestLoadLibraryFile: actions.requestLoadLibraryFile,
    deleteTuneById: actions.deleteTuneById,
    copyTuneById: actions.copyTuneById,
    duplicateTuneById: actions.duplicateTuneById,
    pasteClipboardToFile: actions.pasteClipboardToFile,
    promptFindInLibrary: () => {
      shellController.setLibraryVisible(true);
      if (librarySearch) {
        librarySearch.focus();
        try { librarySearch.select(); } catch {}
      }
    },
    renderLibraryTree,
    updateLibraryStatus: actions.updateLibraryStatus,
    refreshLibraryIndex: actions.refreshLibraryIndex,
    beginRenameFile: (filePath) => renameFileController.beginRenameFile(filePath),
    openXIssues: (filePath) => xIssuesModalController.open(filePath),
    renumberXInActiveFile: actions.renumberXInActiveFile,
    openMoveTuneModal,
    addTuneToSetList: actions.addTuneToSetList,
    appendTuneToActiveFile: (tuneId) => appendTuneToActiveFileAction.run(tuneId),
    buildTemplatesPreviewContextMenuItems: actions.buildTemplatesPreviewContextMenuItems,
    handleTemplatesContextMenuAction: actions.handleTemplatesContextMenuAction,
    showToast: actions.showToast,
    showSaveError: actions.showSaveError,
  });

  function wireControls() {
    if (groupBy) {
      groupBy.addEventListener("change", () => {
        uiStateController.handleGroupModeChange(groupBy.value || "file");
        uiStateController.syncControls({ groupBy, sortBy, sortTunesBy });
      });
    }
    if (sortBy) {
      if (sortBy.value) {
        const normalized = uiStateController.setSortMode(sortBy.value);
        sortBy.value = normalized;
      }
      sortBy.addEventListener("change", () => {
        uiStateController.handleSortModeChange(sortBy.value || "");
        uiStateController.syncControls({ sortBy });
      });
    }
    if (sortTunesBy) {
      if (sortTunesBy.value) {
        const normalized = uiStateController.setTuneSortMode(sortTunesBy.value);
        sortTunesBy.value = normalized;
      }
      sortTunesBy.addEventListener("change", () => {
        uiStateController.handleTuneSortModeChange(sortTunesBy.value || "");
        uiStateController.syncControls({ sortTunesBy });
      });
    }
  }

  function resetSearch({ keepFilter = false } = {}) {
    setLibraryTextFilter("");
    if (typeof actions.scheduleSaveLibraryPrefs === "function") actions.scheduleSaveLibraryPrefs({ libraryFilterText: "" });
    else uiStateController.scheduleSaveLibraryPrefs({ libraryFilterText: "" });
    uiStateController.clearLibrarySearchTimer();
    if (!keepFilter && typeof state.hasLibraryFilterLabel === "function" && state.hasLibraryFilterLabel()) {
      if (typeof actions.clearLibraryFilter === "function") actions.clearLibraryFilter();
    } else {
      renderLibraryTree();
      if (typeof actions.updateLibraryStatus === "function") actions.updateLibraryStatus();
    }
  }

  function wireSearch({ clearButton = null } = {}) {
    if (librarySearch) {
      librarySearch.addEventListener("input", () => {
        uiStateController.scheduleLibrarySearch(librarySearch.value || "");
        uiStateController.scheduleSaveLibraryPrefs({ libraryFilterText: librarySearch.value || "" });
      });
      librarySearch.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        resetSearch({ keepFilter: false });
        e.preventDefault();
      });
    }
    if (clearButton) {
      clearButton.addEventListener("click", () => {
        resetSearch({ keepFilter: false });
      });
    }
  }

  function invalidateView() {
    viewStore.invalidate();
    scheduleRenderLibraryTree();
    if (documentRef && documentRef.body && documentRef.body.classList.contains("library-list-open")) {
      updateModalRows();
    }
  }

  function applyLibraryPrefsFromSettings(settings) {
    uiStateController.applyLibraryPrefsFromSettings(settings);
    uiStateController.syncControls({ groupBy, sortBy, sortTunesBy });
  }

  return {
    actions: libraryActions,
    applyLibraryPrefsFromSettings,
    applyLibraryUiStateFromSettings: (settings) => uiStateController.applyLibraryUiStateFromSettings(settings),
    applyLibraryTextFilter: (files, query) => uiStateController.applyLibraryTextFilter(files, query),
    buildGroupEntries,
    clearLibrarySearchTimer: () => uiStateController.clearLibrarySearchTimer(),
    contextMenu,
    beginRenameFile: (filePath) => renameFileController.beginRenameFile(filePath),
    commitRenameFile: (oldPath, inputName) => renameFileController.commitRenameFile(oldPath, inputName),
    flushLibraryPrefsSave: () => uiStateController.flushLibraryPrefsSave(),
    expandInitialCollapsedState: () => uiStateController.expandInitialCollapsedState(),
    getModalRows: () => viewStore.getModalRows(),
    getVisibleLibraryFiles,
    invalidateView,
    libraryActions,
    moveTuneToFile,
    normalizeTitleKey: (raw, maxLen, strict) => uiStateController.normalizeTitleKey(raw, maxLen, strict),
    openMoveTuneModal,
    renderLibraryTree,
    restoreLibraryTuneSelection: (selection) => uiStateController.restoreLibraryTuneSelection(selection),
    scheduleLibrarySearch: (value) => uiStateController.scheduleLibrarySearch(value),
    scheduleRenderLibraryTree,
    scheduleSaveLibraryPrefs: (patch) => uiStateController.scheduleSaveLibraryPrefs(patch),
    scheduleSaveLibraryUiState: () => uiStateController.scheduleSaveLibraryUiState(),
    setPrefsWriteSuppressed: (value) => uiStateController.setPrefsWriteSuppressed(value),
    setSortMode: (mode) => uiStateController.setSortMode(mode),
    setTuneSortMode: (mode) => uiStateController.setTuneSortMode(mode),
    shellController,
    sortGroupEntries: (entries) => uiStateController.sortGroupEntries(entries),
    sortLibraryFiles: (files) => uiStateController.sortLibraryFiles(files),
    sortTunes: (list, mode) => uiStateController.sortTunes(list, mode),
    syncControls: (controls) => uiStateController.syncControls(controls),
    treeView,
    uiStateController,
    viewStore,
    wireControls,
    wireSearch,
  };
}

export {
  createLibraryUiDomain,
};
