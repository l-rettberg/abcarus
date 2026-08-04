function createFileContextController({
  elements = {},
  errors = {},
  chordPro = {},
  state = {},
  actions = {},
  utils = {},
} = {}) {
  const {
    tuneSelect = null,
  } = elements;

  const {
    getFilteredTunes = (tunes) => tunes,
    hasIndexedErrors = () => false,
    updateScanButtonVisibility = () => {},
    setScanButtonActive = () => {},
  } = errors;

  const {
    isEnabled: isChordProEnabled = () => false,
    updateSelectOptions: updateChordProSelectOptions = () => {},
    getActiveIndex: getChordProActiveIndex = () => 0,
    setActiveBlock: setChordProActiveBlock = async () => false,
  } = chordPro;

  const {
    getActiveFileEntry = () => null,
    getActiveFilePath = () => "",
    getActiveTuneId = () => null,
    getActiveTuneUid = () => null,
    getActiveTuneMeta = () => null,
    getIsNewTuneDraft = () => false,
    setIsNewTuneDraft = () => {},
    getLibraryIndex = () => null,
    getRawMode = () => false,
    isPayloadMode = () => false,
    isTuneErrorFilterActive = () => false,
    isTuneErrorScanInFlight = () => false,
  } = state;

  const {
    selectTune = async () => {},
    showToast = () => {},
  } = actions;

  const {
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
  } = utils;

  function clearTuneSelect() {
    if (!tuneSelect) return;
    tuneSelect.textContent = "";
    tuneSelect.disabled = true;
  }

  function buildTuneSelectOptions(fileEntry) {
    if (!tuneSelect) return;
    tuneSelect.textContent = "";
    if (!fileEntry || !fileEntry.tunes || !fileEntry.tunes.length) {
      tuneSelect.disabled = true;
      return;
    }
    const sourceTunes = fileEntry.tunes.slice().sort((a, b) => (Number(a.xNumber) || 0) - (Number(b.xNumber) || 0));
    const tunes = getFilteredTunes(sourceTunes);
    if (getIsNewTuneDraft()) {
      const option = document.createElement("option");
      option.value = "__new__";
      option.textContent = "(New tune draft)";
      option.selected = true;
      tuneSelect.appendChild(option);
    }
    if (isTuneErrorFilterActive() && isTuneErrorScanInFlight() && !hasIndexedErrors()) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "(Scanning errors…)";
      option.disabled = true;
      option.selected = true;
      tuneSelect.appendChild(option);
      tuneSelect.disabled = true;
      return;
    }
    if (!tunes.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = isTuneErrorFilterActive() ? "(No error tunes)" : "(No tunes)";
      option.disabled = true;
      option.selected = true;
      tuneSelect.appendChild(option);
      tuneSelect.disabled = true;
      return;
    }
    const rawMode = getRawMode();
    for (const tune of tunes) {
      const option = document.createElement("option");
      option.value = rawMode ? tune.id : (tune.tuneUid || tune.id);
      const title = tune.title || tune.preview || "";
      const label = tune.xNumber ? `X:${tune.xNumber} ${title}`.trim() : title || tune.id;
      option.textContent = label;
      tuneSelect.appendChild(option);
    }
    tuneSelect.disabled = rawMode;
    const activeTuneUid = getActiveTuneUid();
    const activeTuneId = getActiveTuneId();
    if (!getIsNewTuneDraft() && (activeTuneUid || activeTuneId)) {
      tuneSelect.value = rawMode ? activeTuneId : (activeTuneUid || activeTuneId);
    }
    if (!getIsNewTuneDraft() && !tuneSelect.value) {
      tuneSelect.selectedIndex = 0;
    }
  }

  function updateFileContext() {
    if (isChordProEnabled()) {
      updateChordProSelectOptions();
      updateScanButtonVisibility(null);
      setScanButtonActive(false);
      return;
    }
    const entry = getActiveFileEntry();
    if (!entry) {
      clearTuneSelect();
      updateScanButtonVisibility(null);
      setScanButtonActive(false);
      return;
    }
    buildTuneSelectOptions(entry);
    updateScanButtonVisibility(entry);
    setScanButtonActive(isTuneErrorFilterActive());
  }

  function getNavigableTuneIdsFromFileSelect() {
    if (!tuneSelect || tuneSelect.disabled) return [];
    const ids = [];
    for (const opt of Array.from(tuneSelect.options || [])) {
      if (!opt || opt.disabled) continue;
      const value = opt.value != null ? String(opt.value) : "";
      if (!value || value === "__new__") continue;
      ids.push(value);
    }
    return ids;
  }

  async function navigateTuneByDelta(delta) {
    if (isChordProEnabled()) {
      await setChordProActiveBlock(getChordProActiveIndex() + delta, { scroll: true });
      return;
    }
    if (getRawMode()) {
      showToast("Raw mode: tune navigation updates after save or exit.", 2400);
      return;
    }

    const activeTuneMeta = getActiveTuneMeta();
    const activeFilePath = getActiveFilePath();
    const filePath = (activeTuneMeta && activeTuneMeta.path)
      ? String(activeTuneMeta.path)
      : (activeFilePath ? String(activeFilePath) : "");
    const libraryIndex = getLibraryIndex();
    const fileEntry = (filePath && libraryIndex && Array.isArray(libraryIndex.files))
      ? (libraryIndex.files.find((f) => pathsEqual(f && f.path, filePath)) || null)
      : null;

    const orderedTunes = fileEntry && Array.isArray(fileEntry.tunes)
      ? fileEntry.tunes.slice().sort((a, b) => (Number(a.startOffset) || 0) - (Number(b.startOffset) || 0))
      : [];

    const selectedValue = (tuneSelect && tuneSelect.value != null) ? String(tuneSelect.value) : "";
    const rawMode = getRawMode();
    const activeTuneId = getActiveTuneId();
    const activeTuneUid = getActiveTuneUid();
    const activeKey = rawMode ? activeTuneId : (activeTuneUid || activeTuneId);
    const findCurrentInOrdered = () => {
      if (!orderedTunes.length) return -1;
      if (activeKey) {
        const idx = orderedTunes.findIndex((t) => {
          if (!t) return false;
          if (!rawMode && t.tuneUid && t.tuneUid === activeKey) return true;
          return Boolean(t.id && t.id === activeKey);
        });
        if (idx >= 0) return idx;
      }
      if (activeTuneMeta && Number.isFinite(Number(activeTuneMeta.startOffset))) {
        const off = Number(activeTuneMeta.startOffset);
        const idx = orderedTunes.findIndex((t) => Number(t && t.startOffset) === off);
        if (idx >= 0) return idx;
      }
      if (selectedValue) {
        const idx = orderedTunes.findIndex((t) => {
          if (!t) return false;
          if (!rawMode && t.tuneUid && t.tuneUid === selectedValue) return true;
          return Boolean(t.id && t.id === selectedValue);
        });
        if (idx >= 0) return idx;
      }
      return -1;
    };

    let nextId = "";
    let nextTune = null;
    if (orderedTunes.length) {
      const currentIdx = findCurrentInOrdered();
      const startIdx = currentIdx >= 0 ? currentIdx : (delta > 0 ? 0 : orderedTunes.length - 1);
      const nextIdx = Math.max(0, Math.min(orderedTunes.length - 1, startIdx + delta));
      nextTune = orderedTunes[nextIdx];
      nextId = nextTune
        ? String(rawMode ? nextTune.id : (nextTune.tuneUid || nextTune.id) || "")
        : "";
      if (!nextId) return;
      if (currentIdx === nextIdx) {
        showToast(delta > 0 ? "Already at last tune." : "Already at first tune.", 1400);
        return;
      }
    } else {
      const ids = getNavigableTuneIdsFromFileSelect();
      if (!ids.length) {
        showToast(isTuneErrorFilterActive() ? "No error tunes in selection." : "No tunes to navigate.", 2000);
        return;
      }
      const selectedIsNavigable = selectedValue && ids.includes(selectedValue);
      const activeIsNavigable = activeKey && ids.includes(activeKey);
      const current = selectedIsNavigable ? selectedValue : (activeIsNavigable ? activeKey : "");
      const currentIdx = current ? ids.indexOf(current) : -1;
      const startIdx = currentIdx >= 0 ? currentIdx : (delta > 0 ? 0 : ids.length - 1);
      const nextIdx = Math.max(0, Math.min(ids.length - 1, startIdx + delta));
      nextId = ids[nextIdx];
      if (!nextId) return;
      if (currentIdx === nextIdx) {
        showToast(delta > 0 ? "Already at last tune." : "Already at first tune.", 1400);
        return;
      }
    }

    await selectTune(nextId);
  }

  async function handleTuneSelectChange() {
    if (!tuneSelect) return;
    const tuneId = tuneSelect.value;
    if (tuneId === "__new__") return;
    if (getIsNewTuneDraft()) setIsNewTuneDraft(false);
    if (!tuneId) return;
    if (isChordProEnabled()) {
      const idx = Number(tuneId);
      if (Number.isFinite(idx)) await setChordProActiveBlock(idx, { scroll: true });
      return;
    }
    if (isPayloadMode()) {
      showToast("Exit Payload Mode to change tunes.", 2400);
      try {
        const activeTuneUid = getActiveTuneUid();
        const activeTuneId = getActiveTuneId();
        if (activeTuneUid || activeTuneId) tuneSelect.value = getRawMode() ? activeTuneId : (activeTuneUid || activeTuneId);
      } catch {}
      return;
    }
    if (getRawMode()) {
      const activeTuneId = getActiveTuneId();
      if (activeTuneId) tuneSelect.value = activeTuneId;
      showToast("Raw mode: tune selection updates after save or exit.", 2400);
      return;
    }
    selectTune(tuneId);
  }

  function wire() {
    if (!tuneSelect) return;
    tuneSelect.addEventListener("change", handleTuneSelectChange);
  }

  return {
    buildTuneSelectOptions,
    navigateTuneByDelta,
    updateFileContext,
    wire,
  };
}

export {
  createFileContextController,
};
