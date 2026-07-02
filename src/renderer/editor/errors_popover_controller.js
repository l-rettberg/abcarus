function createErrorsPopoverController({
  indicator,
  popover,
  titleElement,
  listElement,
  getErrors,
  getActiveErrorId,
  computeErrorId,
  onJump,
} = {}) {
  let open = false;

  function getItems() {
    return typeof getErrors === "function" && Array.isArray(getErrors()) ? getErrors() : [];
  }

  function isOpen() {
    return open;
  }

  function renderList() {
    if (!listElement) return;
    listElement.textContent = "";
    const items = getItems();
    if (!items.length) return;
    const activeId = typeof getActiveErrorId === "function" ? String(getActiveErrorId() || "") : "";
    for (let i = 0; i < items.length; i += 1) {
      const err = items[i];
      const row = document.createElement("div");
      row.className = "errors-row";
      const rowId = typeof computeErrorId === "function" ? computeErrorId(err) : "";
      if (rowId && activeId && rowId === activeId) row.classList.add("active");
      row.dataset.index = String(i);
      const label = err && err.tuneTitle ? String(err.tuneTitle) : "Untitled";
      const source = err && err.source ? ` (${err.source})` : "";
      row.textContent = `${label} — ${err ? err.message : ""}${source}`;
      listElement.appendChild(row);
    }
    if (titleElement) {
      titleElement.textContent = `Errors (${items.length})`;
    }
  }

  function position() {
    if (!popover || !indicator) return;
    const rect = indicator.getBoundingClientRect();
    const margin = 10;

    popover.style.left = "0px";
    popover.style.top = "0px";
    popover.style.maxHeight = "min(320px, calc(100vh - 24px))";

    const popRect = popover.getBoundingClientRect();
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    let left = rect.left;
    left = Math.max(margin, Math.min(vw - margin - popRect.width, left));

    let top = rect.top - popRect.height - 8;
    if (top < margin) {
      top = rect.bottom + 8;
    }
    top = Math.max(margin, Math.min(vh - margin - popRect.height, top));

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  function setOpen(next) {
    const wantOpen = Boolean(next);
    if (wantOpen && getItems().length === 0) return;
    open = wantOpen;
    if (!popover) return;
    popover.classList.toggle("hidden", !wantOpen);
    if (wantOpen) {
      renderList();
      position();
    }
  }

  function close() {
    setOpen(false);
  }

  function toggle() {
    setOpen(!open);
  }

  function refresh() {
    if (!open) return;
    if (!getItems().length) {
      close();
      return;
    }
    renderList();
    position();
  }

  function updateIndicator({ enabled = false } = {}) {
    const items = getItems();
    if (!enabled) {
      if (indicator) {
        indicator.textContent = "Errors: 0";
        indicator.disabled = true;
        indicator.hidden = true;
      }
      close();
      return;
    }
    const count = items.length;
    if (indicator) {
      indicator.textContent = `Errors: ${count}`;
      indicator.disabled = count === 0;
      indicator.hidden = count === 0;
    }
    refresh();
  }

  if (indicator) {
    indicator.addEventListener("click", () => {
      if (indicator.disabled) return;
      toggle();
    });
  }

  if (listElement) {
    listElement.addEventListener("click", (event) => {
      const row = event.target && event.target.closest ? event.target.closest(".errors-row") : null;
      if (!row || !row.dataset) return;
      const idx = Number(row.dataset.index);
      const item = Number.isFinite(idx) ? getItems()[idx] : null;
      if (!item) return;
      close();
      if (typeof onJump === "function") {
        onJump(item).catch(() => {});
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (!open) return;
    const target = event.target;
    if (popover && popover.contains(target)) return;
    if (indicator && indicator.contains(target)) return;
    close();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!open) return;
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }, true);

  return {
    close,
    isOpen,
    position,
    refresh,
    renderList,
    setOpen,
    toggle,
    updateIndicator,
  };
}

export {
  createErrorsPopoverController,
};
