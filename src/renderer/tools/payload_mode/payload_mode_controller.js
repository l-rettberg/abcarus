export function createPayloadModeController({
  bar,
  renderTab,
  playbackTab,
  copyButton,
  exitButton,
  lockElements = [],
  getView = () => "render",
  getCopyText = () => ({ text: "", selectionText: "" }),
  onExit = () => {},
  onSetView = () => {},
  showToast = () => {},
  writeClipboard = async (text) => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  },
} = {}) {
  let wired = false;

  const setLocked = (locked) => {
    for (const el of lockElements) {
      if (el) el.disabled = Boolean(locked);
    }
  };

  const setEnabled = (enabled) => {
    const active = Boolean(enabled);
    document.body.classList.toggle("payload-mode", active);
    if (bar) bar.classList.toggle("hidden", !active);
    setLocked(active);
  };

  const updateTabs = (viewArg) => {
    const view = viewArg || getView();
    const isRender = view === "render";
    if (renderTab) {
      renderTab.classList.toggle("is-active", isRender);
      renderTab.setAttribute("aria-selected", isRender ? "true" : "false");
    }
    if (playbackTab) {
      playbackTab.classList.toggle("is-active", !isRender);
      playbackTab.setAttribute("aria-selected", isRender ? "false" : "true");
    }
  };

  const copyCurrentText = async () => {
    try {
      const result = getCopyText() || {};
      const text = String(result.text || "");
      const selectionText = String(result.selectionText || "");
      if (text && await writeClipboard(text)) {
        if (selectionText) {
          showToast("Copied selection.", 1600);
        } else {
          showToast(getView() === "playback" ? "Copied playback payload." : "Copied render payload.", 1800);
        }
      } else {
        showToast("Clipboard not available.", 2200);
      }
    } catch {
      showToast("Copy failed.", 2200);
    }
  };

  const wire = () => {
    if (wired) return;
    wired = true;

    if (exitButton) {
      exitButton.addEventListener("click", () => {
        Promise.resolve(onExit()).catch(() => {});
      });
    }
    if (renderTab) {
      renderTab.addEventListener("click", () => {
        Promise.resolve(onSetView("render")).catch(() => {});
      });
    }
    if (playbackTab) {
      playbackTab.addEventListener("click", () => {
        Promise.resolve(onSetView("playback")).catch(() => {});
      });
    }
    if (copyButton) {
      copyButton.addEventListener("click", () => {
        copyCurrentText().catch(() => {});
      });
    }
  };

  return {
    setEnabled,
    setLocked,
    updateTabs,
    wire,
  };
}
