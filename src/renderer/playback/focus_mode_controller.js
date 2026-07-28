import {
  buildFocusBarIndexMap,
  buildFocusPlaybackPlan,
  getVisibleFocusRenderRangeFromElements,
} from "./focus_playback_model.js";

export function createFocusModeController({
  elements = {},
  transport,
  getSettings = () => null,
  getActiveTuneId = () => "",
  getLibraryVisible = () => false,
  isRawModeActive = () => false,
  isPlaybackBusy = () => false,
  isFocusBoundedPlaybackScope = () => false,
  getEditorView = () => null,
  getEditorText = () => "",
  getRenderMeasureIndex = () => null,
  getRenderCompatMap = () => null,
  mapRenderIdxToEditorOffset = (offset) => offset,
  getOutputElement = () => null,
  getRenderPane = () => null,
  getScopedPlaybackSettingsForOrigin = () => ({}),
  findMeasureStartOffsetByNumber = () => null,
  clampInt = (value, _min, _max, fallback) => fallback,
  readRenderZoom = () => null,
  setRenderZoom = () => {},
  computeFocusFitZoom = () => null,
  setLibraryVisible = () => {},
  resetRightPaneSplit = () => {},
  syncPendingPlaybackPlan = () => {},
  clearNormalPlaybackPlan = () => {},
  persistLoopSettingsPatch = async () => {},
  showToast = () => {},
  requestFrame = (fn) => {
    if (typeof requestAnimationFrame === "function") return requestAnimationFrame(fn);
    return setTimeout(fn, 0);
  },
} = {}) {
  const {
    focusButton = null,
    practiceTempoWrap = null,
    practiceTempo = null,
    practiceFocusRangeGroup = null,
    practiceFocusOptionsGroup = null,
    practiceFocusVoicesGroup = null,
    practiceSelectionGroup = null,
    practiceLoopWrap = null,
    practiceLoopEnabled = null,
    practiceLoopFrom = null,
    practiceLoopTo = null,
    selectionSuppressWrap = null,
    selectionSuppressEnabled = null,
    selectionGchordsWrap = null,
    selectionGchordsEnabled = null,
    selectionDrumsWrap = null,
    selectionDrumsEnabled = null,
    selectionMutedWrap = null,
    selectionMutedVoices = null,
    selectionLoopWrap = null,
    selectionLoopEnabled = null,
  } = elements;

  let enabled = false;
  let prevRenderZoom = null;
  let prevLibraryVisible = null;

  function isEnabled() {
    return enabled;
  }

  function updatePracticeUi() {
    const settings = getSettings() || null;
    if (practiceTempoWrap) practiceTempoWrap.hidden = !enabled;
    if (practiceFocusRangeGroup) practiceFocusRangeGroup.hidden = !enabled;
    if (practiceFocusOptionsGroup) practiceFocusOptionsGroup.hidden = !enabled;
    if (practiceFocusVoicesGroup) practiceFocusVoicesGroup.hidden = !enabled;
    if (practiceSelectionGroup) practiceSelectionGroup.hidden = Boolean(enabled);
    if (practiceTempo && enabled && document.activeElement !== practiceTempo) {
      const value = String(transport.practiceTempoMultiplier);
      if (practiceTempo.value !== value) practiceTempo.value = value;
    }

    if (practiceLoopWrap) practiceLoopWrap.hidden = !enabled;
    if (practiceLoopEnabled && document.activeElement !== practiceLoopEnabled) {
      practiceLoopEnabled.checked = Boolean(transport.playbackLoopEnabled);
    }
    if (practiceLoopFrom && document.activeElement !== practiceLoopFrom) {
      practiceLoopFrom.value = String(clampInt(transport.playbackLoopFromMeasure, 0, 100000, 0) || 0);
    }
    if (practiceLoopTo && document.activeElement !== practiceLoopTo) {
      practiceLoopTo.value = String(clampInt(transport.playbackLoopToMeasure, 0, 100000, 0) || 0);
    }

    if (selectionSuppressWrap) selectionSuppressWrap.hidden = !enabled;
    if (selectionSuppressEnabled && document.activeElement !== selectionSuppressEnabled) {
      const checked = isFocusBoundedPlaybackScope()
        || Boolean(!settings || settings.playbackSelectionSuppressRepeats !== false);
      selectionSuppressEnabled.checked = checked;
    }
    if (selectionGchordsWrap) selectionGchordsWrap.hidden = !enabled;
    if (selectionGchordsEnabled && document.activeElement !== selectionGchordsEnabled) {
      const checked = Boolean(!settings || settings.playbackSelectionMuteGchords !== true);
      selectionGchordsEnabled.checked = checked;
    }
    if (selectionDrumsWrap) selectionDrumsWrap.hidden = !enabled;
    if (selectionDrumsEnabled && document.activeElement !== selectionDrumsEnabled) {
      selectionDrumsEnabled.checked = Boolean(settings && settings.playbackSelectionAllowMidiDrums);
    }
    if (selectionMutedWrap) selectionMutedWrap.hidden = !enabled;
    if (selectionMutedVoices && document.activeElement !== selectionMutedVoices) {
      const raw = settings && settings.playbackSelectionMutedVoices != null
        ? String(settings.playbackSelectionMutedVoices)
        : "";
      if (selectionMutedVoices.value !== raw) selectionMutedVoices.value = raw;
    }

    if (selectionLoopWrap) selectionLoopWrap.hidden = Boolean(enabled);
    if (selectionLoopEnabled && document.activeElement !== selectionLoopEnabled) {
      selectionLoopEnabled.checked = Boolean(settings && settings.playbackSelectionLoopEnabled);
    }

    if (enabled && !isPlaybackBusy()) syncPendingPlaybackPlan();
  }

  function updateUi() {
    document.body.classList.toggle("focus-mode", enabled);
    if (focusButton) {
      focusButton.classList.toggle("toggle-active", enabled);
      focusButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    updatePracticeUi();
  }

  function setEnabled(nextEnabled) {
    const next = Boolean(nextEnabled);
    if (enabled === next) return;
    if (isRawModeActive() && next) {
      showToast("Exit Raw mode to use Focus.", 2200);
      return;
    }
    enabled = next;
    updateUi();

    if (enabled) {
      prevRenderZoom = readRenderZoom();
      prevLibraryVisible = getLibraryVisible();
      setRenderZoom(1);
      if (getLibraryVisible()) {
        setLibraryVisible(false, { persist: false });
        requestFrame(() => {
          try { resetRightPaneSplit(); } catch {}
        });
      }
      requestFrame(() => {
        requestFrame(() => {
          if (!enabled) return;
          const fit = computeFocusFitZoom();
          if (fit != null) setRenderZoom(fit);
          if (typeof window !== "undefined" && window.__abcarusDebugFocus) {
            try {
              const cssZoom = getComputedStyle(document.documentElement).getPropertyValue("--render-zoom");
              console.log("[abcarus][focus] apply " + JSON.stringify({
                fit,
                cssZoom: String(cssZoom || "").trim(),
              }));
            } catch {}
          }
        });
      });
    } else if (prevRenderZoom != null) {
      setRenderZoom(prevRenderZoom);
      prevRenderZoom = null;
      if (prevLibraryVisible) {
        setLibraryVisible(true, { persist: false });
        requestFrame(() => {
          try { resetRightPaneSplit(); } catch {}
        });
      }
      prevLibraryVisible = null;
    }

    if (enabled) {
      maybeResetLoopForTune(getActiveTuneId(), { updateUi: false });
    } else {
      clearNormalPlaybackPlan();
      syncPendingPlaybackPlan();
    }
  }

  function toggle() {
    setEnabled(!enabled);
  }

  function normalizeLoopBounds(fromMeasure, toMeasure) {
    const from = clampInt(fromMeasure, 0, 100000, 0);
    const to = clampInt(toMeasure, 0, 100000, 0);
    return { from, to };
  }

  function normalizeLoopBoundsForPlayback() {
    if (!enabled) return false;
    const from = clampInt(transport.playbackLoopFromMeasure, 0, 100000, 0);
    const to = clampInt(transport.playbackLoopToMeasure, 0, 100000, 0);
    if (!(from > 0 && to > 0 && from > to)) return false;
    transport.playbackLoopFromMeasure = to;
    transport.playbackLoopToMeasure = from;
    updatePracticeUi();
    syncPendingPlaybackPlan();
    const patch = {
      playbackLoopFromMeasure: transport.playbackLoopFromMeasure,
      playbackLoopToMeasure: transport.playbackLoopToMeasure,
    };
    const tuneId = getActiveTuneId();
    if (tuneId) {
      transport.playbackLoopTuneId = String(tuneId);
      patch.playbackLoopTuneId = transport.playbackLoopTuneId;
    }
    persistLoopSettingsPatch(patch).catch(() => {});
    return true;
  }

  function computePlaybackPlan() {
    const editorView = getEditorView();
    if (!editorView) return { ok: false, reason: "Cannot resolve visible scope in Focus mode." };
    const tuneText = String(getEditorText() || "");
    const measureIndex = getRenderMeasureIndex();
    const barMap = buildFocusBarIndexMap({
      measureIndex,
      editorDocLength: editorView.state.doc.length,
      getRenderCompatMap,
      mapRenderIdxToEditorOffset,
    });
    const firstMeasureOffset = findMeasureStartOffsetByNumber(tuneText, 1);
    const settings = getScopedPlaybackSettingsForOrigin("focus") || {};
    const outputElement = getOutputElement();
    const renderPane = getRenderPane();
    const visibleRange = enabled && outputElement && renderPane
      ? getVisibleFocusRenderRangeFromElements({
          barElements: outputElement.querySelectorAll(".bar-hl"),
          paneRect: renderPane.getBoundingClientRect(),
        })
      : null;
    return buildFocusPlaybackPlan({
      parsedTune: {
        text: tuneText,
        barMap,
        byNumber: measureIndex && measureIndex.byNumber ? measureIndex.byNumber : null,
        firstMeasureOffset: Number.isFinite(firstMeasureOffset) ? Number(firstMeasureOffset) : null,
      },
      focusState: {
        fromMeasure: Number(transport.playbackLoopFromMeasure),
        toMeasure: Number(transport.playbackLoopToMeasure),
        loop: Boolean(transport.playbackLoopEnabled),
        suppressRepeats: Boolean(settings.suppressRepeats),
        mutedVoices: Array.isArray(settings.mutedVoices) ? settings.mutedVoices.slice() : [],
        muteGchords: Boolean(settings.muteGchords),
        allowMidiDrums: Boolean(settings.allowMidiDrums),
      },
      visibleRange,
      getMeasureStartOffsetByNumber: findMeasureStartOffsetByNumber,
    });
  }

  function maybeResetLoopForTune(tuneId, { updateUi: shouldUpdateUi = true } = {}) {
    if (!enabled) return;
    const id = tuneId != null ? String(tuneId) : "";
    if (!id) return;
    const savedId = transport.playbackLoopTuneId != null ? String(transport.playbackLoopTuneId) : "";
    if (savedId && savedId === id) return;

    const normalized = normalizeLoopBounds(0, 0);
    transport.playbackLoopFromMeasure = normalized.from;
    transport.playbackLoopToMeasure = normalized.to;
    syncPendingPlaybackPlan();
    if (shouldUpdateUi) updatePracticeUi();
  }

  function setLoopFromSettings(settings) {
    if (!settings || typeof settings !== "object") return;
    transport.playbackLoopEnabled = Boolean(settings.playbackLoopEnabled);
    transport.playbackLoopFromMeasure = clampInt(settings.playbackLoopFromMeasure, 0, 100000, 0);
    transport.playbackLoopToMeasure = clampInt(settings.playbackLoopToMeasure, 0, 100000, 0);
    transport.playbackLoopTuneId = (typeof settings.playbackLoopTuneId === "string") ? settings.playbackLoopTuneId : null;
    updatePracticeUi();
  }

  function persistCurrentLoopBounds() {
    const patch = {
      playbackLoopFromMeasure: transport.playbackLoopFromMeasure,
      playbackLoopToMeasure: transport.playbackLoopToMeasure,
    };
    const tuneId = getActiveTuneId();
    if (tuneId) {
      transport.playbackLoopTuneId = String(tuneId);
      patch.playbackLoopTuneId = transport.playbackLoopTuneId;
    }
    persistLoopSettingsPatch(patch).catch(() => {});
  }

  function wireControls() {
    if (practiceLoopEnabled) {
      practiceLoopEnabled.addEventListener("change", () => {
        const next = Boolean(practiceLoopEnabled.checked);
        transport.playbackLoopEnabled = next;
        syncPendingPlaybackPlan();
        updatePracticeUi();
        persistLoopSettingsPatch({ playbackLoopEnabled: next }).catch(() => {});
      });
    }

    if (practiceLoopFrom) {
      practiceLoopFrom.addEventListener("input", () => {
        transport.playbackLoopFromMeasure = clampInt(practiceLoopFrom.value, 0, 100000, 0);
        syncPendingPlaybackPlan();
        updatePracticeUi();
      });
      practiceLoopFrom.addEventListener("change", () => {
        transport.playbackLoopFromMeasure = clampInt(practiceLoopFrom.value, 0, 100000, 0);
        syncPendingPlaybackPlan();
        updatePracticeUi();
        persistCurrentLoopBounds();
      });
    }

    if (practiceLoopTo) {
      practiceLoopTo.addEventListener("input", () => {
        transport.playbackLoopToMeasure = clampInt(practiceLoopTo.value, 0, 100000, 0);
        syncPendingPlaybackPlan();
        updatePracticeUi();
      });
      practiceLoopTo.addEventListener("change", () => {
        transport.playbackLoopToMeasure = clampInt(practiceLoopTo.value, 0, 100000, 0);
        syncPendingPlaybackPlan();
        updatePracticeUi();
        persistCurrentLoopBounds();
      });
    }

    if (focusButton) {
      focusButton.addEventListener("click", () => {
        toggle();
      });
    }

    const persistBooleanSetting = (element, key, invert = false) => {
      if (!element) return;
      element.addEventListener("change", () => {
        const value = invert ? !element.checked : Boolean(element.checked);
        persistLoopSettingsPatch({ [key]: value }).catch(() => {});
      });
    };
    persistBooleanSetting(selectionLoopEnabled, "playbackSelectionLoopEnabled");
    persistBooleanSetting(selectionSuppressEnabled, "playbackSelectionSuppressRepeats");
    persistBooleanSetting(selectionGchordsEnabled, "playbackSelectionMuteGchords", true);
    persistBooleanSetting(selectionDrumsEnabled, "playbackSelectionAllowMidiDrums");

    if (selectionMutedVoices) {
      const persistMutedVoices = () => {
        const normalized = String(selectionMutedVoices.value || "")
          .split(/[,\s]+/)
          .map((value) => value.trim())
          .filter(Boolean)
          .join(",");
        persistLoopSettingsPatch({ playbackSelectionMutedVoices: normalized }).catch(() => {});
      };
      selectionMutedVoices.addEventListener("change", persistMutedVoices);
      selectionMutedVoices.addEventListener("blur", persistMutedVoices);
    }

    if (practiceTempo) {
      practiceTempo.addEventListener("change", () => {
        const next = Number(practiceTempo.value);
        if (!Number.isFinite(next)) return;
        transport.practiceTempoMultiplier = next;
        syncPendingPlaybackPlan();
        if (
          enabled
          && isPlaybackBusy()
          && transport.player
          && typeof transport.player.set_speed === "function"
        ) {
          transport.desiredPlayerSpeed = next;
          try { transport.player.set_speed(transport.desiredPlayerSpeed); } catch {}
        }
        updatePracticeUi();
      });
      const initial = Number(practiceTempo.value);
      if (Number.isFinite(initial)) transport.practiceTempoMultiplier = initial;
    }
  }

  return {
    computePlaybackPlan,
    isEnabled,
    maybeResetLoopForTune,
    normalizeLoopBounds,
    normalizeLoopBoundsForPlayback,
    setEnabled,
    setLoopFromSettings,
    toggle,
    updatePracticeUi,
    updateUi,
    wireControls,
  };
}
