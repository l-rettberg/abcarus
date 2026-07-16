import {
  clampTranslateToViewport,
  formatTranslateXY,
  readTranslateXY,
} from "./modal_geometry.js";

function enableDraggableModal(modalEl) {
  if (!modalEl || modalEl.__abcarusDraggableModal) return;
  // Settings + Print All already have their own drag logic (and persistence).
  if (modalEl.id === "settingsModal" || modalEl.id === "printAllOptionsModal") return;
  const card = modalEl.querySelector(".modal-card");
  const header = modalEl.querySelector(".modal-header");
  if (!card || !header) return;
  modalEl.__abcarusDraggableModal = true;

  let dragState = null;
  let dragBaseRect = null;

  const applyTranslate = (pos) => {
    const p = clampTranslateToViewport(pos, dragBaseRect);
    card.style.transform = formatTranslateXY(p);
  };

  header.addEventListener("pointerdown", (event) => {
    if (!event || event.button !== 0) return;
    const target = event.target;
    if (target && (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("textarea"))) {
      return;
    }
    if (!modalEl.classList.contains("open")) return;
    dragBaseRect = card.getBoundingClientRect();
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
    dragBaseRect = null;
    card.classList.remove("dragging");
    try { if (event) header.releasePointerCapture(event.pointerId); } catch {}
  };

  header.addEventListener("pointerup", endDrag);
  header.addEventListener("pointercancel", endDrag);

  window.addEventListener("resize", () => {
    if (!modalEl.classList.contains("open")) return;
    dragBaseRect = card.getBoundingClientRect();
    applyTranslate(readTranslateXY(card.style.transform));
  });
}

export {
  enableDraggableModal,
};
