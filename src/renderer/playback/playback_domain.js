import {
  buildPlaybackState,
  findPlaybackMeasureIndex,
  findPlaybackSymbolAtOrAfter,
  findPlaybackSymbolAtOrBefore,
  snapIstartToPlayable,
} from "./playback_state_model.js";

export function createPlaybackDomain({
  transport,
  selectionRuntime,
  getEditorLength = () => 0,
  getFocusModeEnabled = () => false,
  getPlaybackUiController = () => null,
  getFocusModeController = () => null,
  getSoundfontController = () => null,
} = {}) {
  const controllers = {
    abSelection: null,
    autoScroll: null,
    drumPreview: null,
    follow: null,
    payload: null,
    player: null,
    prepare: null,
    start: null,
    transport: null,
  };

  function attach(next = {}) {
    for (const key of Object.keys(controllers)) {
      if (next[key]) controllers[key] = next[key];
    }
  }

  function requireController(name) {
    const controller = controllers[name];
    if (!controller) throw new Error(`Playback controller is not attached: ${name}`);
    return controller;
  }

  function clampInt(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
  }

  function isFocusBoundedScope() {
    return Boolean(getFocusModeEnabled())
      && (
        clampInt(transport.playbackLoopFromMeasure, 0, 100000, 0) > 0
        || clampInt(transport.playbackLoopToMeasure, 0, 100000, 0) > 0
      );
  }

  function getScopedSettingsForOrigin(origin) {
    const settings = requireController("abSelection").getSelectionSettings();
    if (String(origin || "") !== "focus" || !isFocusBoundedScope()) return settings;
    return {
      ...settings,
      suppressRepeats: true,
    };
  }

  function withScopedOrigin(settings, origin) {
    return {
      ...(settings || {}),
      origin: String(origin || ""),
    };
  }

  function toDerivedOffset(editorOffset) {
    const raw = Number(editorOffset);
    if (!Number.isFinite(raw)) return null;
    return raw + (transport.playbackIndexOffset || 0);
  }

  function toEditorOffset(derivedOffset) {
    const raw = Number(derivedOffset);
    if (!Number.isFinite(raw)) return null;
    return Math.max(0, raw - (transport.playbackIndexOffset || 0));
  }

  function getUiController() {
    return getPlaybackUiController();
  }

  return {
    clearAbPlan: (options) => requireController("abSelection").clearPlan(options),
    clearPlans() {
      transport.pendingPlaybackPlan = null;
      transport.currentPlaybackPlan = null;
    },
    appendTrace: (event) => transport.appendTrace(event),
    applyPlanSpeed: (plan) => requireController("transport").applyPlaybackPlanSpeed(plan),
    attach,
    buildState: (firstSymbol) => buildPlaybackState(firstSymbol, {
      editorLength: getEditorLength(),
      playbackIndexOffset: transport.playbackIndexOffset,
    }),
    buildTransportPlan: () => requireController("transport").buildTransportPlaybackPlan(),
    cancelAutoScroll: () => requireController("autoScroll").cancelPlaybackAutoScroll(),
    clearNoteOnElements: () => requireController("follow").clearPlaybackNoteOnEls(),
    cloneRange: (range) => requireController("transport").clonePlaybackRange(range),
    ensurePlayer: () => requireController("player").ensurePlayer(),
    ensureSoundfontLoaded: () => {
      const controller = getSoundfontController();
      return controller ? controller.ensureLoaded() : Promise.resolve();
    },
    ensureSoundfontReady: () => {
      const controller = getSoundfontController();
      return controller ? controller.ensureReady() : Promise.resolve();
    },
    findMeasureIndex: (index) => findPlaybackMeasureIndex(transport.playbackState, index),
    findSymbolAtOrAfter: (index) => findPlaybackSymbolAtOrAfter(transport.playbackState, index),
    findSymbolAtOrBefore: (index) => findPlaybackSymbolAtOrBefore(transport.playbackState, index),
    getPayload: () => requireController("payload").getPlaybackPayload(),
    getActiveRange: () => transport.activePlaybackRange,
    getFollowVoiceId: () => requireController("follow").getFollowVoiceId(),
    getFollowVoiceIndex: () => requireController("follow").getFollowVoiceIndex(),
    getRange: () => transport.playbackRange,
    getScopedSettingsForOrigin,
    getSelectionSettings: () => requireController("abSelection").getSelectionSettings(),
    getSelectionRange: () => requireController("abSelection").getSelectionRange(),
    getSourceKey: () => requireController("payload").getPlaybackSourceKey(),
    highlightSourceAt: (index, on) => requireController("follow").highlightSourceAt(index, on),
    initAutoScrollListeners: () => (
      requireController("autoScroll").initPlaybackAutoScrollListeners()
    ),
    isBusy: () => {
      const controller = getUiController();
      return controller
        ? controller.isPlaybackBusy()
        : Boolean(transport.isPlaying || transport.isPaused || transport.waitingForFirstNote);
    },
    isActive: () => Boolean(transport.isPlaying || transport.isPaused),
    isAbPlanValid: () => requireController("abSelection").isPlanValid(),
    isPaused: () => Boolean(transport.isPaused),
    isPlaying: () => Boolean(transport.isPlaying),
    isTransportJumpHighlightActive: () => Boolean(transport.transportJumpHighlightActive),
    isWaitingForFirstNote: () => Boolean(transport.waitingForFirstNote),
    isFocusBoundedScope,
    maybeScrollEditorToOffset: (offset) => (
      requireController("follow").maybeScrollEditorToOffset(offset)
    ),
    maybeAutoScrollRenderToCursor: (element) => (
      requireController("autoScroll").maybeAutoScrollRenderToCursor(element)
    ),
    maybeScrollRenderToNote: (element) => (
      requireController("follow").maybeScrollRenderToNote(element)
    ),
    pause: () => requireController("start").pausePlayback(),
    playDrumPreview: (pitch, velocity) => (
      requireController("drumPreview").playDrumPreview(pitch, velocity)
    ),
    prepare: () => requireController("prepare").preparePlayback(),
    playAbLoop: () => requireController("abSelection").playAbLoop(),
    playSelectionOnce: () => requireController("abSelection").playSelectionOnce(),
    refreshAbOptionsUi: () => requireController("abSelection").refreshOptionsUi(),
    resetState: () => requireController("transport").resetPlaybackState(),
    resetPlayerForSoundfontChange() {
      if (transport.player && typeof transport.player.stop === "function") {
        transport.suppressOnEnd = true;
        transport.player.stop();
      }
      transport.player = null;
      transport.playbackState = null;
      transport.playbackIndexOffset = 0;
    },
    resetUiState: () => {
      requireController("autoScroll").resetManualPause();
      return requireController("follow").resetPlaybackUiState();
    },
    resolveEndSymbol: (range, startSymbol) => (
      requireController("start").resolvePlaybackEndSymbol(range, startSymbol)
    ),
    scheduleUiUpdate: (istart) => requireController("follow").schedulePlaybackUiUpdate(istart),
    setFollowVoiceFromPlayback: () => requireController("follow").setFollowVoiceFromPlayback(),
    setAbFromSelection: () => requireController("abSelection").setFromSelection(),
    setAbOptions: (options) => requireController("abSelection").setOptions(options),
    setAbPoint: (which) => requireController("abSelection").setPoint(which),
    setAbRange: (startOffset, endOffset) => (
      requireController("abSelection").setRange(startOffset, endOffset)
    ),
    setRange: (range) => requireController("transport").setPlaybackRange(range),
    setAutoScrollModeForDev: (mode) => requireController("autoScroll").setModeForDev(mode),
    setAutoScrollFromSettings: (settings) => (
      requireController("autoScroll").setFromSettings(settings)
    ),
    setTransportJumpHighlightActive(active) {
      transport.transportJumpHighlightActive = Boolean(active);
      transport.suppressTransportJumpClearOnce = Boolean(active);
    },
    setTransportPlayheadOffset(position) {
      transport.transportPlayheadOffset = position;
    },
    snapIstartToPlayable: (istart) => snapIstartToPlayable(transport.playbackState, istart),
    startAtIndex: (index) => requireController("start").startPlaybackAtIndex(index),
    startAtMeasureOffset: (delta) => (
      requireController("start").startPlaybackAtMeasureOffset(delta)
    ),
    startFromPrepared: (index) => requireController("start").startPlaybackFromPrepared(index),
    startFromRange: (range) => requireController("start").startPlaybackFromRange(range),
    stopForRestart: () => requireController("transport").stopPlaybackForRestart(),
    stopTransport: () => requireController("transport").stopPlaybackTransport(),
    suppressFollowScroll: () => requireController("follow").suppressFollowScroll(),
    syncPendingPlan: () => requireController("transport").syncPendingPlaybackPlan(),
    toDerivedOffset,
    toEditorOffset,
    togglePlayPauseEffective: () => (
      requireController("transport").togglePlayPauseEffective()
    ),
    transportPause: () => requireController("transport").transportPause(),
    transportPlay: () => requireController("transport").transportPlay(),
    transportStartOver: () => requireController("transport").transportStartOver(),
    transportTogglePlayPause: () => (
      requireController("transport").transportTogglePlayPause()
    ),
    toggleAbOptionsPopover: () => requireController("abSelection").toggleOptionsPopover(),
    updateAbUi: () => requireController("abSelection").updateUi(),
    updateInteractionLock: () => {
      const controller = getUiController();
      if (controller) controller.updatePlaybackInteractionLock();
    },
    updateRangeFromSelection: (selection, origin, activeHighlight) => (
      requireController("transport").updatePlaybackRangeFromSelection(
        selection,
        origin,
        activeHighlight,
      )
    ),
    updatePlayButton: () => {
      const controller = getUiController();
      if (controller) controller.updatePlayButton();
    },
    updateFollowToggle: () => {
      const controller = getUiController();
      if (controller) controller.updateFollowToggle();
    },
    updatePracticeUi: () => {
      const controller = getFocusModeController();
      if (controller) controller.updatePracticeUi();
    },
    withScopedOrigin,
    withTempFlags: (flags, action) => (
      requireController("abSelection").withTempPlaybackFlags(flags, action)
    ),
    selectionRuntime,
    transport,
  };
}
