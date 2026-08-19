import {
  normalizeFacetName,
  normalizeFacetValue,
  replaceFacetInFileText,
  replacePlainHeaderFieldInFileText,
} from "./catalog_metadata_transform.js";

function normalizeCategoryDescriptor(category, fallbackFacet = "") {
  const facet = normalizeFacetName((category && category.facet) || fallbackFacet);
  if (facet) return { categoryType: `facet:${facet}`, facet };
  const field = String(category && category.field || "").trim().toUpperCase();
  if (/^(?:C|G)$/.test(field)) return { categoryType: `field:${field}`, field };
  return null;
}

function formatCategory(descriptor, value) {
  if (descriptor.facet) return `G:[${descriptor.facet}] ${value}`;
  return `${descriptor.field}:${value}`;
}

function tuneHasCategory(tune, descriptor, normalizedValue) {
  if (descriptor.facet) {
    const values = tune && tune.catalogFacets ? tune.catalogFacets[descriptor.facet] : null;
    return (Array.isArray(values) ? values : []).some((item) => normalizeFacetValue(item).normalize("NFC") === normalizedValue);
  }
  if (descriptor.field === "C") {
    const composers = Array.isArray(tune && tune.composers) && tune.composers.length
      ? tune.composers
      : [tune && tune.composer];
    return composers.some((item) => normalizeFacetValue(item).normalize("NFC") === normalizedValue);
  }
  const groups = Array.isArray(tune && tune.groups) ? tune.groups : [];
  return groups.some((item) => {
    const value = normalizeFacetValue(item);
    return !/^\[[A-Za-z][A-Za-z0-9_-]*\]\s*\S/.test(value) && value.normalize("NFC") === normalizedValue;
  });
}

function collectAffectedFilePaths(libraryIndex, category, value) {
  const descriptor = normalizeCategoryDescriptor(typeof category === "string" ? null : category, typeof category === "string" ? category : "");
  if (!descriptor) return [];
  const normalizedValue = normalizeFacetValue(value).normalize("NFC");
  const paths = [];
  for (const file of libraryIndex && Array.isArray(libraryIndex.files) ? libraryIndex.files : []) {
    const hasValue = (file.tunes || []).some((tune) => tuneHasCategory(tune, descriptor, normalizedValue));
    if (hasValue && file.path) paths.push(String(file.path));
  }
  return Array.from(new Set(paths)).sort((a, b) => a.localeCompare(b));
}

async function replaceCatalogCategoryTransaction({
  libraryIndex,
  category = null,
  facet,
  sourceValue,
  targetValue,
  readFile,
  writeFile,
  requireCleanForFileOp = async () => true,
  withFileLocks = async (_paths, operation) => operation(),
} = {}) {
  const descriptor = normalizeCategoryDescriptor(category, facet);
  const from = normalizeFacetValue(sourceValue).normalize("NFC");
  const to = normalizeFacetValue(targetValue).normalize("NFC");
  if (!descriptor || !from || !to) throw new Error("Category type, source value, and target value are required.");
  if (from === to) throw new Error("Choose a different category name.");

  const paths = collectAffectedFilePaths(libraryIndex, descriptor, from);
  if (!paths.length) throw new Error("No matching Library categories were found.");
  for (const filePath of paths) {
    if (!(await requireCleanForFileOp(filePath, "renaming a Library category"))) return { ok: false, cancelled: true };
  }

  return withFileLocks(paths, async () => {
    const plans = [];
    for (const filePath of paths) {
      const readResult = await readFile(filePath);
      if (!readResult || !readResult.ok) {
        throw new Error(`Unable to read ${filePath}: ${(readResult && readResult.error) || "unknown error"}`);
      }
      const before = String(readResult.data || "");
      const transformed = descriptor.facet
        ? replaceFacetInFileText(before, descriptor.facet, from, to)
        : replacePlainHeaderFieldInFileText(before, descriptor.field, from, to);
      if (!transformed.ok) throw new Error(transformed.error || `Unable to prepare ${filePath}.`);
      if (transformed.changed) plans.push({ filePath, before, after: transformed.text, tunesChanged: transformed.tunesChanged });
    }
    if (!plans.length) throw new Error("The category changed on disk. Refresh the Library and try again.");

    const written = [];
    try {
      for (const plan of plans) {
        const result = await writeFile(plan.filePath, plan.after, { expectedData: plan.before });
        if (!result || !result.ok) {
          const detail = result && result.conflict
            ? "the file changed on disk"
            : ((result && result.error) || "write failed");
          throw new Error(`Unable to update ${plan.filePath}: ${detail}`);
        }
        written.push(plan);
      }
    } catch (error) {
      const rollbackFailures = [];
      for (const plan of written.reverse()) {
        try {
          const rollback = await writeFile(plan.filePath, plan.before, { expectedData: plan.after });
          if (!rollback || !rollback.ok) rollbackFailures.push(plan.filePath);
        } catch {
          rollbackFailures.push(plan.filePath);
        }
      }
      if (rollbackFailures.length) {
        throw new Error(`${error.message}\n\nRollback also failed for:\n${rollbackFailures.join("\n")}`);
      }
      throw error;
    }

    return {
      ok: true,
      category: descriptor,
      facet: descriptor.facet || null,
      sourceValue: from,
      targetValue: to,
      filesChanged: plans.length,
      tunesChanged: plans.reduce((sum, plan) => sum + plan.tunesChanged, 0),
      paths: plans.map((plan) => plan.filePath),
    };
  });
}

function createCatalogCategoryMergeController({
  documentRef = typeof document !== "undefined" ? document : null,
  state = {},
  actions = {},
} = {}) {
  let modal = null;
  let sourceLabel = null;
  let targetInput = null;
  let summary = null;
  let applyButton = null;
  let pending = null;

  function close() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    pending = null;
  }

  function ensureModal() {
    if (modal || !documentRef || !documentRef.body) return;
    modal = documentRef.createElement("div");
    modal.className = "modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="modal-card library-category-merge-card" role="dialog" aria-modal="true" aria-label="Rename Library Category">
        <div class="modal-header">
          <div class="modal-title">Rename Library Category</div>
          <button class="modal-close" type="button" aria-label="Close" title="Close">&times;</button>
        </div>
        <div class="modal-body">
          <label class="library-metadata-row"><span>Current</span><input data-role="source" type="text" readonly></label>
          <label class="library-metadata-row"><span>Replace with</span><input data-role="target" type="text" autocomplete="off"></label>
          <div class="modal-status" data-role="summary" aria-live="polite"></div>
        </div>
        <div class="modal-footer">
          <button data-role="cancel" type="button">Cancel</button>
          <button data-role="apply" class="primary" type="button">Replace</button>
        </div>
      </div>`;
    documentRef.body.appendChild(modal);
    sourceLabel = modal.querySelector('[data-role="source"]');
    targetInput = modal.querySelector('[data-role="target"]');
    summary = modal.querySelector('[data-role="summary"]');
    applyButton = modal.querySelector('[data-role="apply"]');
    modal.querySelector(".modal-close").addEventListener("click", close);
    modal.querySelector('[data-role="cancel"]').addEventListener("click", close);
    targetInput.addEventListener("input", () => {
      applyButton.disabled = !targetInput.value.trim() || targetInput.value.trim() === (pending && pending.sourceValue);
    });
    applyButton.addEventListener("click", () => apply().catch(() => {}));
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
      if (event.key === "Enter" && !applyButton.disabled) apply().catch(() => {});
    });
    if (typeof actions.enableDraggableModal === "function") actions.enableDraggableModal(modal);
  }

  function open(source, target = null) {
    const descriptor = normalizeCategoryDescriptor(source);
    const sourceValue = normalizeFacetValue(source && source.value);
    const targetDescriptor = target ? normalizeCategoryDescriptor(target) : null;
    const targetValue = normalizeFacetValue(target && target.value);
    if (!descriptor || !sourceValue) return false;
    if (target && (!targetDescriptor || targetDescriptor.categoryType !== descriptor.categoryType)) {
      actions.showToast("Categories can only be merged within the same metadata field.", 3000);
      return false;
    }
    ensureModal();
    const count = Number(source && source.count) || 0;
    pending = { category: descriptor, sourceValue };
    summary.classList.remove("error");
    sourceLabel.value = formatCategory(descriptor, sourceValue);
    targetInput.value = targetValue || "";
    summary.textContent = `${count} tune(s) will be checked across all Library files. The operation is all-or-rollback.`;
    applyButton.disabled = !targetInput.value.trim() || targetInput.value.trim() === sourceValue;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    targetInput.focus();
    try { targetInput.select(); } catch {}
    return true;
  }

  async function apply() {
    if (!pending || applyButton.disabled) return;
    const targetValue = normalizeFacetValue(targetInput.value);
    applyButton.disabled = true;
    summary.classList.remove("error");
    summary.textContent = "Checking and updating Library files...";
    try {
      if (typeof actions.ensureFullLibraryIndex === "function") {
        await actions.ensureFullLibraryIndex({ reason: "renaming a Library category" });
      }
      const result = await replaceCatalogCategoryTransaction({
        libraryIndex: state.getLibraryIndex(),
        category: pending.category,
        sourceValue: pending.sourceValue,
        targetValue,
        readFile: actions.readFile,
        writeFile: actions.writeFile,
        requireCleanForFileOp: actions.requireCleanForFileOp,
        withFileLocks: actions.withFileLocks,
      });
      if (!result || !result.ok) {
        if (result && result.cancelled) close();
        return;
      }
      const activeTune = typeof state.getActiveTuneMeta === "function" ? state.getActiveTuneMeta() : null;
      let refreshedActive = null;
      for (const filePath of result.paths) {
        const refreshed = await actions.refreshLibraryFile(filePath, { force: true });
        if (activeTune && String(activeTune.path || "") === filePath) refreshedActive = refreshed;
      }
      const activeIndex = activeTune && Number.isFinite(Number(activeTune.indexInFile))
        ? Number(activeTune.indexInFile) - 1
        : -1;
      const refreshedTune = refreshedActive && activeIndex >= 0 && Array.isArray(refreshedActive.tunes)
        ? refreshedActive.tunes[activeIndex]
        : null;
      if (refreshedTune && refreshedTune.id && typeof actions.selectTune === "function") {
        await actions.selectTune(refreshedTune.id, { skipConfirm: true, suppressRecent: true });
      }
      actions.renderLibraryTree();
      actions.setStatus(`Replaced ${formatCategory(result.category, result.sourceValue)} in ${result.tunesChanged} tune(s) across ${result.filesChanged} file(s).`);
      close();
    } catch (error) {
      summary.textContent = "No changes were kept unless rollback was reported as failed.";
      summary.classList.add("error");
      await actions.showSaveError(error && error.message ? error.message : String(error));
      applyButton.disabled = false;
    }
  }

  return { close, open };
}

export {
  collectAffectedFilePaths,
  createCatalogCategoryMergeController,
  replaceCatalogCategoryTransaction,
};
