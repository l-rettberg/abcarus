function createErrorsListController({
  listElement,
  getErrors,
  getActiveTuneId,
  getGroupKey,
  getGroupLabel,
  onActivate,
} = {}) {
  function getItems() {
    return typeof getErrors === "function" && Array.isArray(getErrors()) ? getErrors() : [];
  }

  function render() {
    if (!listElement) return;
    listElement.textContent = "";
    const entries = getItems();
    if (!entries.length) return;

    const groups = new Map();
    for (const entry of entries) {
      const key = typeof getGroupKey === "function" ? getGroupKey(entry) : "general";
      if (!groups.has(key)) {
        const label = typeof getGroupLabel === "function" ? getGroupLabel(entry) : "General";
        groups.set(key, { key, label, entries: [], count: 0 });
      }
      const group = groups.get(key);
      group.entries.push(entry);
      group.count += entry.count || 1;
    }

    const activeTuneId = typeof getActiveTuneId === "function" ? getActiveTuneId() : null;
    for (const group of groups.values()) {
      const details = document.createElement("details");
      details.className = "error-group";
      if (group.key === activeTuneId) details.open = true;

      const summary = document.createElement("summary");
      summary.className = "error-group-summary";
      summary.textContent = `${group.label} (${group.count})`;
      details.appendChild(summary);

      for (const entry of group.entries) {
        const item = document.createElement("div");
        item.className = "error-item";
        item.dataset.index = String(entry.index);
        if (entry.loc) {
          const loc = document.createElement("div");
          loc.className = "error-loc";
          loc.textContent = `Line ${entry.loc.line}, Col ${entry.loc.col}`;
          item.appendChild(loc);
        }
        const msg = document.createElement("div");
        msg.className = "error-msg";
        msg.textContent = entry.count && entry.count > 1
          ? `${entry.message} \u00d7${entry.count}`
          : entry.message;
        item.appendChild(msg);
        details.appendChild(item);
      }
      listElement.appendChild(details);
    }
  }

  if (listElement) {
    listElement.addEventListener("click", (event) => {
      const item = event.target && event.target.closest ? event.target.closest(".error-item") : null;
      if (!item || !item.dataset) return;
      const index = Number(item.dataset.index);
      const entry = Number.isFinite(index) ? getItems()[index] : null;
      if (!entry || typeof onActivate !== "function") return;
      onActivate(entry).catch(() => {});
    });
  }

  return {
    render,
  };
}

export {
  createErrorsListController,
};
