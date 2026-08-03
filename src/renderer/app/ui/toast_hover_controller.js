function isCriticalToast(message) {
  const msg = String(message || "").trim();
  if (!msg) return false;
  const criticalPrefixes = [
    "Playback failed",
    "Playback parse error",
    "Selected range cannot be played safely",
    "Range crosses repeat",
    "Unable to ",
    "Unable ",
    "Failed to ",
    "Save/Discard",
    "Stop playback",
    "Exit Payload Mode",
    "Raw mode: switch",
    "Open/select a file first",
    "Open a file first",
    "No file open",
    "No active file selected",
    "No file selected",
    "Emergency recovery copy available",
    "Save the active file first",
    "Close the file in the editor before renaming it",
    "Invalid measure number",
    "Measure ",
    "Export not available",
    "Import not available",
    "Not available",
    "Payload Mode is disabled",
  ];
  for (const prefix of criticalPrefixes) {
    if (msg.startsWith(prefix)) return true;
  }
  if (msg.includes("cannot be played")) return true;
  if (msg.includes("Cannot read properties")) return true;
  return false;
}

function createToastHoverController({
  documentRef = typeof document !== "undefined" ? document : null,
  toastElement = null,
  hoverElement = null,
  isDebugMessagesEnabled = () => false,
} = {}) {
  let toastTimer = null;
  let pinnedHoverStatusText = "";

  function clearToastTimer() {
    if (!toastTimer) return;
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  function canShowToast(message) {
    return Boolean(isDebugMessagesEnabled()) || isCriticalToast(message);
  }

  function showToast(message, durationMs = 4000) {
    if (!toastElement) return;
    if (!canShowToast(message)) return;
    toastElement.textContent = message || "";
    toastElement.classList.add("show");
    clearToastTimer();
    toastTimer = setTimeout(() => {
      toastElement.classList.remove("show");
      toastTimer = null;
    }, durationMs);
  }

  function showToastWithAction(message, actionLabel, actionFn, durationMs = 6000) {
    if (!toastElement) return;
    if (!canShowToast(message)) return;
    const label = String(actionLabel || "").trim();
    if (!label || typeof actionFn !== "function") {
      showToast(message, durationMs);
      return;
    }

    toastElement.textContent = "";
    const text = documentRef ? documentRef.createElement("span") : null;
    const btn = documentRef ? documentRef.createElement("button") : null;
    if (!text || !btn) {
      showToast(message, durationMs);
      return;
    }
    text.textContent = message || "";
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = label;
    btn.addEventListener("click", (e) => {
      try { e.preventDefault(); e.stopPropagation(); } catch {}
      try { actionFn(); } catch {}
      try { toastElement.classList.remove("show"); } catch {}
      clearToastTimer();
    });
    toastElement.appendChild(text);
    toastElement.appendChild(btn);
    toastElement.classList.add("show");
    clearToastTimer();
    toastTimer = setTimeout(() => {
      toastElement.classList.remove("show");
      toastTimer = null;
    }, durationMs);
  }

  function setHoverStatus(text) {
    if (!hoverElement) return;
    const next = String(text || "");
    hoverElement.textContent = next;
    hoverElement.title = next;
  }

  function pinHoverStatus(_text) {
    pinnedHoverStatusText = "";
    setHoverStatus("");
  }

  function showHoverStatus(text) {
    const next = String(text || "");
    if (next) setHoverStatus(next);
    else setHoverStatus(pinnedHoverStatusText);
  }

  function restoreHoverStatus() {
    setHoverStatus(pinnedHoverStatusText);
  }

  return {
    isCriticalToast,
    pinHoverStatus,
    restoreHoverStatus,
    setHoverStatus,
    showHoverStatus,
    showToast,
    showToastWithAction,
  };
}

export {
  createToastHoverController,
  isCriticalToast,
};
