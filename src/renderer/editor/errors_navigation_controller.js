function createErrorsNavigationController({
  navigationState,
  isEnabled,
  isPlaybackBusy,
  getSortedItems,
  jumpToError,
  showToast,
} = {}) {
  async function activateByDelta(delta) {
    if (typeof isEnabled === "function" && !isEnabled()) return;
    if (typeof isPlaybackBusy === "function" && isPlaybackBusy()) {
      if (typeof showToast === "function") showToast("Stop playback to navigate errors");
      return;
    }
    const items = typeof getSortedItems === "function" ? getSortedItems() : [];
    if (!Array.isArray(items) || !items.length) {
      if (navigationState && typeof navigationState.shouldShowNoErrorsToast === "function" && navigationState.shouldShowNoErrorsToast()) {
        if (typeof showToast === "function") showToast("No errors");
      }
      return;
    }

    const nextIdx = navigationState && typeof navigationState.nextIndex === "function"
      ? navigationState.nextIndex(items, delta)
      : -1;
    const entry = Number.isFinite(nextIdx) && items[nextIdx] ? items[nextIdx].entry : null;
    if (entry && typeof jumpToError === "function") await jumpToError(entry);
  }

  return {
    activateByDelta,
  };
}

export {
  createErrorsNavigationController,
};
