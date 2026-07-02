function createMoveTuneModalController({
  modal,
  closeButton,
  cancelButton,
  targetSelect,
  applyButton,
  safeBasename,
  enableDraggableModal,
  showError,
  onMove,
} = {}) {
  let pendingTuneId = null;

  function close() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    pendingTuneId = null;
  }

  function open(tuneId, { files = [], activeFilePath = "" } = {}) {
    if (!modal || !targetSelect) return;
    const list = Array.isArray(files) ? files : [];
    if (!list.length) {
      if (typeof showError === "function") showError("Load a library folder first.");
      return;
    }
    pendingTuneId = tuneId;
    targetSelect.textContent = "";
    for (const file of list) {
      const path = String(file && file.path || "");
      if (!path) continue;
      const opt = document.createElement("option");
      opt.value = path;
      opt.textContent = String(file && file.basename || (typeof safeBasename === "function" ? safeBasename(path) : path));
      targetSelect.appendChild(opt);
    }
    if (activeFilePath) targetSelect.value = activeFilePath;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    try { targetSelect.focus(); } catch {}
  }

  async function apply() {
    const targetPath = targetSelect ? String(targetSelect.value || "") : "";
    const tuneId = pendingTuneId;
    close();
    if (tuneId && targetPath && typeof onMove === "function") {
      await onMove(tuneId, targetPath);
    }
  }

  if (closeButton) closeButton.addEventListener("click", () => close());
  if (cancelButton) cancelButton.addEventListener("click", () => close());
  if (applyButton) applyButton.addEventListener("click", () => {
    apply().catch((err) => {
      if (typeof showError === "function") showError(err && err.message ? err.message : String(err));
    });
  });
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    modal.addEventListener("keydown", (event) => {
      if (!event) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (!applyButton || applyButton.disabled) return;
        event.preventDefault();
        event.stopPropagation();
        apply().catch((err) => {
          if (typeof showError === "function") showError(err && err.message ? err.message : String(err));
        });
      }
    });
    if (typeof enableDraggableModal === "function") enableDraggableModal(modal);
  }

  return {
    close,
    open,
  };
}

export {
  createMoveTuneModalController,
};
