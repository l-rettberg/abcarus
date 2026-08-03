function enableDraggableFixedPopover(popoverEl, handleEl, { margin = 10 } = {}) {
  if (!popoverEl || !handleEl || popoverEl.__abcarusDraggableFixedPopover) return;
  popoverEl.__abcarusDraggableFixedPopover = true;
  handleEl.style.cursor = "move";
  handleEl.style.userSelect = "none";

  handleEl.addEventListener("pointerdown", (event) => {
    if (!event || event.button !== 0) return;
    const target = event.target;
    if (target && target.closest && target.closest("button,input,select,textarea")) return;

    const rect = popoverEl.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = Number.isFinite(rect.left) ? rect.left : margin;
    const startTop = Number.isFinite(rect.top) ? rect.top : margin;
    const width = Number.isFinite(rect.width) ? rect.width : 0;
    const height = Number.isFinite(rect.height) ? rect.height : 0;

    popoverEl.style.left = `${Math.round(startLeft)}px`;
    popoverEl.style.top = `${Math.round(startTop)}px`;
    popoverEl.style.right = "auto";
    popoverEl.style.bottom = "auto";

    const move = (ev) => {
      const viewportWidth = window.innerWidth || 0;
      const viewportHeight = window.innerHeight || 0;
      const maxLeft = Math.max(margin, viewportWidth - width - margin);
      const maxTop = Math.max(margin, viewportHeight - height - margin);
      const left = Math.max(margin, Math.min(maxLeft, startLeft + (ev.clientX - startX)));
      const top = Math.max(margin, Math.min(maxTop, startTop + (ev.clientY - startY)));
      popoverEl.style.left = `${Math.round(left)}px`;
      popoverEl.style.top = `${Math.round(top)}px`;
    };

    const up = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      popoverEl.classList.remove("dragging");
    };

    popoverEl.classList.add("dragging");
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    event.preventDefault();
    event.stopPropagation();
  });
}

export {
  enableDraggableFixedPopover,
};
