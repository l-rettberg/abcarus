import {
  extractFirstSourceUrlFromAbc,
} from "../../source_link.js";
import { createSourceLinkPanel } from "./source_link_panel.js";

function createSourceLinkController({
  panel,
  parseAbcHeaderFields,
  openExternalUrl,
  previewYouTubeSource,
  showToast,
  getEditorText,
  hasEditor,
  isDisabled,
} = {}) {
  let updateTimer = null;
  const sourceLinkPanel = createSourceLinkPanel({
    panel,
    parseAbcHeaderFields,
    openExternalUrl,
    previewYouTubeSource,
    showToast,
  });

  function clear() {
    sourceLinkPanel.clear();
  }

  function render(url, abcText = "") {
    sourceLinkPanel.render(url, abcText, { disabled: Boolean(isDisabled && isDisabled()) });
  }

  function update() {
    if (!panel) return;
    if ((hasEditor && !hasEditor()) || (isDisabled && isDisabled())) {
      clear();
      return;
    }
    const text = typeof getEditorText === "function" ? getEditorText() : "";
    render(extractFirstSourceUrlFromAbc(text), text);
  }

  function scheduleUpdate(delayMs = 250) {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updateTimer = null;
      update();
    }, Math.max(0, Number(delayMs) || 0));
  }

  return {
    clear,
    render,
    scheduleUpdate,
    update,
  };
}

export {
  createSourceLinkController,
};
