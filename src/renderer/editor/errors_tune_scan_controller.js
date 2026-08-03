import { createErrorsScanState } from "./errors_scan_state.js";

function createErrorsTuneScanController({
  isEnabled,
  isDirty,
  confirmUnsavedChanges,
  performSaveFlow,
  getFileContent,
  selectTune,
  getActiveTuneId,
  getEditorScroll,
  setEditorScroll,
  getRenderScroll,
  setRenderScroll,
  setSuppressRecentEntries,
  setErrorLineOffsetFromHeader,
  setScanButtonState,
  setScanButtonActive,
  buildTuneSelectOptions,
  setScanErrors,
  getErrorEntries,
  setStatus,
  onIdleIndexChanged,
} = {}) {
  const scanState = createErrorsScanState();
  const errorIndex = new Map();

  function enabled() {
    return typeof isEnabled === "function" ? Boolean(isEnabled()) : true;
  }

  function setTuneErrorCount(tuneId, count) {
    if (!tuneId) return;
    if (count > 0) errorIndex.set(tuneId, count);
    else errorIndex.delete(tuneId);
    if (scanState.isFilterActive() && !scanState.isInFlight() && typeof onIdleIndexChanged === "function") {
      onIdleIndexChanged();
    }
  }

  function clearIndexForFile(entry) {
    if (!entry || !Array.isArray(entry.tunes)) return;
    for (const tune of entry.tunes) {
      if (tune && tune.id) errorIndex.delete(tune.id);
    }
  }

  function updateIndexFromCurrentErrors(activeTuneId, entries) {
    if (!activeTuneId) return;
    let count = 0;
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (entry && entry.tuneId === activeTuneId) count += entry.count || 1;
    }
    setTuneErrorCount(activeTuneId, count);
  }

  function getFilteredTunes(tunes) {
    const list = Array.isArray(tunes) ? tunes : [];
    return scanState.isFilterActive()
      ? list.filter((tune) => tune && errorIndex.has(tune.id))
      : list;
  }

  function finishScanUi() {
    scanState.finish();
    if (typeof setScanButtonState === "function") setScanButtonState(false);
    if (typeof setScanButtonActive === "function") setScanButtonActive(scanState.isFilterActive());
  }

  async function scanActiveFile(entry, { filterToErrorTunes = false } = {}) {
    if (!enabled()) return;
    if (!entry || !entry.path) return;
    if (typeof isDirty === "function" && isDirty()) {
      const choice = typeof confirmUnsavedChanges === "function"
        ? await confirmUnsavedChanges("scanning error tunes")
        : "cancel";
      if (choice === "cancel") {
        finishScanUi();
        return;
      }
      if (choice === "save") {
        const ok = typeof performSaveFlow === "function" ? await performSaveFlow() : false;
        if (!ok) {
          finishScanUi();
          return;
        }
      }
    }

    const token = scanState.begin({ filterToErrorTunes });
    if (typeof setScanButtonState === "function") setScanButtonState(true);
    if (typeof setScanButtonActive === "function") setScanButtonActive(scanState.isFilterActive());
    clearIndexForFile(entry);

    const contentRes = typeof getFileContent === "function" ? await getFileContent(entry.path) : { ok: true };
    if (!contentRes || !contentRes.ok) {
      finishScanUi();
      return;
    }

    const tunes = Array.isArray(entry.tunes) ? entry.tunes : [];
    if (typeof setErrorLineOffsetFromHeader === "function") setErrorLineOffsetFromHeader("");
    const previousTuneId = typeof getActiveTuneId === "function" ? getActiveTuneId() : null;
    const previousEditorScroll = typeof getEditorScroll === "function" ? getEditorScroll() : 0;
    const previousRenderScroll = typeof getRenderScroll === "function" ? getRenderScroll() : 0;

    try {
      if (typeof setSuppressRecentEntries === "function") setSuppressRecentEntries(true);
      for (let i = 0; i < tunes.length; i += 1) {
        if (!scanState.isCurrent(token)) return;
        const tune = tunes[i];
        if (!tune || !Number.isFinite(tune.startOffset) || !Number.isFinite(tune.endOffset)) {
          setTuneErrorCount(tune && tune.id ? tune.id : "", 0);
          continue;
        }
        if (typeof selectTune === "function") {
          await selectTune(tune.id, { skipConfirm: true, suppressRecent: true });
        }
        setTuneErrorCount(tune.id, errorIndex.has(tune.id) ? 1 : 0);
        if (i % 10 === 0) {
          if (typeof setStatus === "function") setStatus(`Scanning error tunes... ${i + 1}/${tunes.length}`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      let restoredTuneId = previousTuneId;
      if (scanState.isFilterActive()) {
        const firstErrorTune = tunes.find((tune) => tune && errorIndex.has(tune.id));
        if (firstErrorTune && firstErrorTune.id) restoredTuneId = firstErrorTune.id;
      }
      const activeTuneId = typeof getActiveTuneId === "function" ? getActiveTuneId() : null;
      if (restoredTuneId && restoredTuneId !== activeTuneId && typeof selectTune === "function") {
        await selectTune(restoredTuneId, { skipConfirm: true });
      }
      if (typeof setEditorScroll === "function") setEditorScroll(previousEditorScroll);
      if (typeof setRenderScroll === "function") setRenderScroll(previousRenderScroll);
      if (typeof setStatus === "function") setStatus("OK");
    } finally {
      if (typeof setSuppressRecentEntries === "function") setSuppressRecentEntries(false);
      finishScanUi();
      if (typeof buildTuneSelectOptions === "function") buildTuneSelectOptions(entry);
      if (typeof setScanErrors === "function") {
        const entries = typeof getErrorEntries === "function" ? getErrorEntries() : [];
        setScanErrors(entries);
      }
    }
  }

  return {
    cancel: () => scanState.cancel(),
    clearFilter: () => scanState.clearFilter(),
    clearIndex: () => errorIndex.clear(),
    clearIndexForFile,
    getFilteredTunes,
    hasIndexedErrors: () => errorIndex.size > 0,
    hasTuneError: (tuneId) => Boolean(tuneId && errorIndex.has(tuneId)),
    invalidate: () => scanState.invalidate(),
    isFilterActive: () => scanState.isFilterActive(),
    isInFlight: () => scanState.isInFlight(),
    scanActiveFile,
    setFilterActive: (next) => scanState.setFilterActive(next),
    setTuneErrorCount,
    updateIndexFromCurrentErrors,
  };
}

export {
  createErrorsTuneScanController,
};
