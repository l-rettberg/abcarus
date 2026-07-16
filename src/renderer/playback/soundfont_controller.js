const DEFAULT_SOUNDFONT_NAME = "TimGM6mb.sf2";
const DEFAULT_SOUNDFONT_SOURCE = "abc2svg.sf2";
const STREAMING_SF2 = new Set();

function toFileUrl(windowRef, filePath) {
  const raw = String(filePath || "");
  if (!raw) return "";
  if (raw.startsWith("file://")) return raw;
  if (/^[a-zA-Z]:\\/.test(raw)) {
    return `file:///${raw.replace(/\\/g, "/")}`;
  }
  if (raw.startsWith("/")) return new URL(raw, windowRef.location.href).href;
  return raw;
}

function withTimeout(promise, ms, label) {
  const timeoutMs = Number(ms) > 0 ? Number(ms) : 0;
  if (!timeoutMs) return promise;
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`${label || "Operation"} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    Promise.resolve(promise).then((value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    }, (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

function createSoundfontController({
  windowRef = typeof window !== "undefined" ? window : null,
  api = null,
  elements = {},
  state = {},
  actions = {},
} = {}) {
  const { label = null } = elements;
  const {
    isPlaying = () => false,
    isPaused = () => false,
    isWaitingForFirstNote = () => false,
  } = state;
  const {
    ensurePlayer = () => null,
    setBufferStatus = () => {},
    setStatus = () => {},
  } = actions;

  let soundfontName = DEFAULT_SOUNDFONT_NAME;
  let soundfontSource = DEFAULT_SOUNDFONT_SOURCE;
  let soundfontReadyName = null;
  let soundfontLoadPromise = null;
  let soundfontLoadTarget = null;
  let soundfontStatusTimer = null;
  let lastSoundfontApplied = null;

  function setStatusText(text, autoClearMs) {
    setBufferStatus(text || "");
    if (soundfontStatusTimer) clearTimeout(soundfontStatusTimer);
    soundfontStatusTimer = null;
    if (text && autoClearMs) {
      soundfontStatusTimer = setTimeout(() => {
        setBufferStatus("");
        soundfontStatusTimer = null;
      }, autoClearMs);
    }
  }

  function setCaption(text) {
    if (!label) return;
    const next = text || "Soundfont:";
    label.textContent = next;
    const isLoading = String(next).toLowerCase().includes("loading");
    label.classList.toggle("loading", isLoading);
  }

  async function updateLoadingStatus(name) {
    if (soundfontLoadTarget !== name) return;
    setCaption("Loading...");
  }

  async function loadSoundfont(name) {
    const w = windowRef;
    if (!w) throw new Error("window is unavailable.");
    const isPath = name.startsWith("/") || /^[a-zA-Z]:\\/.test(name) || name.startsWith("file://");
    const sf2Url = isPath
      ? toFileUrl(w, name)
      : new URL(`../../third_party/sf2/${name}`, w.location.href).href;
    if (!w.abc2svg) w.abc2svg = {};
    if (isPath || STREAMING_SF2.has(name)) {
      w.abc2svg.sf2 = null;
      soundfontSource = sf2Url;
      soundfontReadyName = name;
      return;
    }
    if (!api || typeof api.readFileBase64 !== "function") {
      throw new Error("preload API missing: window.api.readFileBase64");
    }
    let b64 = "";
    try {
      b64 = await withTimeout(api.readFileBase64(sf2Url), 15000, "Soundfont load");
    } catch {
      w.abc2svg.sf2 = null;
      soundfontSource = sf2Url;
      soundfontReadyName = name;
      return;
    }
    if (!b64 || !b64.length) throw new Error("SF2 base64 is empty");
    w.abc2svg.sf2 = b64;
    soundfontSource = DEFAULT_SOUNDFONT_SOURCE;
    soundfontReadyName = name;
  }

  async function ensureLoaded() {
    const w = windowRef;
    if (!w) return;
    const desired = soundfontName || DEFAULT_SOUNDFONT_NAME;
    if (
      soundfontReadyName === desired
      && (soundfontSource !== DEFAULT_SOUNDFONT_SOURCE || (w.abc2svg && w.abc2svg.sf2))
    ) return;
    if (soundfontLoadPromise && soundfontLoadTarget === desired) return soundfontLoadPromise;

    if (!w.abc2svg) w.abc2svg = {};
    soundfontLoadTarget = desired;
    setCaption("Loading...");
    updateLoadingStatus(desired);
    soundfontLoadPromise = (async () => {
      let ok = false;
      try {
        await loadSoundfont(desired);
        ok = true;
      } catch (e) {
        if (desired === DEFAULT_SOUNDFONT_NAME) throw e;
        await loadSoundfont(DEFAULT_SOUNDFONT_NAME);
        ok = true;
      } finally {
        soundfontLoadPromise = null;
        soundfontLoadTarget = null;
        if (ok) setStatusText("", 0);
        if (!isWaitingForFirstNote()) setCaption();
        if (ok && !isPlaying() && !isPaused() && !isWaitingForFirstNote()) setStatus("OK");
      }
    })();
    return soundfontLoadPromise;
  }

  async function ensureReady() {
    await ensureLoaded();
    const desired = soundfontSource || DEFAULT_SOUNDFONT_SOURCE;
    const player = ensurePlayer();
    if (player && typeof player.set_sfu === "function" && desired !== lastSoundfontApplied) {
      player.set_sfu(desired);
      lastSoundfontApplied = desired;
    }
  }

  function setFromSettings(settings) {
    if (!settings || typeof settings !== "object") return;
    const next = String(settings.soundfontName || "");
    soundfontName = next || DEFAULT_SOUNDFONT_NAME;
  }

  function resetCache() {
    const w = windowRef;
    if (w && w.abc2svg) w.abc2svg.sf2 = null;
    if (w && w.abcsf2 && Array.isArray(w.abcsf2)) w.abcsf2.length = 0;
    soundfontSource = DEFAULT_SOUNDFONT_SOURCE;
    soundfontReadyName = null;
    soundfontLoadPromise = null;
    soundfontLoadTarget = null;
    lastSoundfontApplied = null;
  }

  return {
    ensureLoaded,
    ensureReady,
    resetCache,
    setCaption,
    setFromSettings,
    setStatus: setStatusText,
    getName: () => soundfontName,
    getSource: () => soundfontSource,
    getReadyName: () => soundfontReadyName,
    getLastApplied: () => lastSoundfontApplied,
  };
}

export {
  DEFAULT_SOUNDFONT_NAME,
  DEFAULT_SOUNDFONT_SOURCE,
  createSoundfontController,
};
