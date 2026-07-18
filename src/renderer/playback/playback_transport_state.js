const PLAYBACK_TRACE_LIMIT = 2000;

function clonePlaybackRange(r) {
  if (!r || typeof r !== "object") {
    return { startOffset: 0, endOffset: null, origin: "cursor", loop: false, suppressRepeats: null };
  }
  return {
    startOffset: Number(r.startOffset) || 0,
    endOffset: (r.endOffset == null) ? null : Number(r.endOffset),
    origin: r.origin || "cursor",
    loop: Boolean(r.loop),
    suppressRepeats: (typeof r.suppressRepeats === "boolean") ? Boolean(r.suppressRepeats) : null,
  };
}

function createPlaybackTransportState() {
  const state = {
    playbackRange: {
      startOffset: 0,
      endOffset: null,
      origin: "cursor",
      loop: false,
    },
    activePlaybackRange: null,
    activePlaybackEndAbcOffset: null,
    activePlaybackEndSymbol: null,
    activeLoopRange: null,
    playbackStartArmed: false,
    playbackRunId: 0,
    lastTraceRunId: 0,
    lastTracePlaybackIdx: null,
    lastTraceTimestamp: null,
    playbackTraceSeq: 0,

    practiceTempoMultiplier: 1,
    playbackLoopEnabled: false,
    playbackLoopFromMeasure: 0,
    playbackLoopToMeasure: 0,
    playbackLoopTuneId: null,
    currentPlaybackPlan: null,
    pendingPlaybackPlan: null,
    playbackSkipGchordsOnce: false,
    playbackIgnoreRepeatsOnce: false,
    transportPlayheadOffset: 0,
    transportJumpHighlightActive: false,
    suppressTransportJumpClearOnce: false,

    player: null,
    playerConfig: null,
    isPlaying: false,
    isPaused: false,
    suppressOnEnd: false,
    desiredPlayerSpeed: 1,
    lastPlaybackIdx: null,
    lastRenderIdx: null,
    lastStartPlaybackIdx: 0,
    resumeStartIdx: null,
    pausedSelectionSignature: null,
    playbackState: null,
    playbackIndexOffset: 0,
    waitingForFirstNote: false,
    isPreviewing: false,

    lastPlaybackMeta: null,
    lastPlaybackPayloadCache: null,
    lastPreparedPlaybackKey: null,
    playbackNoteTrace: [],
    playbackParseErrors: [],
    playbackSanitizeWarnings: [],
    lastPlaybackTuneInfo: null,
    lastPlaybackOnIstart: null,
    lastPlaybackHasParts: false,
    lastPlaybackChordOnBarError: false,
    lastPlaybackMidiDrumVoiceCompatSeen: false,
    lastPlaybackMeterMismatchWarning: null,
    lastPlaybackRepeatShortBarWarning: null,
    lastPlaybackKeyOrderWarning: null,
    playbackStartToken: 0,
    lastPlaybackGuardMessage: "",
    lastPlaybackAbortMessage: "",
    lastPlaybackException: null,
    playbackNeedsReprepare: false,
  };

  state.cloneRange = clonePlaybackRange;

  state.setRange = (next) => {
    state.playbackRange = clonePlaybackRange(next);
    return state.playbackRange;
  };

  state.appendTrace = (evt) => {
    if (!evt) return;
    state.playbackNoteTrace.push(evt);
    if (state.playbackNoteTrace.length > PLAYBACK_TRACE_LIMIT) {
      state.playbackNoteTrace = state.playbackNoteTrace.slice(state.playbackNoteTrace.length - PLAYBACK_TRACE_LIMIT);
    }
  };

  state.clearTrace = () => {
    state.playbackNoteTrace = [];
  };

  state.getTrace = () => state.playbackNoteTrace.slice();

  state.bumpStartToken = () => {
    state.playbackStartToken += 1;
    return state.playbackStartToken;
  };

  state.stopPlayer = ({ onlyWhenActive = false } = {}) => {
    if (!state.player || typeof state.player.stop !== "function") return false;
    if (onlyWhenActive && !state.isPlaying && !state.isPaused && !state.waitingForFirstNote) return false;
    state.suppressOnEnd = true;
    try { state.player.stop(); } catch {}
    return true;
  };

  state.clearActiveScope = ({ clearLoop = true, clearPendingPlan = true, clearCurrentPlan = true } = {}) => {
    state.resumeStartIdx = null;
    state.activePlaybackRange = null;
    state.activePlaybackEndAbcOffset = null;
    state.activePlaybackEndSymbol = null;
    if (clearLoop) state.activeLoopRange = null;
    state.playbackStartArmed = false;
    if (clearCurrentPlan) state.currentPlaybackPlan = null;
    if (clearPendingPlan) state.pendingPlaybackPlan = null;
  };

  state.markIdle = ({ needsReprepare = false, clearPreview = false } = {}) => {
    state.isPlaying = false;
    state.isPaused = false;
    state.waitingForFirstNote = false;
    if (clearPreview) state.isPreviewing = false;
    if (needsReprepare) state.playbackNeedsReprepare = true;
  };

  state.resetAfterGuardStop = (message) => {
    state.lastPlaybackGuardMessage = String(message || "");
    state.bumpStartToken();
    const wasSelectionOrigin = state.activePlaybackRange && state.activePlaybackRange.origin === "selection";
    state.stopPlayer({ onlyWhenActive: true });
    state.markIdle();
    state.clearActiveScope();
    return { wasSelectionOrigin };
  };

  state.resetForDocumentPlaybackChange = () => {
    state.bumpStartToken();
    state.stopPlayer();
    state.suppressOnEnd = false;
    state.markIdle({ needsReprepare: true, clearPreview: true });
    state.lastPlaybackIdx = null;
    state.lastRenderIdx = null;
    state.lastStartPlaybackIdx = 0;
    state.pausedSelectionSignature = null;
    state.playbackState = null;
    state.playbackIndexOffset = 0;
    state.lastPlaybackException = null;
    state.clearActiveScope();
  };

  state.resetAfterExplicitStop = ({ transportPlayheadOffset = 0 } = {}) => {
    state.bumpStartToken();
    const wasSelectionOrigin = state.activePlaybackRange && state.activePlaybackRange.origin === "selection";
    state.stopPlayer({ onlyWhenActive: true });
    state.markIdle({ needsReprepare: true });
    state.transportPlayheadOffset = Math.max(0, Number(transportPlayheadOffset) || 0);
    state.transportJumpHighlightActive = false;
    state.suppressTransportJumpClearOnce = false;
    state.pausedSelectionSignature = null;
    state.clearActiveScope({ clearLoop: false, clearPendingPlan: false });
    return { wasSelectionOrigin };
  };

  state.consumePlaybackEnd = () => {
    if (state.suppressOnEnd) return { ignored: true, reason: "suppressed" };
    if (state.isPreviewing) {
      state.isPreviewing = false;
      return { ignored: true, reason: "preview" };
    }
    const wasSelectionOrigin = state.activePlaybackRange && state.activePlaybackRange.origin === "selection";
    const shouldLoop = Boolean(state.activePlaybackRange && state.activePlaybackRange.loop);
    const loopRange = shouldLoop ? (state.activeLoopRange || state.activePlaybackRange) : null;
    state.markIdle();
    if (!shouldLoop) {
      state.clearActiveScope();
    }
    return {
      ignored: false,
      wasSelectionOrigin,
      shouldLoop,
      loopRange,
    };
  };

  return state;
}

export {
  clonePlaybackRange,
  createPlaybackTransportState,
};
