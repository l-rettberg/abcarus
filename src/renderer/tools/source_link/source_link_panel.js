import {
  buildYouTubeSearchUrlFromFields,
  formatSourceLinkLabel,
  getYouTubeEmbedUrl,
  normalizeSourceUrl,
} from "../../source_link.js";

function createSourceLinkPanel({
  panel,
  parseAbcHeaderFields,
  openExternalUrl,
  previewYouTubeSource,
  showToast,
} = {}) {
  function clear() {
    if (!panel) return;
    panel.replaceChildren();
    panel.hidden = true;
  }

  function appendAction({ label, title, onClick, iconId = "" } = {}) {
    if (!panel) return null;
    const action = document.createElement("button");
    action.type = "button";
    action.className = "source-link-action";
    action.title = title || label || "";
    action.setAttribute("aria-label", title || label || "Source link action");

    if (iconId) {
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", "btn-icon");
      icon.setAttribute("aria-hidden", "true");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", iconId);
      icon.appendChild(use);
      action.appendChild(icon);
    }

    const text = document.createElement("span");
    text.className = "source-link-action-label";
    text.textContent = label || "";
    action.appendChild(text);

    if (typeof onClick === "function") action.addEventListener("click", onClick);
    panel.appendChild(action);
    return action;
  }

  async function openPreview(sourceUrl) {
    const url = normalizeSourceUrl(sourceUrl);
    if (!getYouTubeEmbedUrl(url)) {
      if (typeof showToast === "function") showToast("Preview is available only for YouTube F: links.", 2400);
      return;
    }
    try {
      if (typeof previewYouTubeSource !== "function") {
        if (typeof openExternalUrl === "function") await openExternalUrl(url);
        return;
      }
      const res = await previewYouTubeSource(url);
      if (!res || res.ok === false) {
        if (typeof showToast === "function") {
          showToast((res && res.error) ? String(res.error) : "Unable to open YouTube preview.", 2800);
        }
      }
    } catch (e) {
      if (typeof showToast === "function") {
        showToast(e && e.message ? e.message : "Unable to open YouTube preview.", 2800);
      }
    }
  }

  function render(url, abcText = "", { disabled = false } = {}) {
    if (!panel) return;
    const text = String(abcText || "");
    const sourceUrl = normalizeSourceUrl(url);
    panel.replaceChildren();
    if (disabled) {
      panel.hidden = true;
      return;
    }

    if (!sourceUrl) {
      const fields = typeof parseAbcHeaderFields === "function" ? parseAbcHeaderFields(text) : {};
      const searchUrl = buildYouTubeSearchUrlFromFields(fields);
      if (!searchUrl) {
        panel.hidden = true;
        return;
      }
      appendAction({
        label: "Search YouTube",
        title: "Search YouTube for this tune",
        iconId: "#ui-play",
        onClick: () => {
          if (typeof openExternalUrl === "function") openExternalUrl(searchUrl);
        },
      });
      panel.hidden = false;
      return;
    }

    appendAction({
      label: `F: ${formatSourceLinkLabel(sourceUrl)}`,
      title: sourceUrl,
      onClick: () => {
        if (typeof openExternalUrl === "function") openExternalUrl(sourceUrl);
      },
    });

    if (getYouTubeEmbedUrl(sourceUrl)) {
      appendAction({
        label: "Preview",
        title: "Preview YouTube source",
        iconId: "#ui-play",
        onClick: () => openPreview(sourceUrl),
      });
    }

    panel.hidden = false;
  }

  return {
    clear,
    openPreview,
    render,
  };
}

export {
  createSourceLinkPanel,
};
