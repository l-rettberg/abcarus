import {
  filterTemplates,
  getTemplateDisplayTitle,
  getTemplatePreviewTitle,
  getTemplateSubtitle,
} from "./templates_model.js";

function createTemplatesView({
  list,
  search,
  previewTitle,
  previewText,
  insertButton,
  replaceButton,
  appendButton,
  editButton,
  onSelect,
  onDefaultAction,
} = {}) {
  function syncSelectionControls(item) {
    const disabled = !item;
    if (insertButton) insertButton.disabled = disabled;
    if (replaceButton) replaceButton.disabled = disabled;
    if (appendButton) appendButton.disabled = disabled;
    if (editButton) editButton.disabled = disabled;
  }

  function resetPreview() {
    if (previewTitle) previewTitle.textContent = "Select a template";
    if (previewText) previewText.textContent = "";
  }

  function resetSelection() {
    syncSelectionControls(null);
    resetPreview();
  }

  function renderList(items, selectedKey = "") {
    if (!list) return;
    const q = search ? String(search.value || "").trim().toLowerCase() : "";
    list.textContent = "";
    const visible = filterTemplates(items, q);
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "templates-item";
      empty.style.cursor = "default";
      empty.innerHTML = "<div class=\"templates-item-left\"></div><div><div class=\"templates-item-title\">No templates found</div><div class=\"templates-item-subtitle\">Add .abc files to the templates folder.</div></div>";
      list.appendChild(empty);
      return;
    }
    for (const item of visible) {
      const row = document.createElement("div");
      row.className = `templates-item${item.key === selectedKey ? " selected" : ""}`;
      row.dataset.key = item.key;
      const left = document.createElement("div");
      left.className = "templates-item-left";
      left.textContent = item.fileBasename || "";
      const right = document.createElement("div");
      const title = document.createElement("div");
      title.className = "templates-item-title";
      title.textContent = getTemplateDisplayTitle(item);
      const subtitle = document.createElement("div");
      subtitle.className = "templates-item-subtitle";
      subtitle.textContent = getTemplateSubtitle(item);
      right.appendChild(title);
      right.appendChild(subtitle);
      row.appendChild(left);
      row.appendChild(right);
      row.addEventListener("click", () => {
        if (typeof onSelect === "function") onSelect(item.key);
      });
      row.addEventListener("dblclick", () => {
        if (typeof onDefaultAction === "function") onDefaultAction();
      });
      list.appendChild(row);
    }
  }

  function renderPreview(item, text) {
    if (!previewTitle || !previewText) return;
    if (!item) {
      resetPreview();
      return;
    }
    previewTitle.textContent = getTemplatePreviewTitle(item);
    const value = String(text || "");
    previewText.textContent = value.trim() ? value.trim() : "(Empty template)";
  }

  return {
    renderList,
    renderPreview,
    resetSelection,
    syncSelectionControls,
  };
}

export {
  createTemplatesView,
};
