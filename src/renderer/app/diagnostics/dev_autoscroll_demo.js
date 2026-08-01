function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTune(text, xNumber) {
  if (!Number.isFinite(xNumber)) return text;
  const re = /^\s*X:\s*(\d+)\s*$/gm;
  let match = null;
  const starts = [];
  while ((match = re.exec(text))) {
    starts.push({ idx: match.index, x: Number(match[1]) });
  }
  const start = starts.find((entry) => entry.x === xNumber);
  if (!start) return text;
  const next = starts.find((entry) => entry.idx > start.idx);
  const end = next ? next.idx : text.length;
  return String(text.slice(start.idx, end)).trimEnd() + "\n";
}

function createDevAutoscrollDemo({
  api = null,
  documentRef = typeof document !== "undefined" ? document : null,
  windowRef = typeof window !== "undefined" ? window : null,
  devConfig = {},
  readFile = async () => ({ ok: false }),
  setEditorTextClean = () => {},
  scheduleRender = () => {},
  getOutputElement = () => null,
  setRenderZoom = () => {},
  getRenderZoomFactor = () => 1,
  setFocusModeEnabled = () => {},
  setAutoscrollModeForDev = () => "",
  togglePlayPause = async () => {},
  stopPlayback = () => {},
} = {}) {
  async function waitForSvg(timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const out = getOutputElement();
      const svg = out && typeof out.querySelector === "function" ? out.querySelector("svg") : null;
      if (svg) return true;
      await sleep(100);
    }
    return false;
  }

  async function run() {
    const cfg = devConfig || {};
    const filePath = String(cfg.ABCARUS_DEV_FILE || "").trim();
    if (!filePath) return false;

    const tuneX = Number(String(cfg.ABCARUS_DEV_TUNE_X || "").trim());
    const wantFocus = String(cfg.ABCARUS_DEV_FOCUS || "").trim() === "1";
    const wantPlay = String(cfg.ABCARUS_DEV_AUTOPLAY || "").trim() === "1";
    const wantDebug = String(cfg.ABCARUS_DEV_AUTOSCROLL_DEBUG || "").trim() === "1";
    const wantFocusDebug = String(cfg.ABCARUS_DEV_FOCUS_DEBUG || "").trim() === "1";
    const quitAfter = String(cfg.ABCARUS_DEV_QUIT || "").trim() === "1";
    const modeSpec = String(cfg.ABCARUS_DEV_AUTOSCROLL_MODE || "").trim();
    const forcedZoom = Number(String(cfg.ABCARUS_DEV_RENDER_ZOOM || "").trim());
    const mutateSettings = String(cfg.ABCARUS_DEV_MUTATE_SETTINGS || "").trim() === "1";

    if (wantDebug && windowRef) windowRef.__abcarusDebugAutoscroll = true;
    if (wantFocusDebug && windowRef) windowRef.__abcarusDebugFocus = true;

    let restoreSettingsPatch = null;
    const res = await readFile(filePath);
    if (!res || !res.ok) {
      console.error("[abcarus][dev] Unable to read dev file:", res && res.error ? res.error : filePath);
      return false;
    }

    setEditorTextClean(extractTune(String(res.data || ""), tuneX));
    scheduleRender();

    if (!(await waitForSvg())) {
      console.error("[abcarus][dev] SVG render did not appear in time.");
      return false;
    }

    if (Number.isFinite(forcedZoom) && forcedZoom > 0) {
      if (!wantFocus && mutateSettings && api && typeof api.getSettings === "function" && typeof api.updateSettings === "function") {
        try {
          const prev = await api.getSettings();
          const prevZoom = prev && Number(prev.renderZoom);
          if (Number.isFinite(prevZoom) && prevZoom > 0 && prevZoom !== forcedZoom) {
            restoreSettingsPatch = { renderZoom: prevZoom };
          }
          await api.updateSettings({ renderZoom: forcedZoom });
        } catch {}
      }
      setRenderZoom(forcedZoom);
      try {
        const cssZoom = documentRef && documentRef.documentElement
          ? getComputedStyle(documentRef.documentElement).getPropertyValue("--render-zoom")
          : "";
        const out = getOutputElement();
        const outZoom = out ? getComputedStyle(out).zoom : "";
        console.log(
          "[abcarus][dev] render zoom =",
          forcedZoom,
          "cssVar=",
          String(cssZoom || "").trim(),
          "outZoom=",
          String(outZoom || "").trim(),
          "getRenderZoomFactor=",
          getRenderZoomFactor()
        );
      } catch {
        console.log("[abcarus][dev] render zoom =", forcedZoom);
      }
      await sleep(250);
    }

    if (wantFocus) {
      setFocusModeEnabled(true);
      await sleep(250);
    }

    const setMode = (modeSpecValue) => {
      if (!modeSpecValue) return;
      const mode = setAutoscrollModeForDev(modeSpecValue);
      console.log("[abcarus][dev] autoscroll mode =", mode);
    };

    const runOnce = async (modeSpecValue) => {
      setMode(modeSpecValue);
      await sleep(120);
      if (!wantPlay) return;
      await togglePlayPause();
      await sleep(25000);
      stopPlayback();
      await sleep(900);
    };

    try {
      if (modeSpec.toLowerCase() === "cycle") {
        for (const mode of ["Keep Visible", "Page Turn", "Centered"]) {
          await runOnce(mode);
        }
      } else if (modeSpec) {
        await runOnce(modeSpec);
      } else {
        await runOnce(null);
      }
    } catch (e) {
      console.error("[abcarus][dev] Demo failed:", (e && e.stack) ? e.stack : String(e));
    } finally {
      if (restoreSettingsPatch && api && typeof api.updateSettings === "function") {
        try { await api.updateSettings(restoreSettingsPatch); } catch {}
      }
      if (quitAfter && api && typeof api.quitApplication === "function") {
        try { await api.quitApplication(); } catch {}
      }
    }
    return true;
  }

  return { run };
}

export {
  createDevAutoscrollDemo,
};
