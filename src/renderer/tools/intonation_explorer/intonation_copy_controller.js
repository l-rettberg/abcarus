import {
  buildPitchSetText,
  buildSeyirSnapshotText,
} from "./intonation_model.js";

function createIntonationCopyController({
  copyDnaButton = null,
  copyPitchSetButton = null,
  menu = null,
  clipboard = null,
  getSource = () => null,
  formatPerdeName = () => "",
  showToast = () => {},
  logError = () => {},
} = {}) {
  let lastDnaText = "";
  let lastPitchSetText = "";

  function hideMenu() {
    try { if (menu) menu.classList.add("hidden"); } catch {}
  }

  function setReady({ dnaText, pitchSetText } = {}) {
    const source = getSource();
    const nextDna = String(dnaText || "");
    const nextPitch = String(pitchSetText || "");
    const enableDna = nextDna === "ready" ? Boolean(source) : Boolean(nextDna);
    const enablePitch = nextPitch === "ready" ? Boolean(source) : Boolean(nextPitch);
    if (nextDna !== "ready") lastDnaText = nextDna;
    if (nextPitch !== "ready") lastPitchSetText = nextPitch;
    if (copyDnaButton) copyDnaButton.disabled = !enableDna;
    if (copyPitchSetButton) copyPitchSetButton.disabled = !enablePitch;
  }

  async function copyText(text, successMessage) {
    if (!text) return;
    try {
      if (clipboard && typeof clipboard.writeText === "function") {
        await clipboard.writeText(text);
        try { showToast(successMessage, 1600); } catch {}
      }
    } catch (e) {
      logError(e && e.message ? e.message : String(e));
      try { showToast("Copy failed.", 1800); } catch {}
    }
  }

  async function handleCopyDna() {
    hideMenu();
    let text = "";
    try {
      const source = getSource();
      if (source) {
        text = buildSeyirSnapshotText({
          tuneText: source.tuneText,
          rows: source.rows,
          noteEvents: source.noteEvents,
          baseStep: source.baseStep,
          baseLabel: source.baseLabel,
          is53: source.is53,
          scopeLabel: source.scopeLabel,
          formatPerdeName,
        });
        try { window.__abcarusLastIntonationDnaText = text; } catch {}
        lastDnaText = text;
      } else {
        try { text = window.__abcarusLastIntonationDnaText ? String(window.__abcarusLastIntonationDnaText) : ""; } catch { text = ""; }
        if (!text) text = lastDnaText;
      }
    } catch {}
    await copyText(text, "Copied DNA.");
  }

  async function handleCopyPitchSet() {
    hideMenu();
    let text = "";
    try {
      const source = getSource();
      text = buildPitchSetText(source && Array.isArray(source.noteEvents) ? source.noteEvents : []);
      if (text) lastPitchSetText = text;
    } catch {}
    await copyText(text, "Copied pitchSet.");
  }

  if (copyDnaButton) {
    copyDnaButton.addEventListener("click", () => {
      handleCopyDna().catch((e) => logError(e && e.message ? e.message : String(e)));
    });
  }

  if (copyPitchSetButton) {
    copyPitchSetButton.addEventListener("click", () => {
      handleCopyPitchSet().catch((e) => logError(e && e.message ? e.message : String(e)));
    });
  }

  return {
    setReady,
  };
}

export {
  createIntonationCopyController,
};
