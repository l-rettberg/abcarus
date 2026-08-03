function clampDocOffset(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(Math.max(0, Number(max) || 0), n));
}

function cloneMutedVoiceMap(map) {
  if (!map || typeof map !== "object") return null;
  const out = {};
  Object.keys(map).forEach((key) => {
    if (map[key]) out[String(key)] = true;
  });
  return Object.keys(out).length ? out : null;
}

function mutedVoiceIdsToMap(ids) {
  if (!Array.isArray(ids) || !ids.length) return null;
  const out = {};
  ids.forEach((id) => {
    const key = String(id || "").trim();
    if (key) out[key] = true;
  });
  return Object.keys(out).length ? out : null;
}

function cloneScopedOptions(options) {
  if (!options || typeof options !== "object") return null;
  return {
    ...options,
    mutedVoices: Array.isArray(options.mutedVoices) ? options.mutedVoices.slice() : options.mutedVoices,
  };
}

export function createSelectionPlaybackRuntime() {
  let selectionCursor = null;
  let selectionRange = null; // {anchor, head}
  let selectionActive = false;
  let abMutedVoices = null;
  let scopedOptions = null;
  let skipDrumsOnce = false;
  let selectionMode = false;

  return {
    captureSelection(selection) {
      if (!selection) return;
      const anchor = Number(selection.anchor);
      const head = Number(selection.head);
      if (!Number.isFinite(anchor) || !Number.isFinite(head)) return;
      selectionCursor = Math.min(anchor, head);
      selectionRange = { anchor, head };
      selectionActive = true;
    },

    restoreSelection(editorView) {
      if (!editorView || selectionCursor == null) return false;
      const len = editorView.state && editorView.state.doc ? editorView.state.doc.length : 0;
      const anchor = selectionRange ? clampDocOffset(selectionRange.anchor, len) : clampDocOffset(selectionCursor, len);
      const head = selectionRange ? clampDocOffset(selectionRange.head, len) : anchor;
      editorView.dispatch({ selection: { anchor, head }, scrollIntoView: false });
      return true;
    },

    shouldRestoreSelection() {
      return selectionActive && selectionCursor != null;
    },

    clearSelectionCapture() {
      selectionCursor = null;
      selectionRange = null;
      selectionActive = false;
    },

    setAbMutedVoiceMap(map) {
      abMutedVoices = cloneMutedVoiceMap(map);
    },

    setAbMutedVoiceIds(ids) {
      abMutedVoices = mutedVoiceIdsToMap(ids);
    },

    clearAbMutedVoices() {
      abMutedVoices = null;
    },

    getAbMutedVoiceMap() {
      return cloneMutedVoiceMap(abMutedVoices);
    },

    getAbMutedVoiceIds() {
      const map = cloneMutedVoiceMap(abMutedVoices);
      return map ? Object.keys(map).filter((key) => map[key]) : [];
    },

    setScopedOptions(options) {
      scopedOptions = cloneScopedOptions(options);
    },

    getScopedOptions() {
      return cloneScopedOptions(scopedOptions);
    },

    clearScopedOptions() {
      scopedOptions = null;
    },

    setSelectionMode(value) {
      selectionMode = Boolean(value);
    },

    isSelectionMode() {
      return selectionMode === true;
    },

    getSkipDrumsOnce() {
      return skipDrumsOnce === true;
    },

    setSkipDrumsOnce(value) {
      skipDrumsOnce = Boolean(value);
    },

    runWithTempFlags(flags, fn, globalObject = globalThis) {
      const prevStrip = globalObject.__abcarusPlaybackStripChordSymbols;
      const prevExpand = globalObject.__abcarusPlaybackExpandRepeats;
      const prevSkipDrums = skipDrumsOnce;
      if (flags && flags.stripChords !== undefined) {
        globalObject.__abcarusPlaybackStripChordSymbols = !!flags.stripChords;
      }
      if (flags && flags.expandRepeats !== undefined) {
        globalObject.__abcarusPlaybackExpandRepeats = !!flags.expandRepeats;
      }
      if (flags && flags.skipDrums !== undefined) skipDrumsOnce = !!flags.skipDrums;
      const restore = () => {
        globalObject.__abcarusPlaybackStripChordSymbols = prevStrip;
        globalObject.__abcarusPlaybackExpandRepeats = prevExpand;
        skipDrumsOnce = prevSkipDrums;
      };
      const result = fn();
      if (result && typeof result.then === "function") return result.finally(restore);
      restore();
      return result;
    },
  };
}
