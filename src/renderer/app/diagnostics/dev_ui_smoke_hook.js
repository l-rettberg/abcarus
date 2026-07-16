function installDevUiSmokeHook({
  windowRef = typeof window !== "undefined" ? window : null,
  devConfig = {},
  setEditorText = () => {},
  getEditorText = () => "",
  scheduleRender = () => {},
  getState = () => ({}),
  elements = {},
  getHasSvg = () => false,
  getPlaybackDebug = () => null,
  clickPlay = () => {},
  clickStop = () => {},
} = {}) {
  if (!windowRef || !devConfig || devConfig.ABCARUS_DEV_UI_SMOKE !== "1") return false;
  windowRef.__abcarusDevUiSmoke = {
    setText: (text) => {
      setEditorText(String(text || ""));
      scheduleRender();
    },
    getText: () => getEditorText(),
    scheduleRender,
    clickPlay,
    clickStop,
    snapshot: () => {
      const state = getState() || {};
      const playButton = elements.playButton || null;
      const stopButton = elements.stopButton || null;
      const status = elements.status || null;
      const toast = elements.toast || null;
      return {
        isPlaying: Boolean(state.isPlaying),
        isPaused: Boolean(state.isPaused),
        waitingForFirstNote: Boolean(state.waitingForFirstNote),
        playbackStartArmed: Boolean(state.playbackStartArmed),
        playText: playButton ? String(playButton.textContent || "").trim() : "",
        playActive: playButton ? playButton.classList.contains("active") : false,
        playDisabled: playButton ? Boolean(playButton.disabled) : true,
        stopDisabled: stopButton ? Boolean(stopButton.disabled) : true,
        status: status ? String(status.textContent || "").trim() : "",
        toast: toast ? String(toast.textContent || "").trim() : "",
        hasSvg: Boolean(getHasSvg()),
        playbackDebug: getPlaybackDebug(),
      };
    },
  };
  return true;
}

export {
  installDevUiSmokeHook,
};
