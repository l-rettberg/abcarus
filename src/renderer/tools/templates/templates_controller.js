import {
  buildTemplatesFlatList,
  getTemplateSlice,
} from "./templates_model.js";
import { createTemplatesFileCache } from "./templates_file_cache.js";
import { createTemplatesView } from "./templates_view.js";

function createTemplatesController({
  modal,
  search,
  list,
  folderLabel,
  previewTitle,
  previewText,
  insertButton,
  replaceButton,
  appendButton,
  editButton,
  api,
  readFile,
  safeBasename,
  onDefaultAction,
} = {}) {
  let index = null;
  let items = [];
  let selectedKey = "";

  const fileCache = createTemplatesFileCache({ readFile });
  const view = createTemplatesView({
    list,
    search,
    previewTitle,
    previewText,
    insertButton,
    replaceButton,
    appendButton,
    editButton,
    onSelect: (key) => {
      selectByKey(key).catch(() => {});
    },
    onDefaultAction,
  });

  function isOpen() {
    return Boolean(modal && modal.classList.contains("open"));
  }

  function close() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    selectedKey = "";
    view.resetSelection();
  }

  function renderList() {
    view.renderList(items, selectedKey);
  }

  function getSelectedItem() {
    const key = String(selectedKey || "");
    return items.find((item) => item && item.key === key) || null;
  }

  async function getSelectedText() {
    const item = getSelectedItem();
    if (!item) return "";
    const full = await fileCache.getText(item.filePath);
    return getTemplateSlice(full, item);
  }

  async function selectByKey(key) {
    const wanted = String(key || "");
    const item = items.find((template) => template && template.key === wanted) || null;
    selectedKey = item ? item.key : "";
    view.syncSelectionControls(item);
    renderList();
    if (!item) {
      view.renderPreview(null, "");
      return;
    }
    const full = await fileCache.getText(item.filePath);
    const slice = getTemplateSlice(full, item);
    view.renderPreview(item, slice);
  }

  async function load() {
    index = null;
    items = [];
    selectedKey = "";
    fileCache.clear();

    if (!folderLabel) return;
    if (!api || typeof api.getTemplatesInfo !== "function" || typeof api.scanTemplates !== "function") {
      folderLabel.textContent = "Templates unavailable";
      folderLabel.title = "Missing templates APIs.";
      return;
    }

    const info = await api.getTemplatesInfo();
    const folder = info && info.ok ? String(info.folder || "") : "";
    folderLabel.textContent = folder
      ? (typeof safeBasename === "function" ? safeBasename(folder) : folder)
      : "(none)";
    folderLabel.title = folder || "";

    const scan = await api.scanTemplates();
    if (!scan || !scan.ok) {
      index = null;
      items = [];
      renderList();
      return;
    }
    index = { root: scan.root || "", files: scan.files || [] };
    items = buildTemplatesFlatList(index.files, { safeBasename });
    renderList();
  }

  async function open() {
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    if (search) search.value = "";
    view.resetSelection();
    await load();
    try { if (search) search.focus(); } catch {}
  }

  return {
    close,
    getSelectedItem,
    getSelectedText,
    isOpen,
    load,
    open,
    renderList,
    selectByKey,
  };
}

export {
  createTemplatesController,
};
