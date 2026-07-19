function createPlaybackTransportController({
  transport,
  selectionRuntime,
  getEditorView,
  getFocusModeEnabled,
  normalizeFocusLoopBoundsForPlayback,
  computeFocusPlaybackPlanFromCurrentState,
  getEditorMeasureStartOffset,
  getEditorPlayStartOffset,
  getEditorSelectionSignature,
  startPlaybackFromRange,
  startPlaybackAtIndex,
  pausePlayback,
  playSelectionOnce,
  setPracticeBarHighlight,
  clearSvgPracticeBarHighlight,
  playbackGuardError,
  stopPlaybackFromGuard,
  setStatus,
  updatePlayButton,
  clearNoteSelection,
  resetPlaybackUiState,
  setSoundfontCaption,
  showToast,
} = {}) {
  function buildTransportPlaybackPlan() {
    const focusModeEnabled = getFocusModeEnabled();
    const tempoMultiplier = focusModeEnabled
      ? (Number.isFinite(Number(transport.practiceTempoMultiplier)) ? Number(transport.practiceTempoMultiplier) : 1)
      : 1;
    if (focusModeEnabled) {
      const focusResult = computeFocusPlaybackPlanFromCurrentState();
      if (!focusResult || !focusResult.ok || !focusResult.plan) {
        return {
          mode: "focus",
          invalid: true,
          invalidReason: focusResult && focusResult.reason ? String(focusResult.reason) : "Cannot resolve Focus playback scope.",
          rangeStart: Math.max(0, Number(transport.transportPlayheadOffset) || 0),
          rangeEnd: null,
          loopEnabled: false,
          tempoMultiplier,
          focusPlan: null,
        };
      }
      return {
        mode: "focus",
        invalid: false,
        invalidReason: "",
        rangeStart: focusResult.plan.startOffset,
        rangeEnd: focusResult.plan.endOffset,
        loopEnabled: Boolean(focusResult.plan.loop),
        tempoMultiplier,
        focusPlan: focusResult.plan,
      };
    }
    return {
      mode: "transport",
      invalid: false,
      invalidReason: "",
      rangeStart: getEditorMeasureStartOffset(),
      rangeEnd: null,
      loopEnabled: false,
      tempoMultiplier,
    };
  }

  function shouldResumeFromPause() {
    if (!transport.isPaused) return false;
    if (getFocusModeEnabled()) return true;
    if (!transport.pausedSelectionSignature) return true;
    return getEditorSelectionSignature() === transport.pausedSelectionSignature;
  }

  function resolveFocusResumeStartOffset(plan, fallbackStartOffset, candidateResumeOffset) {
    const start = Math.max(0, Number(fallbackStartOffset) || 0);
    const end = Number(plan && plan.rangeEnd);
    const resume = Number(candidateResumeOffset);
    if (!Number.isFinite(resume) || resume < start) return start;
    if (Number.isFinite(end) && resume >= end) return start;
    return resume;
  }

  function getPausedResumeEditorOffset() {
    if (!shouldResumeFromPause()) return null;
    const derived = Number(transport.resumeStartIdx);
    if (Number.isFinite(derived)) {
      const editorOffset = Math.max(0, derived - (Number(transport.playbackIndexOffset) || 0));
      return Number.isFinite(editorOffset) ? editorOffset : null;
    }
    const rangeStart = transport.playbackRange ? Number(transport.playbackRange.startOffset) : NaN;
    return Number.isFinite(rangeStart) ? Math.max(0, rangeStart) : null;
  }

  function syncPendingPlaybackPlan() {
    transport.pendingPlaybackPlan = buildTransportPlaybackPlan();
  }

  function clonePlaybackRange(range) {
    return transport.cloneRange(range);
  }

  function setPlaybackRange(next) {
    const nextRange = clonePlaybackRange(next);

    if (transport.isPlaying) {
      if (transport.activePlaybackRange && transport.activePlaybackRange.loop && nextRange.startOffset !== transport.activePlaybackRange.startOffset) {
        stopPlaybackFromGuard("Looping PlaybackRange.startOffset mutated during playback.");
        return;
      }
      playbackGuardError("PlaybackRange updated while playing; change deferred until stop.");
      return;
    }

    transport.setRange(nextRange);
  }

  function stopPlaybackForRestart() {
    if (transport.player && typeof transport.player.stop === "function") {
      transport.suppressOnEnd = true;
      try { transport.player.stop(); } catch {}
    }
    clearNoteSelection();
    resetPlaybackUiState();
  }

  function applyPlaybackPlanSpeed(plan) {
    const next = Number(plan && plan.tempoMultiplier);
    transport.desiredPlayerSpeed = (Number.isFinite(next) && next > 0) ? next : 1;
    if (transport.player && typeof transport.player.set_speed === "function") {
      try { transport.player.set_speed(transport.desiredPlayerSpeed); } catch {}
    }
  }

  function getResumeStartOffset(plan) {
    const focusModeEnabled = getFocusModeEnabled();
    const pausedResumeOffset = getPausedResumeEditorOffset();
    let startOffset = focusModeEnabled
      ? (Number.isFinite(pausedResumeOffset) ? pausedResumeOffset : getEditorPlayStartOffset())
      : (Number.isFinite(pausedResumeOffset) ? pausedResumeOffset : getEditorMeasureStartOffset());
    if (focusModeEnabled) {
      startOffset = resolveFocusResumeStartOffset(plan, plan.rangeStart, startOffset);
    }
    return startOffset;
  }

  async function togglePlayPauseEffective() {
    const focusModeEnabled = getFocusModeEnabled();
    if (focusModeEnabled) {
      if (transport.isPlaying) {
        pausePlayback();
        return;
      }
      await transportPlay();
      return;
    }

    if (transport.isPlaying) {
      pausePlayback();
      return;
    }

    if (transport.isPaused) {
      normalizeFocusLoopBoundsForPlayback();
      const plan = buildTransportPlaybackPlan();
      if (plan && plan.invalid) {
        showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
        return;
      }
      applyPlaybackPlanSpeed(plan);
      await startPlaybackFromRange({
        startOffset: getResumeStartOffset(plan),
        endOffset: plan.rangeEnd,
        origin: focusModeEnabled ? "focus" : "transport",
        loop: plan.loopEnabled,
      });
      return;
    }

    if (await playSelectionOnce()) return;

    const plan = transport.pendingPlaybackPlan || buildTransportPlaybackPlan();
    if (plan && plan.invalid) {
      transport.pendingPlaybackPlan = null;
      showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
      return;
    }
    transport.pendingPlaybackPlan = null;
    transport.currentPlaybackPlan = plan;
    applyPlaybackPlanSpeed(plan);
    await startPlaybackFromRange({
      startOffset: plan.rangeStart,
      endOffset: plan.rangeEnd,
      origin: focusModeEnabled ? "focus" : "transport",
      loop: plan.loopEnabled,
    });
  }

  async function transportStartOver() {
    const focusModeEnabled = getFocusModeEnabled();
    if (transport.isPlaying || transport.isPaused || transport.waitingForFirstNote || transport.playbackStartArmed) {
      stopPlaybackTransport();
    }
    if (focusModeEnabled) {
      normalizeFocusLoopBoundsForPlayback();
      const plan = buildTransportPlaybackPlan();
      if (plan && plan.invalid) {
        showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
        return;
      }
      applyPlaybackPlanSpeed(plan);
      await startPlaybackFromRange({
        startOffset: plan.rangeStart,
        endOffset: plan.rangeEnd,
        origin: "focus",
        loop: plan.loopEnabled,
      });
      return;
    }
    const editorView = getEditorView();
    if (editorView) {
      editorView.dispatch({ selection: { anchor: 0, head: 0 }, scrollIntoView: true });
    }
    await startPlaybackAtIndex(0);
  }

  async function transportTogglePlayPause() {
    const focusModeEnabled = getFocusModeEnabled();
    if (transport.isPlaying) {
      pausePlayback();
      return;
    }
    if (transport.isPaused) {
      const plan = buildTransportPlaybackPlan();
      if (plan && plan.invalid) {
        showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
        return;
      }
      await startPlaybackFromRange({
        startOffset: getResumeStartOffset(plan),
        endOffset: plan.rangeEnd,
        origin: focusModeEnabled ? "focus" : "transport",
        loop: plan.loopEnabled,
      });
      return;
    }
    const startOffset = getEditorMeasureStartOffset();
    await startPlaybackFromRange({ startOffset, endOffset: null, origin: "transport", loop: false });
  }

  async function transportPlay() {
    const focusModeEnabled = getFocusModeEnabled();
    if (transport.isPlaying) return;
    if (focusModeEnabled) normalizeFocusLoopBoundsForPlayback();
    if (transport.isPaused) {
      const plan = buildTransportPlaybackPlan();
      if (plan && plan.invalid) {
        showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
        return;
      }
      await startPlaybackFromRange({
        startOffset: getResumeStartOffset(plan),
        endOffset: plan.rangeEnd,
        origin: focusModeEnabled ? "focus" : "transport",
        loop: plan.loopEnabled,
      });
      return;
    }
    if (focusModeEnabled) {
      const plan = buildTransportPlaybackPlan();
      if (plan && plan.invalid) {
        showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
        return;
      }
      applyPlaybackPlanSpeed(plan);
      await startPlaybackFromRange({
        startOffset: plan.rangeStart,
        endOffset: plan.rangeEnd,
        origin: "focus",
        loop: plan.loopEnabled,
      });
      return;
    }
    if (await playSelectionOnce()) return;
    const startOffset = getEditorMeasureStartOffset();
    await startPlaybackFromRange({ startOffset, endOffset: null, origin: "transport", loop: false });
  }

  async function transportPause() {
    const focusModeEnabled = getFocusModeEnabled();
    if (transport.isPlaying) {
      pausePlayback();
      return;
    }
    if (transport.isPaused) {
      normalizeFocusLoopBoundsForPlayback();
      const plan = buildTransportPlaybackPlan();
      if (plan && plan.invalid) {
        showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
        return;
      }
      await startPlaybackFromRange({
        startOffset: getResumeStartOffset(plan),
        endOffset: plan.rangeEnd,
        origin: focusModeEnabled ? "focus" : "transport",
        loop: plan.loopEnabled,
      });
    }
  }

  function resetPlaybackState() {
    transport.resetForDocumentPlaybackChange();
    clearNoteSelection();
    resetPlaybackUiState();
    if (selectionRuntime.shouldRestoreSelection()) selectionRuntime.restoreSelection(getEditorView());
    selectionRuntime.clearSelectionCapture();
    updatePlayButton();
    setSoundfontCaption();
  }

  function stopPlaybackTransport() {
    const editorView = getEditorView();
    if (!transport.isPlaying && !transport.isPaused && !transport.waitingForFirstNote && editorView) {
      const sel = editorView.state.selection.main;
      if (sel && sel.anchor !== sel.head) {
        const len = editorView.state.doc.length;
        const pos = Math.max(0, Math.min(len, Math.min(sel.anchor, sel.head)));
        editorView.dispatch({ selection: { anchor: pos, head: pos }, scrollIntoView: false });
        clearNoteSelection();
      }
    }

    let nextTransportStart = 0;
    if (getFocusModeEnabled()) {
      const focusResult = computeFocusPlaybackPlanFromCurrentState();
      if (focusResult && focusResult.ok && focusResult.plan && focusResult.plan.mode === "segment") {
        nextTransportStart = Math.max(0, Number(focusResult.plan.startOffset) || 0);
      }
    }
    const result = transport.resetAfterExplicitStop({ transportPlayheadOffset: nextTransportStart });
    setPracticeBarHighlight(null);
    clearSvgPracticeBarHighlight();
    setStatus("OK");
    updatePlayButton();
    clearNoteSelection();
    resetPlaybackUiState();
    setSoundfontCaption();

    if (result.wasSelectionOrigin) selectionRuntime.restoreSelection(editorView);
    selectionRuntime.clearSelectionCapture();

    if (!result.wasSelectionOrigin && editorView) {
      const sel = editorView.state.selection.main;
      if (sel && sel.anchor !== sel.head) {
        const len = editorView.state.doc.length;
        const pos = Math.max(0, Math.min(len, Math.min(sel.anchor, sel.head)));
        editorView.dispatch({ selection: { anchor: pos, head: pos }, scrollIntoView: false });
      }
    }
  }

  return {
    applyPlaybackPlanSpeed,
    buildTransportPlaybackPlan,
    clonePlaybackRange,
    resetPlaybackState,
    setPlaybackRange,
    stopPlaybackForRestart,
    stopPlaybackTransport,
    syncPendingPlaybackPlan,
    togglePlayPauseEffective,
    transportPause,
    transportPlay,
    transportStartOver,
    transportTogglePlayPause,
  };
}

export { createPlaybackTransportController };
