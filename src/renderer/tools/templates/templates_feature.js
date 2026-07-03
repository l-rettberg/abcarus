import { createTemplatesController } from "./templates_controller.js";

function createTemplatesFeature({
  elements = {},
  api,
  readFile,
  safeBasename,
  enableDraggableModal,
  getActiveFileEntry = () => null,
  isPayloadMode = () => false,
  ensureXNumberInAbc = (text) => text,
  ensureSafeToAbandonCurrentDoc = async () => true,
  insertTextAtEditorSelection = () => false,
  setEditorText = () => {},
  appendTuneTextToFile = async () => false,
  showContextMenuAt = () => {},
  showSaveError = async () => {},
  showToast = () => {},
  logError = () => {},
} = {}) {
  const controller = createTemplatesController({
    modal: elements.modal,
    list: elements.list,
    search: elements.search,
    folderLabel: elements.folderLabel,
    previewTitle: elements.previewTitle,
    previewText: elements.previewText,
    closeButton: elements.closeButton,
    cancelButton: elements.cancelButton,
    manageButton: elements.manageButton,
    reloadButton: elements.reloadButton,
    insertButton: elements.insertButton,
    replaceButton: elements.replaceButton,
    appendButton: elements.appendButton,
    editButton: elements.editButton,
    api,
    readFile,
    safeBasename,
    enableDraggableModal,
    logError,
    showToast,
    onInsert: () => insertSelectedTemplate("insert"),
    onReplace: () => insertSelectedTemplate("replace"),
    onAppend: () => insertSelectedTemplate("append"),
    onPreviewContextMenu: (event, { fullText, selectionText } = {}) => {
      showContextMenuAt(event.clientX, event.clientY, {
        type: "templatesPreview",
        fullText,
        selectionText,
      });
    },
  });

  async function getPreparedTemplateText() {
    const item = controller.getSelectedItem();
    if (!item) return "";
    let slice = await controller.getSelectedText();
    if (!slice.trim()) {
      await showSaveError("Template is empty.");
      return "";
    }
    if (!/^[\t ]*X:/m.test(slice)) {
      slice = ensureXNumberInAbc(slice, "");
    }
    return slice;
  }

  async function insertSelectedTemplate(modeOverride = "") {
    const entry = getActiveFileEntry();
    if (!entry || !entry.path) {
      showToast("Open/select a file first.", 2600);
      return false;
    }

    let slice = await getPreparedTemplateText();
    if (!slice) return false;

    const mode = String(modeOverride || "insert");
    if (mode === "insert") {
      if (isPayloadMode()) {
        showToast("Exit Payload Mode to insert a template.", 2400);
        return false;
      }
      const ok = await ensureSafeToAbandonCurrentDoc("inserting a template");
      if (!ok) return false;
      if (!/[\r\n]$/.test(slice)) slice = `${slice}\n`;
      const inserted = insertTextAtEditorSelection(slice);
      if (!inserted) return false;
      showToast("Template inserted.", 1800);
      controller.close();
      return true;
    }

    if (mode === "replace") {
      if (isPayloadMode()) {
        showToast("Exit Payload Mode to replace a tune.", 2400);
        return false;
      }
      setEditorText(slice.trimEnd());
      showToast("Template replaced current tune.", 2200);
      controller.close();
      return true;
    }

    const appended = await appendTuneTextToFile(entry.path, slice, { toastOk: "Template appended." });
    if (appended) controller.close();
    return Boolean(appended);
  }

  return {
    close: () => controller.close(),
    insertSelectedTemplate,
    isOpen: () => controller.isOpen(),
    open: () => controller.open(),
  };
}

export {
  createTemplatesFeature,
};
