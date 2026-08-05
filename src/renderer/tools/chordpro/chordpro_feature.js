import { parseChordProBlocks } from "./chordpro_model.js";

function countTextLinesExact(text) {
  const src = String(text || "");
  if (!src) return 0;
  return src.split(/\r\n|\n|\r/).length;
}

function createChordProFeature(host) {
  const h = host || {};
  const elements = h.elements || {};
  const lockElements = Array.isArray(h.lockElements) ? h.lockElements : [];
  const api = h.api || null;

  let mode = false;
  let fullView = false;
  let fullText = "";
  let blocks = [];
  let warnings = [];
  let activeIndex = 0;
  let parseTimer = null;
  let prevLibraryVisible = null;
  let prevHeaderCollapsed = null;
  let availabilityCache = null;
  let availabilityInFlight = null;

  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);
  const getEditorValue = () => String(call(h.getEditorValue) || "");
  const getEditorView = () => call(h.getEditorView) || null;
  const getCurrentDoc = () => call(h.getCurrentDoc) || null;
  const setCurrentDocContent = (content) => call(h.setCurrentDocContent, content);
  const setCurrentDoc = (doc) => call(h.setCurrentDoc, doc);
  const setSuppressDirty = (next) => call(h.setSuppressDirty, Boolean(next));
  const setEditorValue = (text) => call(h.setEditorValue, String(text || ""));
  const setEditorValueSilently = (text) => {
    setSuppressDirty(true);
    setEditorValue(text);
    setSuppressDirty(false);
  };
  const clearRenderOutput = (status) => call(h.clearRenderOutput, status);

  function setLibraryControlsDisabled(disabled) {
    const shouldDisable = Boolean(disabled || call(h.isPayloadMode));
    for (const el of lockElements) {
      if (el) el.disabled = shouldDisable;
    }
    if (elements.libraryTree) elements.libraryTree.classList.toggle("disabled", shouldDisable);
  }

  async function getAvailability({ force = false } = {}) {
    if (!api || typeof api.checkChordPro !== "function") {
      return { ok: false, error: "ChordPro check unavailable." };
    }
    if (!force && availabilityCache && availabilityCache.ok) return availabilityCache;
    if (availabilityInFlight) return availabilityInFlight;
    availabilityInFlight = (async () => {
      const res = await api.checkChordPro();
      availabilityCache = res || { ok: false, error: "ChordPro check failed." };
      availabilityInFlight = null;
      return availabilityCache;
    })();
    return availabilityInFlight;
  }

  async function ensureAvailable({ context = "using ChordPro", dialog = "open" } = {}) {
    const res = await getAvailability();
    if (res && res.ok) return true;
    const msg = res && res.error ? res.error : "ChordPro is not available.";
    if (dialog === "open") await call(h.showOpenError, msg);
    else await call(h.showSaveError, msg);
    call(h.logError, `${context} failed: ${msg}`);
    return false;
  }

  async function refreshPdfButtonState({ force = false } = {}) {
    const button = elements.pdfButton;
    if (!button) return;
    if (!mode) {
      button.disabled = true;
      button.title = "Preview PDF via ChordPro";
      return;
    }
    button.disabled = true;
    button.title = "Checking ChordPro CLI...";
    let res = null;
    try {
      res = await getAvailability({ force });
    } catch {
      res = { ok: false, error: "ChordPro check failed." };
    }
    if (!mode) return;
    if (res && res.ok) {
      button.disabled = false;
      button.title = "Preview PDF via ChordPro";
      return;
    }
    const msg = res && res.error ? String(res.error) : "ChordPro CLI is not available.";
    button.disabled = true;
    button.title = msg;
  }

  function getActiveBlock() {
    if (!mode || !Array.isArray(blocks) || !blocks.length) return null;
    const idx = Math.max(0, Math.min(blocks.length - 1, Number(activeIndex) || 0));
    return blocks[idx] || null;
  }

  function updateBadge() {
    if (!mode) return;
    if (!blocks.length) {
      call(h.setTuneMetaText, "ChordPro · no ABC blocks");
      return;
    }
    const active = getActiveBlock();
    const label = active && active.label ? ` · ${active.label}` : "";
    const prefix = fullView ? "ChordPro · full view" : "ChordPro · ABC";
    const count = fullView ? ` (${Number(activeIndex) + 1}/${blocks.length})` : ` ${Number(activeIndex) + 1}/${blocks.length}`;
    call(h.setTuneMetaText, `${prefix}${count}${label}`);
  }

  function updateSelectOptions() {
    const select = elements.tuneSelect;
    if (!select) return;
    select.textContent = "";
    if (!blocks.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "(No ABC blocks)";
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
      select.disabled = true;
      return;
    }
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      const option = document.createElement("option");
      option.value = String(i);
      const label = block && block.label ? `: ${block.label}` : "";
      option.textContent = `ABC ${i + 1}${label}`;
      select.appendChild(option);
    }
    select.disabled = false;
    const next = String(Math.max(0, Math.min(blocks.length - 1, Number(activeIndex) || 0)));
    select.value = next;
  }

  async function setActiveBlock(index, { scroll = false } = {}) {
    if (!mode) return false;
    const total = blocks.length;
    if (!total) return false;
    const next = Math.max(0, Math.min(total - 1, Number(index) || 0));
    if (next === activeIndex && !scroll) return true;
    if (next !== activeIndex) {
      const safe = await call(h.ensureSafeToAbandonCurrentDoc, "switching ChordPro ABC block");
      if (!safe) {
        updateSelectOptions();
        return false;
      }
    }
    activeIndex = next;
    updateSelectOptions();
    updateBadge();
    const block = getActiveBlock();
    if (block && !fullView) {
      setEditorValueSilently(String(block.text || ""));
      setCurrentDocContent(String(block.text || ""));
    } else if (scroll && block) {
      call(h.scrollToPosInEditor, block.startOffset, { y: "start" });
    }
    call(h.scheduleRenderNow, { clearOutput: true });
    return true;
  }

  function findBlockIndexAtOffset(offset) {
    if (!Array.isArray(blocks) || !blocks.length) return -1;
    const pos = Number(offset) || 0;
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (!block) continue;
      if (pos >= block.startOffset && pos <= block.endOffset) return i;
    }
    return -1;
  }

  function updateStateFromFullText(text, { allowScroll = false } = {}) {
    const parsed = parseChordProBlocks(text);
    blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
    warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    const editorView = getEditorView();
    if (editorView && blocks.length && fullView) {
      const cursor = editorView.state.selection.main.head;
      const idx = findBlockIndexAtOffset(cursor);
      if (idx >= 0) activeIndex = idx;
    }
    if (activeIndex >= blocks.length) activeIndex = Math.max(0, blocks.length - 1);
    updateSelectOptions();
    updateBadge();
    if (allowScroll && blocks.length) {
      const block = getActiveBlock();
      if (block) call(h.scrollToPosInEditor, block.startOffset, { y: "start" });
    }
  }

  function scheduleParse() {
    if (!mode) return;
    if (parseTimer) clearTimeout(parseTimer);
    parseTimer = setTimeout(() => {
      parseTimer = null;
      const nextText = fullView ? getEditorValue() : fullText;
      fullText = String(nextText || "");
      updateStateFromFullText(fullText);
    }, 150);
  }

  function applyActiveBlockEdit(blockText) {
    const block = getActiveBlock();
    if (!block) return;
    const prevText = String(block.text != null ? block.text : fullText.slice(block.startOffset, block.endOffset));
    let nextText = String(blockText || "");
    if (!nextText.endsWith("\n\n")) nextText = nextText.replace(/\r?\n?$/, "") + "\n\n";
    if (prevText === nextText) return;
    const prevLen = prevText.length;
    const nextLen = nextText.length;
    const delta = nextLen - prevLen;
    const prevLines = countTextLinesExact(prevText);
    const nextLines = countTextLinesExact(nextText);
    const deltaLines = nextLines - prevLines;
    fullText = `${fullText.slice(0, block.startOffset)}${nextText}${fullText.slice(block.endOffset)}`;
    block.text = nextText;
    block.endOffset = block.startOffset + nextLen;
    block.endLine = block.startLine + Math.max(0, nextLines - 1);
    if (delta || deltaLines) {
      for (let i = activeIndex + 1; i < blocks.length; i += 1) {
        const b = blocks[i];
        if (!b) continue;
        b.startOffset += delta;
        b.endOffset += delta;
        b.startLine += deltaLines;
        b.endLine += deltaLines;
      }
    }
  }

  function setMode(enabled) {
    const next = Boolean(enabled);
    if (mode === next) return;
    mode = next;
    document.body.classList.toggle("chordpro-mode", mode);
    if (mode) {
      prevLibraryVisible = Boolean(call(h.isLibraryVisible));
      call(h.setLibraryVisible, false, { persist: false });
      setLibraryControlsDisabled(true);
      if (elements.rawButton) elements.rawButton.classList.remove("toggle-active");
      if (prevHeaderCollapsed == null) prevHeaderCollapsed = Boolean(call(h.isHeaderCollapsed));
      call(h.setHeaderCollapsed, true);
      for (const el of [elements.newTuneButton, elements.templatesButton, elements.fileHeaderToggle, elements.fileHeaderSave, elements.fileHeaderReload]) {
        if (el) el.disabled = true;
      }
      refreshPdfButtonState().catch(() => {});
    } else {
      fullView = false;
      fullText = "";
      blocks = [];
      warnings = [];
      activeIndex = 0;
      if (parseTimer) {
        clearTimeout(parseTimer);
        parseTimer = null;
      }
      setLibraryControlsDisabled(false);
      if (prevLibraryVisible != null) call(h.setLibraryVisible, Boolean(prevLibraryVisible), { persist: false });
      prevLibraryVisible = null;
      if (elements.rawButton) elements.rawButton.classList.remove("toggle-active");
      if (prevHeaderCollapsed != null) {
        call(h.setHeaderCollapsed, Boolean(prevHeaderCollapsed));
        prevHeaderCollapsed = null;
      }
      for (const el of [elements.newTuneButton, elements.templatesButton, elements.fileHeaderToggle, elements.fileHeaderSave, elements.fileHeaderReload]) {
        if (el) el.disabled = false;
      }
      if (elements.pdfButton) {
        elements.pdfButton.disabled = true;
        elements.pdfButton.title = "Preview PDF via ChordPro";
      }
    }
    call(h.updateFileContext);
    call(h.updateSourceLinkPanel);
  }

  function setFullView(enabled) {
    if (!mode) return;
    const next = Boolean(enabled);
    if (fullView === next) return;
    const wasFull = fullView;
    if (!next && wasFull) {
      fullText = String(getEditorValue() || "");
      updateStateFromFullText(fullText, { allowScroll: false });
    }
    fullView = next;
    if (elements.rawButton) elements.rawButton.classList.toggle("toggle-active", fullView);
    if (fullView) {
      fullText = String(fullText || "");
      setEditorValueSilently(fullText);
      setCurrentDocContent(fullText);
      clearRenderOutput("ChordPro full view.");
    } else {
      const active = getActiveBlock();
      const blockText = active ? active.text : "";
      setEditorValueSilently(String(blockText || ""));
      setCurrentDocContent(String(blockText || ""));
      if (!active) clearRenderOutput("No ABC blocks.");
    }
    updateBadge();
    call(h.updatePlaybackInteractionLock);
    call(h.updatePlayButton);
    call(h.scheduleRenderNow, { clearOutput: true });
  }

  function handleEditorDocChanged(text) {
    if (!mode) return false;
    if (fullView) fullText = String(text || "");
    else applyActiveBlockEdit(text);
    scheduleParse();
    return true;
  }

  function handleSelectionOffset(offset) {
    if (!mode || !fullView) return false;
    const blockIdx = findBlockIndexAtOffset(offset);
    if (blockIdx >= 0 && blockIdx !== activeIndex) {
      setActiveBlock(blockIdx, { scroll: false });
      return true;
    }
    return false;
  }

  function applyTransformedText(nextText) {
    let text = String(nextText || "");
    if (mode && fullView && !text.endsWith("\n\n")) text = text.replace(/\r?\n?$/, "") + "\n\n";
    if (!mode) return text;
    if (fullView) fullText = text;
    else applyActiveBlockEdit(text);
    scheduleParse();
    return text;
  }

  function resetState() {
    fullView = false;
    fullText = "";
    blocks = [];
    warnings = [];
    activeIndex = 0;
    if (parseTimer) {
      clearTimeout(parseTimer);
      parseTimer = null;
    }
  }

  async function discardChanges() {
    if (!mode) return false;
    const currentDoc = getCurrentDoc();
    const filePath = currentDoc && currentDoc.path ? String(currentDoc.path) : "";
    if (!filePath) return false;
    const readRes = await call(h.readFile, filePath);
    if (!readRes || !readRes.ok) {
      call(h.showSaveError, (readRes && readRes.error) ? readRes.error : "Unable to reload ChordPro file.");
      return false;
    }
    const previousIndex = activeIndex;
    fullText = String(readRes.data || "");
    updateStateFromFullText(fullText);
    activeIndex = Math.max(0, Math.min(blocks.length - 1, previousIndex));
    const active = getActiveBlock();
    const content = fullView ? fullText : (active ? String(active.text || "") : fullText);
    setEditorValueSilently(content);
    setCurrentDocContent(content);
    call(h.markCurrentDocumentClean);
    call(h.setDirtyIndicator, false);
    updateSelectOptions();
    updateBadge();
    call(h.updateFileHeaderPanel);
    call(h.scheduleRenderNow, { clearOutput: true });
    return true;
  }

  async function open(filePath, content, { suppressRecent = false } = {}) {
    const p = String(filePath || "");
    if (!p) return { ok: false, error: "Missing file path." };
    let text = content;
    if (text == null) {
      const readRes = await call(h.readFile, p);
      if (!readRes || !readRes.ok) return { ok: false, error: (readRes && readRes.error) ? readRes.error : "Unable to read file." };
      text = readRes.data || "";
    }

    setMode(true);
    call(h.setRawModeUI, false);
    fullView = false;
    if (elements.rawButton) elements.rawButton.classList.remove("toggle-active");
    call(h.resetRawModeState);
    call(h.resetPlaybackState);
    call(h.clearErrors);
    call(h.beginFullFileModeContext, p, "chordpro_open");
    activeIndex = 0;
    fullText = String(text || "");
    updateStateFromFullText(fullText);
    const activeBlock = getActiveBlock();
    fullView = !activeBlock;
    if (elements.rawButton) elements.rawButton.classList.toggle("toggle-active", fullView);
    const blockText = activeBlock ? activeBlock.text : fullText;
    setEditorValueSilently(String(blockText || ""));

    const nextDoc = { path: p, content: String(blockText || ""), dirty: false };
    const currentDoc = getCurrentDoc();
    if (currentDoc) {
      currentDoc.path = nextDoc.path;
      currentDoc.content = nextDoc.content;
      currentDoc.dirty = false;
    } else {
      setCurrentDoc(nextDoc);
    }
    call(h.setDirtyIndicator, false);
    call(h.setFileNameMeta, call(h.stripFileExtension, call(h.safeBasename, p)));
    updateBadge();
    updateSelectOptions();
    call(h.updateFileHeaderPanel);
    call(h.updateHeaderStateUI);
    if (activeBlock) call(h.scheduleRenderNow, { clearOutput: true });
    else clearRenderOutput("No ABC blocks.");

    try {
      const avail = await getAvailability();
      if (!avail || !avail.ok) {
        call(h.showToast, "ChordPro preview is unavailable: set ChordPro binary/repo in Settings -> Advanced -> Options -> Tools -> Import/Export.", 4200);
      }
    } catch {}

    if (!suppressRecent && !call(h.suppressRecentEntries) && api && typeof api.addRecentFile === "function") {
      api.addRecentFile({ path: p, basename: call(h.safeBasename, p) });
    }

    return { ok: true };
  }

  async function exportPdf() {
    if (!mode) return;
    if (!api || typeof api.previewChordProPdf !== "function") return;
    const canUseChordPro = await ensureAvailable({ context: "Previewing a ChordPro PDF", dialog: "save" });
    if (!canUseChordPro) return;
    const filePath = call(h.getActiveFilePath) || (getCurrentDoc() && getCurrentDoc().path) || "";
    const content = String(fullView ? getEditorValue() : fullText || "");
    if (!content.trim()) {
      call(h.setStatus, "Nothing to preview.");
      return;
    }

    call(h.setStatus, "Previewing ChordPro PDF...");
    const res = await api.previewChordProPdf({ text: content, sourcePath: filePath });
    if (!res || !res.ok) {
      call(h.setStatus, "Error");
      await call(h.showSaveError, (res && res.error) ? res.error : "Unable to preview ChordPro PDF.");
      return;
    }
    call(h.setStatus, "OK");
    call(h.showToast, "ChordPro PDF preview opened.", 2000);
  }

  return {
    isEnabled: () => mode,
    isFullView: () => fullView,
    hasBlocks: () => Boolean(blocks.length),
    getFullText: () => fullText,
    getActiveIndex: () => activeIndex,
    getActiveBlock,
    setMode,
    setFullView,
    resetState,
    updateSelectOptions,
    setActiveBlock,
    findBlockIndexAtOffset,
    handleEditorDocChanged,
    handleSelectionOffset,
    applyTransformedText,
    discardChanges,
    getAvailability,
    refreshPdfButtonState,
    open,
    exportPdf,
  };
}

export { createChordProFeature };
