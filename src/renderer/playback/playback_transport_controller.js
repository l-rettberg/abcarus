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

  function syncPendingPlaybackPlan() {
    transport.pendingPlaybackPlan = buildTransportPlaybackPlan();
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
    const resumeOffset = transport.playbackRange ? Math.max(0, Number(transport.playbackRange.startOffset) || 0) : 0;
    let startOffset = focusModeEnabled
      ? (shouldResumeFromPause() ? resumeOffset : getEditorPlayStartOffset())
      : getEditorMeasureStartOffset();
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
    resetPlaybackState,
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
