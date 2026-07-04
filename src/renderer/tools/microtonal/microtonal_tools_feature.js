import { createMakamDnaController } from "../makam_dna/makam_dna_controller.js";
import { createMakamDnaStore } from "../makam_dna/makam_dna_store.js";

function createMicrotonalToolsFeature({
  makamDna = {},
  api = null,
  enableDraggable = null,
  logError = () => {},
  showToast = () => {},
  onMakamDnaChanged = () => {},
} = {}) {
  const makamDnaStore = createMakamDnaStore({
    api,
    onError: (e) => logError(e && e.message ? e.message : String(e)),
  });

  makamDnaStore.rebuildNameIndex();

  async function notifyMakamDnaChanged() {
    try {
      const res = onMakamDnaChanged();
      if (res && typeof res.then === "function") await res;
    } catch (e) {
      logError(e && e.message ? e.message : String(e));
    }
  }

  async function applyUserMakamDnaText(text) {
    const applied = makamDnaStore.applyUserText(text);
    if (!applied.ok) return applied;
    await notifyMakamDnaChanged();
    return { ok: true };
  }

  const makamDnaController = createMakamDnaController({
    modal: makamDna.modal,
    closeButton: makamDna.closeButton,
    cancelButton: makamDna.cancelButton,
    editor: makamDna.editor,
    status: makamDna.status,
    resetBuiltinButton: makamDna.resetBuiltinButton,
    saveButton: makamDna.saveButton,
    api,
    ensureLoaded: () => makamDnaStore.ensureLoaded(),
    getInitialText: () => makamDnaStore.getInitialEditorText(),
    validateText: (text) => makamDnaStore.parseText(text),
    applyText: applyUserMakamDnaText,
    resetBuiltin: async () => {
      const text = await makamDnaStore.resetBuiltin();
      await notifyMakamDnaChanged();
      return text;
    },
    enableDraggable,
    onSaved: () => {
      try { showToast("Saved Makam DNA.", 1800); } catch {}
    },
    onError: (e) => {
      logError(e && e.message ? e.message : String(e));
    },
  });

  return {
    detectMakamFromTuneText: (tuneText) => makamDnaStore.detectFromTuneText(tuneText),
    ensureMakamDnaLoaded: () => makamDnaStore.ensureLoaded(),
    getMakamDnaEntries: () => makamDnaStore.getEntries(),
    getMakamDnaEntry: (name) => makamDnaStore.getEntry(name),
    openMakamDnaModal: () => makamDnaController.open(),
  };
}

export {
  createMicrotonalToolsFeature,
};
