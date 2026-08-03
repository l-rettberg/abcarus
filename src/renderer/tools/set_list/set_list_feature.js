import {
  DEFAULT_SET_LIST_HEADER_TEXT,
  insertSetListItemAt,
  moveSetListItems,
  normalizeSetListPageBreaks,
  parseSetListSavedState,
  removeSetListItemAt,
  serializeSetListState,
} from "./set_list_model.js";
import { createSetListController } from "./set_list_controller.js";
import {
  buildSetListExportAbc,
  getSetListFileHeaderText,
  shouldInjectNewPageBeforeTune,
} from "../../print/set_list_markup.js";
import {
  buildPrintErrorCard,
  buildPrintErrorSummary,
} from "../../print/error_markup.js";

const DEFAULT_STORAGE_KEY = "abcarus.setList.v1";

function hasItems(items) {
  return Array.isArray(items) && items.length > 0;
}

function createSetListFeature({
  elements = {},
  storageKey = DEFAULT_STORAGE_KEY,
  readStorage = () => null,
  writeStorage = () => false,
  buildItemForTuneId = async () => null,
  renderItemToSvg = async () => ({ ok: false, error: "Render unavailable." }),
  buildSourceLinkMarkup = async () => "",
  outputPrint = async () => ({ ok: false, error: "Print unavailable." }),
  saveAbc = async () => false,
  getExportBaseName = () => "set-list",
  getPrintBaseName = () => "set-list",
  ensureXNumberInAbc = (text) => text,
  appendTuneToContent = (content, tune) => `${content || ""}${tune || ""}`,
  applyPrintDebugMarkup = (text) => text,
  sanitizeFileBaseName = (text) => String(text || ""),
  setStatus = () => {},
  showToast = () => {},
  logError = () => {},
  confirm = (message) => window.confirm(message),
  enableDraggable = null,
} = {}) {
  let items = [];
  let pageBreaks = "perTune";
  let compact = false;
  let headerText = DEFAULT_SET_LIST_HEADER_TEXT;
  let saveTimer = null;

  const getState = () => ({ items, pageBreaks, compact });
  const getHeaderText = () => headerText;

  const saveNow = () => {
    writeStorage(storageKey, serializeSetListState({
      items,
      pageBreaks,
      compact,
      headerText,
    }));
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveNow();
    }, 250);
  };

  const load = () => {
    const state = parseSetListSavedState(readStorage(storageKey));
    if (!state) return;
    pageBreaks = state.pageBreaks;
    compact = state.compact;
    headerText = state.headerText;
    items = state.items;
  };

  const getFileHeaderText = () => getSetListFileHeaderText(headerText);

  const shouldUseZeroPageMargins = () => {
    const header = String(headerText || "");
    const hasLeft0 = /^\s*%%\s*leftmargin\s+0(\s|$)/im.test(header);
    const hasRight0 = /^\s*%%\s*rightmargin\s+0(\s|$)/im.test(header);
    return hasLeft0 && hasRight0;
  };

  const controller = createSetListController({
    modal: elements.modal,
    closeButton: elements.closeButton,
    empty: elements.empty,
    itemsList: elements.itemsList,
    headerButton: elements.headerButton,
    clearButton: elements.clearButton,
    saveAbcButton: elements.saveAbcButton,
    exportPdfButton: elements.exportPdfButton,
    printButton: elements.printButton,
    pageBreaksSelect: elements.pageBreaksSelect,
    compactCheckbox: elements.compactCheckbox,
    headerModal: elements.headerModal,
    headerCloseButton: elements.headerCloseButton,
    headerText: elements.headerText,
    headerResetButton: elements.headerResetButton,
    headerSaveButton: elements.headerSaveButton,
    defaultHeaderText: DEFAULT_SET_LIST_HEADER_TEXT,
    getState,
    getHeaderText,
    onMoveItem: (fromIndex, toIndex) => {
      const next = moveSetListItems(items, fromIndex, toIndex);
      if (next === items) return;
      items = next;
      scheduleSave();
    },
    onRemoveItem: (index) => {
      const next = removeSetListItemAt(items, index);
      if (next === items) return;
      items = next;
      scheduleSave();
    },
    onAddTune: async (tuneId, options = {}) => {
      await addTuneById(tuneId, options);
    },
    onClear: () => {
      items = [];
      scheduleSave();
    },
    onPageBreaksChange: (value) => {
      pageBreaks = normalizeSetListPageBreaks(value, "perTune");
      scheduleSave();
    },
    onCompactChange: (value) => {
      compact = Boolean(value);
      scheduleSave();
    },
    onHeaderTextChange: (value) => {
      headerText = String(value || "");
      scheduleSave();
    },
    onSaveAbc: () => {
      exportAbc().catch(() => {});
    },
    onExportPdf: () => {
      runPrintAction("pdf").catch(() => {});
    },
    onPrint: () => {
      runPrintAction("print").catch(() => {});
    },
    confirm,
    showToast,
    enableDraggable,
  });

  const render = () => controller.render();
  const open = () => controller.open();
  const close = () => controller.close();
  const openHeaderEditor = () => controller.openHeaderEditor();
  const closeHeaderEditor = () => controller.closeHeaderEditor();

  const insertItem = (item, index) => {
    const next = insertSetListItemAt(items, item, index);
    if (next === items) return false;
    items = next;
    scheduleSave();
    render();
    return true;
  };

  async function addTuneById(tuneId, options = {}) {
    const id = String(tuneId || "").trim();
    if (!id) throw new Error("Missing tune id.");
    const item = await buildItemForTuneId(id, options);
    if (!item) return false;
    const entryId = `${id}::${Date.now()}::${Math.random().toString(16).slice(2)}`;
    return insertItem({
      id: entryId,
      sourceTuneId: id,
      sourcePath: item.sourcePath || "",
      xNumber: item.xNumber || "",
      title: item.title || options.fallbackTitle || "",
      composer: item.composer || options.fallbackComposer || "",
      headerText: item.headerText || "",
      text: item.text || "",
      addedAtMs: Date.now(),
    }, options.insertIndex);
  }

  const buildExportAbc = () => buildSetListExportAbc({
    items,
    headerText,
    pageBreaks,
    ensureXNumberInAbc,
    appendTuneToContent,
  });

  async function exportAbc() {
    if (!hasItems(items)) return false;
    const base = getExportBaseName();
    const suggestedName = `${base ? `${base}-` : ""}set-list.abc`;
    const content = buildExportAbc();
    if (!content.trim()) {
      showToast("Nothing to export.", 2400);
      return false;
    }
    const ok = await saveAbc({ suggestedName, content });
    if (ok) showToast("Exported.", 2400);
    return Boolean(ok);
  }

  async function renderSvgMarkupForPrint(options = {}) {
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const includeIssueCards = options.includeIssueCards !== false;
    const includeIssueSummary = options.includeIssueSummary !== false;
    if (!hasItems(items)) return { ok: false, error: "No tunes in Set List." };

    const entry = { basename: "Set List" };
    const blocks = [];
    let current = [];
    const summary = [];

    const flush = () => {
      if (!current.length) return;
      blocks.push(current);
      current = [];
    };

    const total = items.length;
    for (let i = 0; i < total; i += 1) {
      const item = items[i] || {};
      const raw = String(item.text || "");
      if (onProgress && (i % 5 === 0 || i === total - 1)) onProgress(i + 1, total);
      if (!raw.trim()) continue;

      const tune = {
        id: item.sourceTuneId || item.id || "",
        xNumber: String(i + 1),
        title: item.title || "",
        preview: item.title || `X:${i + 1}`,
      };

      const breakBefore = pageBreaks === "perTune"
        ? i > 0
        : shouldInjectNewPageBeforeTune(raw, { mode: pageBreaks, idx: i });
      if (breakBefore) flush();

      const renumbered = ensureXNumberInAbc(raw, i + 1);
      const combinedHeader = `${getFileHeaderText()}${item.headerText || ""}`;
      const renderRes = await renderItemToSvg({
        abcText: renumbered,
        headerText: combinedHeader,
        tune,
      });
      const tuneErrors = renderRes && renderRes.errors ? renderRes.errors.slice() : [];
      if (renderRes && !renderRes.ok && renderRes.error) tuneErrors.push({ message: renderRes.error });

      if (tuneErrors.length) {
        const uniqueKeys = new Set(tuneErrors.map((err) => {
          const msg = err && err.message ? err.message : "Unknown error";
          const loc = err && err.loc ? `Line ${err.loc.line}, Col ${err.loc.col}` : "";
          return `${msg}|${loc}`;
        }));
        summary.push({ tune, count: uniqueKeys.size });
        if (includeIssueCards) current.push(buildPrintErrorCard(entry, tune, tuneErrors).trim());
      }

      if (renderRes && renderRes.svg && renderRes.svg.trim()) current.push(renderRes.svg.trim());
      const sourceMarkup = await buildSourceLinkMarkup(renderRes && renderRes.blockText ? renderRes.blockText : renumbered);
      if (sourceMarkup) current.push(sourceMarkup);

      if (pageBreaks === "perTune") flush();
    }
    flush();

    if (!blocks.length) return { ok: false, error: "No SVG output produced." };

    const parts = [];
    if (includeIssueSummary && summary.length) {
      parts.push(buildPrintErrorSummary(entry, summary, total).trim());
    }
    for (const block of blocks) {
      parts.push(`<div class="print-tune">${block.join("\n")}</div>`);
    }
    const issues = {
      totalTunes: total,
      tunesWithIssues: summary.length,
      totalErrors: summary.reduce((sum, item) => sum + (Number.isFinite(Number(item.count)) ? Number(item.count) : 0), 0),
    };
    return { ok: true, svg: parts.join("\n"), issues };
  }

  async function runPrintAction(type) {
    if (!hasItems(items)) {
      setStatus("No Set List to print.");
      return false;
    }
    setStatus("Rendering…");
    const showIssuesInMarkup = type === "preview";
    const renderRes = await renderSvgMarkupForPrint({
      includeIssueCards: showIssuesInMarkup,
      includeIssueSummary: showIssuesInMarkup,
      onProgress: (current, total) => {
        setStatus(`Rendering tunes… ${current}/${total}`);
      },
    });
    if (!renderRes.ok) {
      setStatus("Error");
      logError(renderRes.error || "Unable to render.");
      return false;
    }

    let svgMarkup = applyPrintDebugMarkup(renderRes.svg);
    if (shouldUseZeroPageMargins()) {
      svgMarkup = `<!--abcarus:pdf-no-margins-->\n<style>body{padding:0 !important}</style>\n${svgMarkup}`;
    }
    if (compact) {
      svgMarkup = `<style>body{padding:12px !important}</style>\n${svgMarkup}`;
    }
    const suggestedName = sanitizeFileBaseName(`${getPrintBaseName() || "set-list"} - set-list`);
    const res = await outputPrint({ type, svgMarkup, suggestedName });
    if (res && res.ok) {
      setStatus("OK");
      if (type === "pdf" && res.path) {
        const issues = renderRes.issues || null;
        const suffix = (issues && issues.tunesWithIssues)
          ? ` (${issues.tunesWithIssues} tunes had issues; use Preview for details)`
          : "";
        showToast(`Exported PDF: ${res.path}${suffix}`);
      }
      return true;
    }
    if (res && res.error && res.error !== "Canceled") {
      setStatus("Error");
      logError(res.error);
    }
    return false;
  }

  load();

  return {
    addTuneById,
    buildExportAbc,
    close,
    closeHeaderEditor,
    exportAbc,
    getState,
    open,
    openHeaderEditor,
    render,
    renderSvgMarkupForPrint,
    runPrintAction,
  };
}

export {
  createSetListFeature,
};
