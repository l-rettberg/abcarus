function enableDraggableToolPanel(panelEl) {
  if (!panelEl || panelEl.__abcarusDraggableToolPanel) return;
  const handle = panelEl.querySelector(".tool-panel-header");
  if (!handle) return;
  panelEl.__abcarusDraggableToolPanel = true;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let rafPending = false;
  let nextLeft = 0;
  let nextTop = 0;

  const applyPosition = () => {
    rafPending = false;
    const rect = panelEl.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const left = Math.max(0, Math.min(maxLeft, nextLeft));
    const top = Math.max(0, Math.min(maxTop, nextTop));
    panelEl.style.left = `${left}px`;
    panelEl.style.top = `${top}px`;
    panelEl.style.right = "auto";
    panelEl.style.bottom = "auto";
  };

  const onPointerMove = (ev) => {
    if (!dragging) return;
    nextLeft = startLeft + (ev.clientX - startX);
    nextTop = startTop + (ev.clientY - startY);
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(applyPosition);
  };

  const stopDrag = () => {
    if (!dragging) return;
    dragging = false;
    try {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    } catch {}
  };

  handle.addEventListener("pointerdown", (ev) => {
    if (!ev || ev.button !== 0) return;
    const tag = ev.target && ev.target.tagName ? String(ev.target.tagName).toLowerCase() : "";
    if (tag === "button" || tag === "input" || tag === "select" || tag === "textarea") return;
    if (ev.target && ev.target.closest && ev.target.closest("button,input,select,textarea")) return;

    const rect = panelEl.getBoundingClientRect();
    dragging = true;
    startX = ev.clientX;
    startY = ev.clientY;
    startLeft = Number.isFinite(rect.left) ? rect.left : 0;
    startTop = Number.isFinite(rect.top) ? rect.top : 0;
    nextLeft = startLeft;
    nextTop = startTop;
    panelEl.style.left = `${startLeft}px`;
    panelEl.style.top = `${startTop}px`;
    panelEl.style.right = "auto";
    panelEl.style.bottom = "auto";
    try {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDrag);
      window.addEventListener("pointercancel", stopDrag);
    } catch {}
    ev.preventDefault();
  });
}

export {
  enableDraggableToolPanel,
};
