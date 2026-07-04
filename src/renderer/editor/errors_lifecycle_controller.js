function createErrorsLifecycleController({
  toggleButton,
  prevButton,
  nextButton,
  scanButton,
  indicator,
  focusMessage,
  setButtonText,
  closePopover,
  clearActiveHighlight,
  cancelTuneScan,
  clearTuneScanFilter,
  setScanButtonActive,
  setScanButtonState,
  clearBarMismatchMarkers,
  clearErrors,
  updateFileContext,
  getPlaybackRange,
  setPlaybackRange,
  updateLibraryStatus,
  updateIndicatorAndPopover,
  clearFocusMessage,
  refreshErrorsNow,
  scheduleRenderNow,
  ensureDrumMismatchErrorVisible,
} = {}) {
  let enabled = false;

  function isEnabled() {
    return enabled;
  }

  function clearFeatureState() {
    if (typeof closePopover === "function") closePopover();
    if (typeof clearActiveHighlight === "function") clearActiveHighlight("docReplaced");
    if (typeof cancelTuneScan === "function") cancelTuneScan();
    if (typeof clearTuneScanFilter === "function") clearTuneScanFilter();
    if (typeof setScanButtonActive === "function") setScanButtonActive(false);
    if (typeof setScanButtonState === "function") setScanButtonState(false);
    if (typeof clearBarMismatchMarkers === "function") clearBarMismatchMarkers();
    if (typeof clearErrors === "function") clearErrors();
    if (typeof updateFileContext === "function") updateFileContext();
    try {
      const playbackRange = typeof getPlaybackRange === "function" ? getPlaybackRange() : null;
      if (typeof setPlaybackRange === "function") {
        setPlaybackRange({
          startOffset: playbackRange && Number.isFinite(playbackRange.startOffset) ? playbackRange.startOffset : 0,
          endOffset: playbackRange ? playbackRange.endOffset : null,
          origin: playbackRange && playbackRange.origin ? playbackRange.origin : "cursor",
          loop: false,
        });
      }
    } catch {}
    if (typeof updateLibraryStatus === "function") updateLibraryStatus();
    if (typeof updateIndicatorAndPopover === "function") updateIndicatorAndPopover();
  }

  function updateUi() {
    if (toggleButton) {
      toggleButton.classList.toggle("toggle-active", enabled);
      if (typeof setButtonText === "function") setButtonText(toggleButton, "Errors");
      toggleButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    if (prevButton) {
      prevButton.hidden = !enabled;
      prevButton.disabled = !enabled;
    }
    if (nextButton) {
      nextButton.hidden = !enabled;
      nextButton.disabled = !enabled;
    }
    if (scanButton) {
      scanButton.hidden = !enabled;
      scanButton.disabled = !enabled;
    }
    if (indicator && !enabled) {
      indicator.hidden = true;
      indicator.disabled = true;
    }
    if (focusMessage && !enabled && typeof clearFocusMessage === "function") {
      clearFocusMessage();
    }
  }

  function setEnabled(next, { triggerRefresh = false } = {}) {
    const nextEnabled = Boolean(next);
    if (nextEnabled === enabled) {
      updateUi();
      return;
    }
    enabled = nextEnabled;
    if (!enabled) {
      clearFeatureState();
    } else {
      if (triggerRefresh && typeof refreshErrorsNow === "function") refreshErrorsNow();
      else if (typeof scheduleRenderNow === "function") scheduleRenderNow();
      if (typeof ensureDrumMismatchErrorVisible === "function") ensureDrumMismatchErrorVisible();
    }
    updateUi();
  }

  return {
    clearFeatureState,
    isEnabled,
    setEnabled,
    updateUi,
  };
}

export {
  createErrorsLifecycleController,
};
