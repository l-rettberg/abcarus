import {
  clampTranslateToViewport,
  formatTranslateXY,
  readTranslateXY,
} from "../app/ui/modal_geometry.js";

function normalizePrintAllPageBreaks(value) {
  const mode = String(value || "").trim();
  if (mode === "perTune" || mode === "continuous") return mode;
  if (mode === "none" || mode === "auto") return "continuous";
  return "";
}

function createPrintAllOptionsController({
  modal,
  pageBreaksSelect,
  rememberCheckbox,
  cancelButton,
  okButton,
} = {}) {
  let pageBreaks = "perTune";
  let askEachTime = true;
  let resolveModal = null;
  let dragState = null;
  let dragBaseRect = null;

  function getPatch() {
    return {
      printAllPageBreaks: pageBreaks,
      printAllAskEachTime: askEachTime,
    };
  }

  function applySavedOptions(saved) {
    if (!saved || typeof saved !== "object") return;
    const version = saved && saved.version ? String(saved.version) : "";
    if (version !== "1") return;
    const savedPageBreaks = normalizePrintAllPageBreaks(saved.pageBreaks);
    if (savedPageBreaks) pageBreaks = savedPageBreaks;
    if (typeof saved.askEachTime === "boolean") askEachTime = saved.askEachTime;
  }

  function applySettings(settings) {
    if (!settings) return;
    const settingsPageBreaks = normalizePrintAllPageBreaks(settings.printAllPageBreaks);
    if (settingsPageBreaks) pageBreaks = settingsPageBreaks;
    if (typeof settings.printAllAskEachTime === "boolean") askEachTime = settings.printAllAskEachTime;
  }

  function closeModal(result) {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (typeof resolveModal === "function") {
      const resolve = resolveModal;
      resolveModal = null;
      resolve(result || null);
    }
  }

  function applyTranslate(pos) {
    if (!modal) return;
    const card = modal.querySelector(".modal-card");
    if (!card) return;
    const p = clampTranslateToViewport(pos, dragBaseRect);
    card.style.transform = formatTranslateXY(p);
  }

  function openModal({ defaultPageBreaks = "perTune" } = {}) {
    if (!modal || !pageBreaksSelect) return Promise.resolve(null);
    const value = normalizePrintAllPageBreaks(defaultPageBreaks) || "perTune";
    pageBreaksSelect.value = value;
    if (rememberCheckbox) rememberCheckbox.checked = false;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    pageBreaksSelect.focus();
    requestAnimationFrame(() => {
      const card = modal.querySelector(".modal-card");
      if (!card) return;
      dragBaseRect = card.getBoundingClientRect();
      // Clamp any existing transform (e.g., after a resize).
      applyTranslate(readTranslateXY(card.style.transform));
    });
    return new Promise((resolve) => {
      resolveModal = resolve;
    });
  }

  async function getPageBreaksForAction() {
    if (!askEachTime) return { pageBreaks, patch: null };
    const res = await openModal({ defaultPageBreaks: pageBreaks });
    if (!res) return { pageBreaks: null, patch: null };
    const nextPageBreaks = normalizePrintAllPageBreaks(res.pageBreaks) || "perTune";
    pageBreaks = nextPageBreaks;
    if (res.remember) askEachTime = false;
    return { pageBreaks, patch: getPatch() };
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(null);
    });
    modal.addEventListener("keydown", (e) => {
      if (!e) return;
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeModal(null);
    });

    const card = modal.querySelector(".modal-card");
    const header = modal.querySelector(".modal-header");
    if (card && header) {
      header.addEventListener("pointerdown", (event) => {
        if (!event || event.button !== 0) return;
        const target = event.target;
        if (target && (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("textarea"))) {
          return;
        }
        if (!modal.classList.contains("open")) return;
        const start = readTranslateXY(card.style.transform);
        dragState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: start.x,
          originY: start.y,
        };
        card.classList.add("dragging");
        try { header.setPointerCapture(event.pointerId); } catch {}
        event.preventDefault();
      });

      header.addEventListener("pointermove", (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        applyTranslate({ x: dragState.originX + dx, y: dragState.originY + dy });
      });

      const endDrag = (event) => {
        if (!dragState) return;
        if (event && dragState.pointerId != null && event.pointerId !== dragState.pointerId) return;
        dragState = null;
        card.classList.remove("dragging");
        try { if (event) header.releasePointerCapture(event.pointerId); } catch {}
      };
      header.addEventListener("pointerup", endDrag);
      header.addEventListener("pointercancel", endDrag);
    }
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", () => closeModal(null));
  }

  if (okButton) {
    okButton.addEventListener("click", () => {
      const selectedPageBreaks = pageBreaksSelect ? String(pageBreaksSelect.value || "perTune") : "perTune";
      const remember = Boolean(rememberCheckbox && rememberCheckbox.checked);
      closeModal({ pageBreaks: selectedPageBreaks, remember });
    });
  }

  return {
    applySavedOptions,
    applySettings,
    getPageBreaksForAction,
    getPatch,
  };
}

export {
  createPrintAllOptionsController,
  normalizePrintAllPageBreaks,
};
