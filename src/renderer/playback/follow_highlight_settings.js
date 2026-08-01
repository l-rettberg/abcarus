function normalizeHexColor(value, fallback) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return fallback;
}

function createFollowHighlightSettings({
  documentRef = typeof document !== "undefined" ? document : null,
  clampNumber = (value, _min, _max, fallback) => {
    const v = Number(value);
    return Number.isFinite(v) ? v : fallback;
  },
} = {}) {
  const state = {
    color: "#1e90ff",
    measureColor: "",
    barOpacity: 0.12,
    measureOpacity: 0.08,
    playheadOpacity: 0.7,
    playheadWidth: 2,
    playheadPad: 8,
    playheadBetweenNotesWeight: 1,
    playheadShift: 0,
    playheadFirstBias: 6,
  };

  function applyCssVars() {
    const root = documentRef && documentRef.documentElement ? documentRef.documentElement : null;
    if (!root || !root.style) return;
    root.style.setProperty("--abcarus-follow-color", state.color);
    root.style.setProperty("--abcarus-follow-bar-opacity", String(state.barOpacity));
    root.style.setProperty("--abcarus-follow-measure-opacity", String(state.measureOpacity));
    root.style.setProperty("--abcarus-follow-playhead-opacity", String(state.playheadOpacity));
    if (state.measureColor) {
      root.style.setProperty("--abcarus-follow-measure-color", state.measureColor);
    } else {
      root.style.removeProperty("--abcarus-follow-measure-color");
    }
  }

  function setFromSettings(settings) {
    if (!settings || typeof settings !== "object") return;
    state.color = normalizeHexColor(settings.followHighlightColor, state.color);
    const measureColorRaw = String(settings.followMeasureColor || "").trim();
    if (!measureColorRaw) {
      state.measureColor = "";
    } else {
      state.measureColor = normalizeHexColor(measureColorRaw, state.measureColor || state.color);
    }
    state.barOpacity = clampNumber(settings.followHighlightBarOpacity, 0, 1, state.barOpacity);
    state.measureOpacity = clampNumber(settings.followMeasureOpacity, 0, 1, state.measureOpacity);
    state.playheadOpacity = clampNumber(settings.followPlayheadOpacity, 0, 1, state.playheadOpacity);
    state.playheadWidth = clampNumber(settings.followPlayheadWidth, 1, 6, state.playheadWidth);
    state.playheadPad = clampNumber(settings.followPlayheadPad, 0, 24, state.playheadPad);
    state.playheadBetweenNotesWeight = clampNumber(settings.followPlayheadBetweenNotesWeight, 0, 1, state.playheadBetweenNotesWeight);
    state.playheadShift = clampNumber(settings.followPlayheadShift, -20, 20, state.playheadShift);
    state.playheadFirstBias = clampNumber(settings.followPlayheadFirstBias, 0, 20, state.playheadFirstBias);
    applyCssVars();
  }

  return {
    getPlayheadPad: () => state.playheadPad,
    getPlayheadWidth: () => state.playheadWidth,
    getPlayheadShift: () => state.playheadShift,
    setFromSettings,
  };
}

export {
  createFollowHighlightSettings,
};
