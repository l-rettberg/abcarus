export function createLibraryMetadataController({
  api = null,
  state = {},
  actions = {},
} = {}) {
  const {
    getLibraryIndex = () => null,
    setLibraryIndex = () => {},
    getWorkingCopySnapshot = () => null,
    getActiveFilePath = () => "",
    setActiveFilePath = () => {},
    getActiveTuneMeta = () => null,
    setActiveTuneMeta = () => {},
    getActiveTuneIndex = () => null,
    setActiveTuneId = () => {},
    setActiveTuneUid = () => {},
    setActiveTuneIndex = () => {},
    getCurrentDocumentPath = () => "",
    getLibraryFilterLabel = () => "",
    getLibraryTextFilter = () => "",
    isTuneErrorFilterActive = () => false,
    isTuneErrorScanInFlight = () => false,
    isWorkingCopyOpenForFile = () => false,
    isStartupPerfEnabled = () => false,
  } = state;

  const {
    buildTuneMetaLabel = () => "",
    clearLibraryFilter = () => {},
    countLines = () => 1,
    fileExists = async () => false,
    getFileContentFromCache = () => null,
    invalidateLibraryView = () => {},
    logErr = () => {},
    logStartupPerf = () => {},
    markActiveTuneButton = () => {},
    normalizeFileContentCacheKey = (p) => String(p || ""),
    parseTuneIdentityFields = () => null,
    patchCurrentDocument = () => {},
    pathsEqual = (a, b) => String(a || "") === String(b || ""),
    perfNowMs = () => 0,
    renderLibraryTree = () => {},
    safeBasename = (p) => String(p || ""),
    scheduleRenderLibraryTree = () => {},
    scheduleSaveLibraryUiState = () => {},
    setDirtyIndicator = () => {},
    setFileContentInCache = () => {},
    setFileNameMeta = () => {},
    setScanStatus = () => {},
    setTuneMetaText = () => {},
    updateFileContext = () => {},
    updateFileHeaderPanel = () => {},
    updateLibraryModalRows = () => {},
    updateLibraryRootUI = () => {},
  } = actions;

  let fullScanInFlight = false;
  let fullScanToken = "";

  function hasFullLibraryIndex() {
    const libraryIndex = getLibraryIndex();
    return Boolean(libraryIndex && libraryIndex.indexMode === "full");
  }

  function updateLibraryStatus() {
    const libraryFilterLabel = getLibraryFilterLabel();
    if (libraryFilterLabel) {
      setScanStatus(`Filter: ${libraryFilterLabel}`);
      return;
    }
    if (isTuneErrorFilterActive()) {
      if (!isTuneErrorScanInFlight()) setScanStatus("Filter: Error tunes");
      return;
    }
    const libraryTextFilter = getLibraryTextFilter();
    if (libraryTextFilter) {
      setScanStatus(`Search: ${libraryTextFilter}`);
      return;
    }
    const libraryIndex = getLibraryIndex();
    if (libraryIndex) {
      const count = (libraryIndex.files || []).length;
      setScanStatus("Ready", `Ready (${count} files)`);
      return;
    }
    setScanStatus("Idle");
  }

  async function ensureFullLibraryIndex({ reason = "" } = {}) {
    const perfOn = isStartupPerfEnabled();
    const t0 = perfOn ? perfNowMs() : 0;
    if (!api || typeof api.scanLibrary !== "function") return false;
    const currentIndex = getLibraryIndex();
    if (!currentIndex || !currentIndex.root) return false;
    if (hasFullLibraryIndex()) return true;
    if (fullScanInFlight) return false;

    fullScanInFlight = true;
    const scanToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    fullScanToken = scanToken;
    const root = currentIndex.root;
    setScanStatus(reason ? `Indexing… (${reason})` : "Indexing…");
    try {
      const result = await api.scanLibrary(root, { token: scanToken });
      if (!result || !result.root || result.root !== root) return false;
      if (fullScanToken !== scanToken) return false;
      setLibraryIndex({ ...result, indexMode: "full" });
      invalidateLibraryView();
      updateLibraryRootUI();
      scheduleRenderLibraryTree();
      updateLibraryStatus();
      updateLibraryModalRows();
      return true;
    } catch (e) {
      logErr(e && e.message ? e.message : String(e));
      setScanStatus("Indexing failed.");
      return false;
    } finally {
      if (perfOn) {
        const libraryIndex = getLibraryIndex();
        logStartupPerf("ensureFullLibraryIndex()", {
          reason: String(reason || ""),
          ms: Math.round(perfNowMs() - t0),
          root: root ? safeBasename(root) : "",
          ok: hasFullLibraryIndex(),
          files: libraryIndex && libraryIndex.files ? libraryIndex.files.length : 0,
        });
      }
      if (fullScanToken === scanToken) {
        fullScanToken = "";
        fullScanInFlight = false;
      }
    }
  }

  function attachTuneUidsToLibraryFile(filePath, snapshot) {
    const libraryIndex = getLibraryIndex();
    if (!libraryIndex || !libraryIndex.files || !filePath || !snapshot) return;
    const fileEntry = libraryIndex.files.find((f) => pathsEqual(f.path, filePath));
    if (!fileEntry || !Array.isArray(fileEntry.tunes)) return;
    const wcTunes = Array.isArray(snapshot.tunes) ? snapshot.tunes : [];
    if (!wcTunes.length) return;
    if (fileEntry.tunes.length !== wcTunes.length) return;
    for (let i = 0; i < fileEntry.tunes.length; i += 1) {
      const tune = fileEntry.tunes[i];
      const wcTune = wcTunes[i];
      if (!tune || !wcTune) continue;
      tune.tuneIndex = i;
      tune.tuneUid = wcTune.tuneUid;
      try {
        const xMatch = String(wcTune.xLabel || "").match(/^\s*X:\s*(\d+)/);
        if (xMatch) tune.xNumber = xMatch[1];
      } catch {}
    }
  }

  function syncLibraryFileFromWorkingCopySnapshot(filePath, snapshot) {
    const libraryIndex = getLibraryIndex();
    if (!libraryIndex || !libraryIndex.files || !filePath || !snapshot) return null;
    const fileEntry = libraryIndex.files.find((f) => pathsEqual(f.path, filePath));
    if (!fileEntry) return null;

    const fullText = String(snapshot.text || "");
    const wcTunes = Array.isArray(snapshot.tunes) ? snapshot.tunes : [];
    const preambleEnd = snapshot.preambleSlice && Number.isFinite(Number(snapshot.preambleSlice.end))
      ? Number(snapshot.preambleSlice.end)
      : 0;
    fileEntry.headerEndOffset = preambleEnd;
    fileEntry.headerText = fullText.slice(0, Math.min(fullText.length, Math.max(0, preambleEnd)));

    const prevTunes = Array.isArray(fileEntry.tunes) ? fileEntry.tunes : [];
    const prevByUid = new Map();
    for (const t of prevTunes) {
      if (t && t.tuneUid) prevByUid.set(String(t.tuneUid), t);
    }

    const lineStarts = [0];
    for (let i = 0; i < fullText.length; i += 1) {
      if (fullText[i] === "\n") lineStarts.push(i + 1);
    }
    const lineNumberAtOffset = (offset) => {
      const off = Math.max(0, Math.min(fullText.length, Number(offset) || 0));
      let lo = 0;
      let hi = lineStarts.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (lineStarts[mid] <= off) lo = mid + 1;
        else hi = mid;
      }
      return Math.max(1, lo);
    };

    const nextTunes = [];
    for (let i = 0; i < wcTunes.length; i += 1) {
      const wcTune = wcTunes[i];
      if (!wcTune) continue;
      const startOffset = Number(wcTune.start) || 0;
      const endOffset = Number(wcTune.end) || 0;
      const tuneText = fullText.slice(startOffset, Math.min(fullText.length, Math.max(startOffset, endOffset)));
      const parsed = (() => {
        try { return parseTuneIdentityFields(tuneText); } catch { return null; }
      })();
      const xMatch = String(wcTune.xLabel || "").match(/^\s*X:\s*(\d+)/);
      const existing = wcTune.tuneUid ? prevByUid.get(String(wcTune.tuneUid)) : null;

      const title = (existing && existing.title) ? String(existing.title) : (parsed && parsed.title ? String(parsed.title) : "");
      const composer = (existing && existing.composer) ? String(existing.composer) : (parsed && parsed.composer ? String(parsed.composer) : "");
      const key = (existing && existing.key) ? String(existing.key) : (parsed && parsed.key ? String(parsed.key) : "");

      let preview = (existing && existing.preview) ? String(existing.preview) : "";
      if (!preview) {
        preview = title || (xMatch ? `X:${xMatch[1]}` : "");
        if (!preview) {
          const lines = tuneText.split(/\r\n|\n|\r/);
          for (const line of lines) {
            const trimmed = String(line || "").trim();
            if (trimmed) {
              preview = trimmed;
              break;
            }
          }
        }
      }

      const startLine = lineNumberAtOffset(startOffset);
      const endLine = startLine + countLines(tuneText) - 1;
      const xNumber = xMatch ? xMatch[1] : (parsed && parsed.xNumber ? String(parsed.xNumber) : "");

      nextTunes.push({
        ...(existing && typeof existing === "object" ? existing : {}),
        id: `${filePath}::${startOffset}`,
        indexInFile: i + 1,
        tuneIndex: i,
        tuneUid: wcTune.tuneUid || null,
        xNumber,
        title,
        composer,
        key,
        preview,
        startLine,
        endLine,
        startOffset,
        endOffset,
      });
    }

    fileEntry.tunes = nextTunes;
    invalidateLibraryView();
    scheduleRenderLibraryTree();
    updateLibraryStatus();
    scheduleSaveLibraryUiState();
    return fileEntry;
  }

  function dropLibraryFileEntry(filePath) {
    const p = filePath ? String(filePath) : "";
    const libraryIndex = getLibraryIndex();
    if (!p || !libraryIndex || !Array.isArray(libraryIndex.files)) return false;
    const idx = libraryIndex.files.findIndex((f) => pathsEqual(f && f.path, p));
    if (idx >= 0) {
      libraryIndex.files.splice(idx, 1);
      invalidateLibraryView();
    }
    if (getActiveFilePath() && pathsEqual(getActiveFilePath(), p)) setActiveFilePath(null);
    const activeTuneMeta = getActiveTuneMeta();
    if (activeTuneMeta && pathsEqual(activeTuneMeta.path, p)) {
      setActiveTuneMeta(null);
      setActiveTuneId(null);
      setActiveTuneUid(null);
      setActiveTuneIndex(null);
    }
    const currentDocumentPath = getCurrentDocumentPath();
    if (currentDocumentPath && pathsEqual(currentDocumentPath, p)) {
      patchCurrentDocument({ path: null, content: "", dirty: false }, { create: false });
    }
    setDirtyIndicator(false);
    updateLibraryStatus();
    scheduleRenderLibraryTree();
    return true;
  }

  async function refreshLibraryFile(filePath, options) {
    if (!api || typeof api.parseLibraryFile !== "function") return null;
    if (!await fileExists(filePath)) {
      if (!isWorkingCopyOpenForFile(filePath)) dropLibraryFileEntry(filePath);
      return null;
    }
    const res = await api.parseLibraryFile(filePath, options);
    if (!res || !res.files || !res.files.length) return null;
    const updatedFile = res.files[0];
    const libraryIndex = getLibraryIndex();
    if (!libraryIndex) {
      setLibraryIndex({ root: res.root, files: [updatedFile] });
      invalidateLibraryView();
    } else {
      const idx = libraryIndex.files.findIndex((f) => pathsEqual(f.path, updatedFile.path));
      if (idx >= 0) libraryIndex.files[idx] = updatedFile;
      else libraryIndex.files.push(updatedFile);
      invalidateLibraryView();
    }

    try {
      const workingCopySnapshot = getWorkingCopySnapshot();
      if (
        workingCopySnapshot
        && workingCopySnapshot.path
        && pathsEqual(workingCopySnapshot.path, updatedFile.path)
      ) {
        attachTuneUidsToLibraryFile(updatedFile.path, workingCopySnapshot);
      }
    } catch {}

    renderLibraryTree();
    updateFileContext();
    updateFileHeaderPanel();
    return updatedFile;
  }

  async function renameLibraryFile(oldPath, newPath) {
    if (!api || typeof api.parseLibraryFile !== "function") return null;
    const res = await api.parseLibraryFile(newPath);
    if (!res || !res.files || !res.files.length) return null;
    const updatedFile = res.files[0];
    const libraryIndex = getLibraryIndex();
    if (!libraryIndex) {
      setLibraryIndex({ root: res.root, files: [updatedFile] });
      invalidateLibraryView();
    } else {
      libraryIndex.files = (libraryIndex.files || []).filter((f) => !pathsEqual(f.path, oldPath));
      libraryIndex.files.push(updatedFile);
      invalidateLibraryView();
    }

    const oldCacheKey = normalizeFileContentCacheKey(oldPath);
    if (oldCacheKey && actions.hasFileContentCacheKey?.(oldCacheKey)) {
      const cached = getFileContentFromCache(oldPath);
      if (cached != null) {
        setFileContentInCache(newPath, cached);
        actions.deleteFileContentCacheKey?.(oldCacheKey);
      }
    }

    if (pathsEqual(getActiveFilePath(), oldPath)) setActiveFilePath(newPath);

    const activeTuneMeta = getActiveTuneMeta();
    if (activeTuneMeta && pathsEqual(activeTuneMeta.path, oldPath)) {
      activeTuneMeta.path = newPath;
      const tune = (updatedFile.tunes || []).find((t) => t.startOffset === activeTuneMeta.startOffset);
      if (tune) {
        setActiveTuneId(tune.id);
        activeTuneMeta.xNumber = tune.xNumber;
        activeTuneMeta.title = tune.title || "";
        activeTuneMeta.composer = tune.composer || "";
        activeTuneMeta.key = tune.key || "";
      } else {
        setActiveTuneId(`${newPath}::${activeTuneMeta.startOffset}`);
      }
      setTuneMetaText(buildTuneMetaLabel(activeTuneMeta));
      setFileNameMeta(actions.stripFileExtension ? actions.stripFileExtension(updatedFile.basename || "") : String(updatedFile.basename || ""));
      markActiveTuneButton(actions.getActiveTuneId ? actions.getActiveTuneId() : "");
    }

    renderLibraryTree();
    updateFileHeaderPanel();
    return updatedFile;
  }

  async function refreshLibraryIndex() {
    if (typeof actions.isLibraryDisabled === "function" && actions.isLibraryDisabled()) {
      actions.showToast?.("Library is disabled while editing ChordPro.", 2400);
      return;
    }
    if (!api || typeof api.scanLibrary !== "function") return;
    const libraryIndex = getLibraryIndex();
    if (!libraryIndex || !libraryIndex.root) {
      actions.setStatus?.("Load a library folder first.");
      return;
    }
    const scanToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const rootAtStart = libraryIndex.root;
    setScanStatus("Refreshing…");
    actions.clearFileContentCache?.();
    actions.clearErrorsIndex?.();
    if (libraryIndex && libraryIndex.root) {
      setFileNameMeta(actions.stripFileExtension ? actions.stripFileExtension(safeBasename(libraryIndex.root)) : safeBasename(libraryIndex.root));
    }
    try {
      if (typeof api.scanLibraryDiscover === "function") {
        const discovered = await api.scanLibraryDiscover(libraryIndex.root, { token: scanToken, computeMeta: true });
        const currentIndex = getLibraryIndex();
        if (discovered && discovered.root && Array.isArray(discovered.files)) {
          if (!currentIndex || currentIndex.root !== rootAtStart) return;
          setLibraryIndex({
            root: discovered.root,
            files: (discovered.files || []).map((f) => ({ ...f, tunes: Array.isArray(f.tunes) ? f.tunes : [] })),
          });
          invalidateLibraryView();
          updateLibraryRootUI();
          scheduleRenderLibraryTree();
          updateLibraryStatus();
        }
      }
      const latestIndex = getLibraryIndex();
      if (!latestIndex || latestIndex.root !== rootAtStart) return;
      await ensureFullLibraryIndex({ reason: "refresh" });
      if (getLibraryFilterLabel()) clearLibraryFilter();
      else {
        scheduleRenderLibraryTree();
        updateLibraryStatus();
      }
    } catch (e) {
      setScanStatus("Refresh failed.");
      logErr(e && e.message ? e.message : String(e));
    }
  }

  return {
    hasFullLibraryIndex,
    ensureFullLibraryIndex,
    updateLibraryStatus,
    attachTuneUidsToLibraryFile,
    syncLibraryFileFromWorkingCopySnapshot,
    dropLibraryFileEntry,
    refreshLibraryFile,
    renameLibraryFile,
    refreshLibraryIndex,
  };
}
