import {
  buildRhythmErrorSuggestionSnapshot,
  suggestPlaybackRangeForRhythmErrorText,
} from "./errors_playback_range_model.js";

function createErrorsPlaybackRangeController({
  isEnabled,
  isPlaying,
  getEditorText,
  findMeasureRangeAt,
  setPlaybackRange,
  setSelectionAt,
  setSuppressSelectionSync,
  logError,
} = {}) {
  let lastSuggestion = null;

  function applyFromError(errItem) {
    try {
      if (typeof isEnabled === "function" && !isEnabled()) return;
      if (typeof isPlaying === "function" && isPlaying()) return;
      if (!errItem) return;
      const text = typeof getEditorText === "function" ? getEditorText() : "";
      if (!text) return;
      const suggested = suggestPlaybackRangeForRhythmErrorText(text, errItem, {
        findMeasureRangeAt,
        logError,
      });
      if (!suggested) return;
      lastSuggestion = buildRhythmErrorSuggestionSnapshot(errItem, suggested);
      if (typeof setPlaybackRange === "function") {
        setPlaybackRange({
          startOffset: suggested.startOffset,
          endOffset: suggested.endOffset,
          origin: "error",
          loop: true,
        });
      }
      if (typeof setSuppressSelectionSync === "function") setSuppressSelectionSync(true);
      if (typeof setSelectionAt === "function") setSelectionAt(suggested.startOffset);
    } catch (e) {
      if (typeof logError === "function") {
        logError("[abcarus] Failed to apply PlaybackRange from error:", (e && e.message) ? e.message : String(e));
      }
    } finally {
      if (typeof setSuppressSelectionSync === "function") setSuppressSelectionSync(false);
    }
  }

  return {
    applyFromError,
    getLastSuggestion: () => lastSuggestion,
  };
}

export {
  createErrorsPlaybackRangeController,
};
