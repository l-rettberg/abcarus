function createDisclaimerController({
  modal = null,
  confirmButton = null,
  api = null,
  enableDraggableModal = null,
} = {}) {
  let shown = false;

  function showIfNeeded(settings) {
    if (shown || !modal || !confirmButton) return false;
    if (!settings || settings.disclaimerSeen) return false;
    shown = true;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    return true;
  }

  async function dismiss() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (api && typeof api.updateSettings === "function") {
      await api.updateSettings({ disclaimerSeen: true });
    }
  }

  function wire() {
    if (confirmButton) {
      confirmButton.addEventListener("click", () => {
        dismiss().catch(() => {});
      });
    }
    if (modal) {
      modal.addEventListener("keydown", (event) => {
        if (!event || (event.key !== "Escape" && event.key !== "Enter")) return;
        event.preventDefault();
        event.stopPropagation();
        dismiss().catch(() => {});
      });
      if (typeof enableDraggableModal === "function") enableDraggableModal(modal);
    }
  }

  return {
    dismiss,
    showIfNeeded,
    wire,
  };
}

export { createDisclaimerController };
