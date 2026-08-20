import { addFacetToAllTunes, addFacetToTuneText } from "./catalog_metadata_transform.js";

function createCatalogMetadataFeature({ elements = {}, state = {}, actions = {} } = {}) {
  const { modal, closeButton, cancelButton, applyButton, scopeSelect, facetSelect, valueInput, preview } = elements;
  let previewToken = 0;
  let previewTimer = null;

  function activePath() {
    const file = typeof state.getActiveFileEntry === "function" ? state.getActiveFileEntry() : null;
    if (file && file.path) return String(file.path);
    return typeof state.getActiveFilePath === "function" ? String(state.getActiveFilePath() || "") : "";
  }

  function close() {
    if (!modal) return;
    previewToken += 1;
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = null;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function schedulePreview(delayMs = 0) {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      previewTimer = null;
      calculatePreview().catch(() => {});
    }, Math.max(0, Number(delayMs) || 0));
  }

  function setPreview(message, { error = false, canApply = false } = {}) {
    if (preview) {
      preview.textContent = String(message || "");
      preview.classList.toggle("error", Boolean(error));
    }
    if (applyButton) applyButton.disabled = !canApply;
  }

  function describeResult(result, scope) {
    if (!result || !result.ok) return { message: result && result.error ? result.error : "Unable to prepare metadata change.", error: true, canApply: false };
    if (scope === "file") {
      const conflictText = result.conflicts.length
        ? ` ${result.conflicts.length} tune(s) already contain another value for this facet.`
        : "";
      return {
        message: result.changed
          ? `${result.changed} of ${result.total} tune(s) will change.${conflictText}`
          : `All ${result.total} tune(s) already contain this tag.`,
        canApply: result.changed > 0,
      };
    }
    const conflictText = result.changed && result.existingValues.length
      ? ` Existing value(s): ${result.existingValues.join(", ")}.`
      : "";
    return {
      message: result.changed ? `The active tune will change.${conflictText}` : "The active tune already contains this tag.",
      canApply: Boolean(result.changed),
    };
  }

  async function calculatePreview() {
    const token = ++previewToken;
    const scope = scopeSelect ? String(scopeSelect.value || "tune") : "tune";
    const facet = facetSelect ? facetSelect.value : "";
    const value = valueInput ? valueInput.value : "";
    if (!String(value || "").trim()) {
      setPreview("Enter a metadata value.");
      return null;
    }

    let result;
    if (scope === "file") {
      const filePath = activePath();
      if (!filePath) {
        setPreview("Open a Library file first.", { error: true });
        return null;
      }
      setPreview("Reading active file…");
      const readResult = await actions.readFile(filePath);
      if (token !== previewToken) return null;
      if (!readResult || !readResult.ok) {
        setPreview(readResult && readResult.error ? readResult.error : "Unable to read the active file.", { error: true });
        return null;
      }
      result = addFacetToAllTunes(String(readResult.data || ""), facet, value);
    } else {
      result = addFacetToTuneText(state.getEditorText ? state.getEditorText() : "", facet, value);
    }
    if (token !== previewToken) return null;
    const description = describeResult(result, scope);
    setPreview(description.message, description);
    return result;
  }

  async function apply() {
    const scope = scopeSelect ? String(scopeSelect.value || "tune") : "tune";
    const facet = facetSelect ? facetSelect.value : "";
    const value = valueInput ? valueInput.value : "";
    if (scope !== "file") {
      const result = addFacetToTuneText(state.getEditorText ? state.getEditorText() : "", facet, value);
      if (!result.ok || !result.changed) return;
      actions.applyCurrentTuneText(result.text);
      close();
      actions.setStatus("Library metadata added.");
      return;
    }

    const filePath = activePath();
    if (!filePath) return;
    if (!(await actions.requireCleanForFileOp(filePath, "updating Library metadata"))) return;
    try {
      let result;
      await actions.withFileLock(filePath, async () => {
        const readResult = await actions.readFile(filePath);
        if (!readResult || !readResult.ok) throw new Error(readResult && readResult.error ? readResult.error : "Unable to read the active file.");
        const before = String(readResult.data || "");
        result = addFacetToAllTunes(before, facet, value);
        if (!result.ok) throw new Error(result.error || "Unable to update Library metadata.");
        if (!result.changed) return;
        const writeResult = await actions.writeFile(filePath, result.text, { expectedData: before });
        if (!writeResult || !writeResult.ok) {
          if (writeResult && writeResult.conflict) throw new Error("The file changed on disk. Reopen it and try again.");
          throw new Error(writeResult && writeResult.error ? writeResult.error : "Unable to write the active file.");
        }
      });
      if (!result || !result.changed) return;
      const activeTune = state.getActiveTuneMeta ? state.getActiveTuneMeta() : null;
      const activeIndex = activeTune && Number.isFinite(Number(activeTune.indexInFile))
        ? Number(activeTune.indexInFile) - 1
        : 0;
      const updatedFile = await actions.refreshLibraryFile(filePath, { force: true });
      const updatedTune = updatedFile && Array.isArray(updatedFile.tunes) ? updatedFile.tunes[activeIndex] : null;
      if (updatedTune && updatedTune.id) await actions.selectTune(updatedTune.id, { skipConfirm: true, suppressRecent: true });
      close();
      actions.setStatus(`Library metadata added to ${result.changed} tune(s).`);
    } catch (error) {
      await actions.showSaveError(error && error.message ? error.message : String(error));
    }
  }

  function open() {
    if (!modal) return;
    if (state.isChordProEnabled && state.isChordProEnabled()) {
      actions.showToast("Library metadata editing is currently available for ABC files.", 2600);
      return;
    }
    if (!activePath()) {
      actions.showToast("Open a Library file first.", 2200);
      return;
    }
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    if (valueInput) valueInput.value = "";
    if (scopeSelect) scopeSelect.value = "tune";
    setPreview("Enter a metadata value.");
    try { valueInput.focus(); } catch {}
  }

  if (scopeSelect) scopeSelect.addEventListener("change", () => schedulePreview());
  if (facetSelect) facetSelect.addEventListener("change", () => schedulePreview());
  if (valueInput) valueInput.addEventListener("input", () => schedulePreview(180));
  if (closeButton) closeButton.addEventListener("click", close);
  if (cancelButton) cancelButton.addEventListener("click", close);
  if (applyButton) applyButton.addEventListener("click", () => { apply().catch(() => {}); });
  if (modal) {
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    });
    if (typeof actions.enableDraggableModal === "function") actions.enableDraggableModal(modal);
  }

  return { apply, calculatePreview, close, open };
}

export { createCatalogMetadataFeature };
