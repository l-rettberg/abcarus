import {
  buildActiveTuneErrorContext,
  buildErrorEntry,
  buildErrorEntryKey,
  countErrorLineOffsetFromHeader,
  findErrorSourceRangeForMessage,
  getTextIndexFromLoc,
} from "./errors_model.js";

function createErrorsReporterController({
  collection,
  measureErrorState,
  safeBasename,
  isEnabled,
  isMeasureCheckEnabled,
  getActiveTuneMeta,
  getEditorText,
  getRenderPayload,
  getLastRenderPayload,
  findMeasureRangeAt,
  mapRenderIdxToEditorOffset,
  setMeasureErrorRanges,
  renderErrorList,
  showErrorsVisible,
  setScanErrors,
  getEntries,
} = {}) {
  let lineOffset = 0;
  let measureRenderRanges = [];

  function enabled() {
    return typeof isEnabled === "function" ? Boolean(isEnabled()) : true;
  }

  function entries() {
    if (typeof getEntries === "function") return getEntries();
    return collection && typeof collection.getEntries === "function" ? collection.getEntries() : [];
  }

  function refresh() {
    if (typeof renderErrorList === "function") renderErrorList();
    if (typeof showErrorsVisible === "function") showErrorsVisible(true);
    if (typeof setScanErrors === "function") setScanErrors(entries());
  }

  function clear() {
    if (collection && typeof collection.clear === "function") collection.clear();
    measureRenderRanges = [];
    if (typeof setMeasureErrorRanges === "function") setMeasureErrorRanges([]);
    if (typeof setScanErrors === "function") setScanErrors([]);
    if (typeof renderErrorList === "function") renderErrorList();
    if (typeof showErrorsVisible === "function") showErrorsVisible(false);
  }

  function setLineOffset(next) {
    lineOffset = Number.isFinite(next) ? Number(next) : 0;
  }

  function setLineOffsetFromHeader(headerText) {
    lineOffset = countErrorLineOffsetFromHeader(headerText);
  }

  function maybeAttachMeasureRange(entry, context) {
    const allowMeasureRange = !(context && context.skipMeasureRange);
    const measureCheckOk = typeof isMeasureCheckEnabled === "function" ? isMeasureCheckEnabled() : true;
    if (!allowMeasureRange || !entry || !entry.renderLoc || !/Bad measure duration/i.test(entry.message) || !measureCheckOk) return;

    const payload = (typeof getLastRenderPayload === "function" ? getLastRenderPayload() : null)
      || (typeof getRenderPayload === "function" ? getRenderPayload() : null);
    const renderText = payload && payload.text ? payload.text : (typeof getEditorText === "function" ? getEditorText() : "");
    const renderIdx = getTextIndexFromLoc(renderText, entry.renderLoc);
    if (!Number.isFinite(renderIdx) || typeof findMeasureRangeAt !== "function") return;

    const renderRange = findMeasureRangeAt(renderText, renderIdx);
    if (!renderRange || renderRange.end <= renderRange.start) return;

    const editorStart = typeof mapRenderIdxToEditorOffset === "function"
      ? mapRenderIdxToEditorOffset(renderRange.start)
      : renderRange.start;
    const editorEnd = typeof mapRenderIdxToEditorOffset === "function"
      ? mapRenderIdxToEditorOffset(renderRange.end)
      : renderRange.end;
    const editorRange = (editorStart >= 0 && editorEnd > editorStart)
      ? { start: editorStart, end: editorEnd }
      : null;
    entry.measureRange = editorRange;

    const renderDupe = measureRenderRanges.some((r) => r.start === renderRange.start && r.end === renderRange.end);
    if (!renderDupe) measureRenderRanges.push(renderRange);

    if (editorRange && measureErrorState && typeof measureErrorState.getRanges === "function") {
      const editorRanges = measureErrorState.getRanges();
      const dupe = editorRanges.some((r) => r.start === editorRange.start && r.end === editorRange.end);
      if (!dupe && typeof setMeasureErrorRanges === "function") {
        setMeasureErrorRanges([...editorRanges, editorRange]);
      }
    }
  }

  function add(message, locOverride, contextOverride) {
    if (!enabled() || !collection || typeof collection.add !== "function") return null;
    const baseContext = buildActiveTuneErrorContext(
      typeof getActiveTuneMeta === "function" ? getActiveTuneMeta() : null,
      { safeBasename }
    );
    const context = contextOverride
      ? { ...(baseContext || {}), ...contextOverride }
      : baseContext;
    const noRepeatCount = Boolean(context && context.noRepeatCount);
    const entry = buildErrorEntry(message, {
      locOverride,
      context,
      lineOffset,
    });

    if (!Number.isFinite(entry.errorStartOffset) || !Number.isFinite(entry.errorEndOffset) || entry.errorEndOffset <= entry.errorStartOffset) {
      const sourceRange = findErrorSourceRangeForMessage(
        typeof getEditorText === "function" ? getEditorText() : "",
        entry.message,
        entry.loc
      );
      if (sourceRange && Number.isFinite(sourceRange.start) && Number.isFinite(sourceRange.end) && sourceRange.end > sourceRange.start) {
        entry.errorStartOffset = sourceRange.start;
        entry.errorEndOffset = sourceRange.end;
      }
    }

    maybeAttachMeasureRange(entry, context);

    const key = buildErrorEntryKey(entry);
    const added = collection.add(entry, key, { noRepeatCount });
    refresh();
    return added.entry;
  }

  function log(message, loc, context) {
    if (!enabled()) return null;
    return add(message, loc, context);
  }

  return {
    add,
    clear,
    getMeasureRenderRanges: () => measureRenderRanges,
    log,
    setLineOffset,
    setLineOffsetFromHeader,
  };
}

export {
  createErrorsReporterController,
};
