export function createStartupController({
  api = null,
  requestAnimationFrameRef = (callback) => callback(),
  getLibraryRoot = () => "",
  pathsEqual = (left, right) => String(left || "") === String(right || ""),
  loadLibraryFromFolder = async () => {},
  openRecentTune = async () => ({ ok: false }),
  openRecentFile = async () => ({ ok: false }),
  openRecentFolder = async () => ({ ok: false }),
  applyInitialLayout = () => {},
  centerRenderPane = () => {},
  reportStartupStatus = () => {},
  markRecentOpenStarted = () => {},
  markUiReady = () => {},
  renderStatus = () => {},
} = {}) {
  let layoutResetDone = false;
  let layoutResetScheduled = false;

  function scheduleLayoutReset() {
    if (layoutResetDone || layoutResetScheduled) return;
    layoutResetScheduled = true;
    requestAnimationFrameRef(() => {
      layoutResetScheduled = false;
      if (layoutResetDone) return;
      layoutResetDone = true;
      try { applyInitialLayout(); } catch {}
      requestAnimationFrameRef(() => {
        try { centerRenderPane(); } catch {}
      });
    });
  }

  async function getRecentCandidates() {
    if (!api) return [];
    if (typeof api.getRecentCandidates === "function") {
      const list = await api.getRecentCandidates();
      if (Array.isArray(list) && list.length) return list;
    }
    if (typeof api.getLastRecent === "function") {
      const recent = await api.getLastRecent();
      if (recent && recent.entry) return [recent];
    }
    return [];
  }

  async function restoreRecentEntry() {
    if (!api) return false;
    reportStartupStatus("Checking recent files…");
    const candidates = await getRecentCandidates();

    const folderCandidate = candidates.find((candidate) => (
      candidate
      && candidate.type === "folder"
      && candidate.entry
      && candidate.entry.path
    ));
    if (folderCandidate) {
      reportStartupStatus("Opening recent folder…");
      try {
        await loadLibraryFromFolder(folderCandidate.entry.path, { selectInitialTune: false });
        if (getLibraryRoot()) markRecentOpenStarted();
      } catch {}
    }

    for (const candidate of candidates) {
      if (!candidate || !candidate.entry) continue;
      if (candidate.type === "tune") {
        reportStartupStatus("Opening recent tune…");
        const opened = await openRecentTune(candidate.entry);
        if (opened && opened.ok) {
          markRecentOpenStarted();
          return true;
        }
        continue;
      }
      if (candidate.type === "file") {
        reportStartupStatus("Opening recent file…");
        const opened = await openRecentFile(candidate.entry);
        if (opened && opened.ok) {
          markRecentOpenStarted();
          return true;
        }
        continue;
      }
      if (candidate.type === "folder") {
        const currentRoot = getLibraryRoot();
        if (currentRoot && pathsEqual(currentRoot, candidate.entry.path)) {
          markRecentOpenStarted();
          return true;
        }
        reportStartupStatus("Opening recent folder…");
        const opened = await openRecentFolder(candidate.entry);
        if (opened && opened.ok) {
          markRecentOpenStarted();
          return true;
        }
      }
    }
    return false;
  }

  async function start() {
    requestAnimationFrameRef(() => {
      try { applyInitialLayout(); } catch {}
    });
    try {
      const didStart = await restoreRecentEntry();
      if (!didStart && !(api && typeof api.getSettings === "function")) markUiReady();
      else renderStatus();
      return didStart;
    } catch {
      if (!(api && typeof api.getSettings === "function")) markUiReady();
      else renderStatus();
      return false;
    }
  }

  return {
    restoreRecentEntry,
    scheduleLayoutReset,
    start,
  };
}
