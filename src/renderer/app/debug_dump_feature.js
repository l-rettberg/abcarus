import {
  buildDebugDumpSnapshot,
  safeJsonStringify,
  safeString,
} from "./debug_dump_builder.js";

function nowCompactStamp() {
  const d = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${y}${m}${day}-${hh}${mm}${ss}`;
}

function createDebugDumpFeature(host = {}) {
  const h = host || {};
  const api = h.api || null;
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  async function buildSnapshot({ reason = "" } = {}) {
    return buildDebugDumpSnapshot({
      reason,
      api,
      windowRef: h.windowRef || (typeof window !== "undefined" ? window : null),
      activeTuneMeta: call(h.getActiveTuneMeta),
      currentDoc: call(h.getCurrentDoc),
      safeBasename: h.safeBasename,
      debugLogBuffer: call(h.getDebugLogBuffer) || [],
      recentActions: call(h.getRecentActions) || [],
      editorView: call(h.getEditorView),
      computeHeaderPresence: h.computeHeaderPresence,
      headerDirty: Boolean(call(h.getHeaderDirty)),
      headerCollapsed: Boolean(call(h.getHeaderCollapsed)),
      getEditorValue: h.getEditorValue,
      getHeaderEditorValue: h.getHeaderEditorValue,
      workingCopySnapshot: call(h.getWorkingCopySnapshot),
      getWorkingCopyMeta: () => api && typeof api.getWorkingCopyMeta === "function"
        ? api.getWorkingCopyMeta()
        : { ok: false, error: "unavailable" },
      getPlaybackPayload: h.getPlaybackPayload,
      lastPlaybackPayloadCache: call(h.getLastPlaybackPayloadCache),
      followPipelineVersion: call(h.getFollowPipelineVersion),
      isPlaying: Boolean(call(h.getIsPlaying)),
      isPaused: Boolean(call(h.getIsPaused)),
      waitingForFirstNote: Boolean(call(h.getWaitingForFirstNote)),
      followPlayback: Boolean(call(h.getFollowPlayback)),
      followVoiceId: call(h.getFollowVoiceId),
      followVoiceIndex: call(h.getFollowVoiceIndex),
      playbackState: call(h.getPlaybackState),
      practiceTempoMultiplier: call(h.getPracticeTempoMultiplier),
      playbackLoopEnabled: Boolean(call(h.getPlaybackLoopEnabled)),
      playbackLoopFromMeasure: call(h.getPlaybackLoopFromMeasure),
      playbackLoopToMeasure: call(h.getPlaybackLoopToMeasure),
      clampInt: h.clampInt,
      soundfontName: call(h.getSoundfontName),
      soundfontSource: call(h.getSoundfontSource),
      soundfontReadyName: call(h.getSoundfontReadyName),
      lastSoundfontApplied: call(h.getLastSoundfontApplied),
      playbackIndexOffset: call(h.getPlaybackIndexOffset),
      playbackRange: call(h.getPlaybackRange),
      activePlaybackRange: call(h.getActivePlaybackRange),
      activePlaybackEndAbcOffset: call(h.getActivePlaybackEndAbcOffset),
      lastStartPlaybackIdx: call(h.getLastStartPlaybackIdx),
      resumeStartIdx: call(h.getResumeStartIdx),
      desiredPlayerSpeed: call(h.getDesiredPlayerSpeed),
      currentPlaybackPlan: call(h.getCurrentPlaybackPlan),
      pendingPlaybackPlan: call(h.getPendingPlaybackPlan),
      lastPlaybackGuardMessage: call(h.getLastPlaybackGuardMessage),
      lastPlaybackAbortMessage: call(h.getLastPlaybackAbortMessage),
      lastPlaybackException: call(h.getLastPlaybackException),
      clonePlaybackRange: h.clonePlaybackRange,
      playbackNoteTrace: call(h.getPlaybackNoteTrace) || [],
      playbackParseErrors: call(h.getPlaybackParseErrors) || [],
      playbackSanitizeWarnings: call(h.getPlaybackSanitizeWarnings) || [],
      lastRhythmErrorSuggestion: call(h.getLastRhythmErrorSuggestion),
      lastRenderPayload: call(h.getLastRenderPayload),
      barMismatchMarkers: call(h.getBarMismatchMarkers) || [],
      errorEntries: call(h.getErrorEntries) || [],
      activeErrorHighlight: call(h.getActiveErrorHighlight),
    });
  }

  function getSuggestedDir() {
    const override = String(call(h.getAutoDumpDirOverride) || "");
    if (override) return override;
    try {
      const win = h.windowRef || (typeof window !== "undefined" ? window : null);
      const href = String(win && win.location && win.location.href ? win.location.href : "");
      if (href.startsWith("file://") && api && typeof api.pathDirname === "function" && typeof api.pathJoin === "function") {
        const p = decodeURIComponent(new URL(href).pathname || "");
        if (p.includes("/src/renderer/")) {
          const rendererDir = api.pathDirname(p);
          const srcDir = api.pathDirname(rendererDir);
          const rootDir = api.pathDirname(srcDir);
          return api.pathJoin(rootDir, "kitchen", "debug_dumps");
        }
      }
    } catch {}
    const activeTuneMeta = call(h.getActiveTuneMeta);
    return activeTuneMeta && activeTuneMeta.path ? call(h.safeDirname, activeTuneMeta.path) : "";
  }

  async function writeSnapshotToPath(filePath, { silent = false, reason = "" } = {}) {
    if (!filePath) return { ok: false, error: "No file path." };
    const snapshot = await buildSnapshot({ reason });
    const json = safeJsonStringify(snapshot);
    const res = await call(h.writeFile, filePath, json);
    if (!res || !res.ok) {
      if (!silent) {
        await call(h.showSaveError, (res && res.error) ? res.error : "Unable to write debug dump.");
      }
      return { ok: false, error: (res && res.error) ? res.error : "Unable to write debug dump." };
    }
    if (!silent) call(h.showToast, `Saved debug dump: ${call(h.safeBasename, filePath)}`, 3000);
    return { ok: true, path: filePath };
  }

  async function dumpToFile(filePathArg) {
    try {
      const suggested = `abcarus-debug-${nowCompactStamp()}.json`;
      let suggestedDir = getSuggestedDir();
      if (suggestedDir) {
        const res = await call(h.mkdirp, suggestedDir);
        if (!res || !res.ok) {
          const activeTuneMeta = call(h.getActiveTuneMeta);
          suggestedDir = activeTuneMeta && activeTuneMeta.path ? call(h.safeDirname, activeTuneMeta.path) : "";
        }
      }
      const filePath = filePathArg || (await call(h.showSaveDialog, suggested, suggestedDir));
      if (!filePath) return { ok: false, cancelled: true };
      return await writeSnapshotToPath(filePath, { silent: false, reason: "manual" });
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      await call(h.showSaveError, msg);
      return { ok: false, error: msg };
    }
  }

  return {
    buildSnapshot,
    dumpToFile,
    getSuggestedDir,
    nowCompactStamp,
    safeString,
    writeSnapshotToPath,
  };
}

export { createDebugDumpFeature };
