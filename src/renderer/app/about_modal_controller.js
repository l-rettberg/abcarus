function formatAboutInfo(info) {
  if (!info) return "No system info available.";
  const osParts = [info.platform, info.arch, info.osRelease].filter(Boolean).join(" ").trim();
  const distro = info.distroPrettyName
    || [info.distroName, info.distroVersion].filter(Boolean).join(" ").trim()
    || "";
  return [
    `Version: ${info.appVersion || ""}`.trim(),
    `Build: ${info.build || ""}`.trim(),
    `Commit: ${info.commit || ""}`.trim(),
    `Channel: ${info.channel || ""}`.trim(),
    "Status: Early-stage release (functional, not yet guaranteed stable).",
    "Disclaimer: docs/DISCLAIMER.md",
    `Date: ${info.buildDate || ""}`.trim(),
    `Electron: ${info.electron || ""}`.trim(),
    `ElectronBuildId: ${info.electronBuildId || ""}`.trim(),
    `Chromium: ${info.chrome || ""}`.trim(),
    `Node.js: ${info.node || ""}`.trim(),
    `V8: ${info.v8 || ""}`.trim(),
    (info.abc2svgVersion || info.abc2svgDate)
      ? `abc2svg: ${[info.abc2svgVersion || "", info.abc2svgDate || ""].filter(Boolean).join(" ")}`
      : "",
    `OS: ${osParts}`.trim(),
    distro ? `Distro: ${distro}` : "",
    info.sessionType ? `Session: ${info.sessionType}` : "",
    (info.xdgCurrentDesktop || info.desktopSession || info.desktop) ? `Desktop: ${info.xdgCurrentDesktop || info.desktopSession || info.desktop}` : "",
    (info.waylandDisplay || info.display) ? `Display: ${(info.waylandDisplay ? `wayland:${info.waylandDisplay}` : "")}${(info.waylandDisplay && info.display) ? " " : ""}${(info.display ? `x11:${info.display}` : "")}` : "",
    (info.lcAll || info.lang) ? `Locale: ${info.lcAll || info.lang}` : "",
    info.pythonVersion ? `Python: ${info.pythonVersion}` : "",
  ].filter(Boolean).join("\n");
}

function createAboutModalController({
  modal,
  infoElement,
  closeButton,
  copyButton,
  api,
  enableDraggableModal,
  setStatus,
  logError,
} = {}) {
  function close() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  async function open() {
    if (!modal || !infoElement) return;
    let infoText = "Loading...";
    infoElement.textContent = infoText;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    if (api && typeof api.getAboutInfo === "function") {
      const info = await api.getAboutInfo();
      infoText = formatAboutInfo(info);
    }
    infoElement.textContent = infoText;
  }

  async function copyInfo() {
    if (!infoElement) return;
    const text = infoElement.textContent || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (typeof setStatus === "function") setStatus("Copied.");
    } catch (err) {
      if (typeof logError === "function") logError(err && err.message ? err.message : String(err));
      if (typeof setStatus === "function") setStatus("Copy failed.");
    }
  }

  if (closeButton) closeButton.addEventListener("click", () => close());
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    modal.addEventListener("keydown", (event) => {
      if (!event) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    });
    if (typeof enableDraggableModal === "function") enableDraggableModal(modal);
  }
  if (copyButton) copyButton.addEventListener("click", () => {
    copyInfo().catch((err) => {
      if (typeof logError === "function") logError(err && err.message ? err.message : String(err));
    });
  });

  return {
    close,
    open,
  };
}

export {
  createAboutModalController,
  formatAboutInfo,
};
