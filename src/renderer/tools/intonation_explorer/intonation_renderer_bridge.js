import { buildIntonationHighlightDecorations } from "../../editor/range_decorations.js";

function createIntonationRendererBridge({
  ViewPlugin,
  getEditorView = () => null,
  getOutputElement = () => null,
  findMeasureRangeAt = () => null,
  mapEditorOffsetToRenderIdx = (offset) => offset,
  maybeScrollRenderToNote = () => {},
  isRawMode = () => false,
  isPayloadMode = () => false,
} = {}) {
  let highlightRanges = [];
  let highlightVersion = 0;
  let lastSvgBarEls = [];
  let lastSvgNoteEls = [];

  function refreshEditor() {
    const editorView = getEditorView();
    if (!editorView) return;
    editorView.dispatch({
      selection: editorView.state.selection,
      scrollIntoView: false,
    });
  }

  const plugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.version = highlightVersion;
      this.decorations = buildIntonationHighlightDecorations(view.state, highlightRanges);
    }
    update(update) {
      if (update.docChanged || this.version !== highlightVersion) {
        this.version = highlightVersion;
        this.decorations = buildIntonationHighlightDecorations(update.state, highlightRanges);
      }
    }
  }, {
    decorations: (v) => v.decorations,
  });

  function setHighlightRanges(ranges) {
    highlightRanges = Array.isArray(ranges) ? ranges : [];
    highlightVersion += 1;
    refreshEditor();
  }

  function clearSvgBarHighlight() {
    if (!lastSvgBarEls || !lastSvgBarEls.length) return;
    for (const el of lastSvgBarEls) {
      try { el.classList.remove("svg-intonation-bar"); } catch {}
    }
    lastSvgBarEls = [];
  }

  function clearSvgNoteHighlight() {
    if (!lastSvgNoteEls || !lastSvgNoteEls.length) return;
    for (const el of lastSvgNoteEls) {
      try { el.classList.remove("svg-intonation-note"); } catch {}
    }
    lastSvgNoteEls = [];
  }

  function getSelectionScope() {
    const editorView = getEditorView();
    if (!editorView || isRawMode() || isPayloadMode()) return null;
    try {
      const sel = editorView.state && editorView.state.selection ? editorView.state.selection.main : null;
      if (!sel || sel.empty) return null;
      const docLen = editorView.state && editorView.state.doc ? editorView.state.doc.length : 0;
      const start = Math.max(0, Math.min(docLen, Math.min(sel.anchor, sel.head)));
      const end = Math.max(start, Math.min(docLen, Math.max(sel.anchor, sel.head)));
      if (end <= start) return null;
      const selectedText = editorView.state.doc.sliceString(start, end);
      if (!/[A-Ga-gxzZ]/.test(selectedText)) return null;
      return { start, end, label: "selection" };
    } catch {
      return null;
    }
  }

  function highlightBarsAtOffsets(offsets) {
    const outputElement = getOutputElement();
    const editorView = getEditorView();
    if (!outputElement || !editorView) return false;
    const list = Array.isArray(offsets) ? offsets.filter((n) => Number.isFinite(n)) : [];
    if (!list.length) {
      clearSvgBarHighlight();
      return false;
    }
    const editorText = editorView.state.doc.toString();
    const measures = new Map();
    for (const offset of list) {
      const measure = findMeasureRangeAt(editorText, offset);
      if (!measure) continue;
      const key = `${measure.start}:${measure.end}`;
      if (!measures.has(key)) measures.set(key, measure);
    }
    const uniqMeasures = Array.from(measures.values());
    const barEls = uniqMeasures.length ? Array.from(outputElement.querySelectorAll(".bar-hl")) : [];
    if (!uniqMeasures.length || !barEls.length) {
      clearSvgBarHighlight();
      return false;
    }
    const hits = new Set();
    for (const measure of uniqMeasures) {
      const start = mapEditorOffsetToRenderIdx(measure.start);
      const end = mapEditorOffsetToRenderIdx(measure.end);
      for (const el of barEls) {
        const s = Number(el.dataset && el.dataset.start);
        const e = Number(el.dataset && el.dataset.end);
        if (!Number.isFinite(s)) continue;
        const stop = Number.isFinite(e) ? e : s + 1;
        if (s < end && stop > start) hits.add(el);
      }
    }
    clearSvgBarHighlight();
    lastSvgBarEls = Array.from(hits);
    for (const el of lastSvgBarEls) {
      try { el.classList.add("svg-intonation-bar"); } catch {}
    }
    return lastSvgBarEls.length > 0;
  }

  function highlightNotesAtOffsets(offsets) {
    const outputElement = getOutputElement();
    if (!outputElement) return false;
    const list = Array.isArray(offsets) ? offsets.filter((n) => Number.isFinite(n)) : [];
    clearSvgNoteHighlight();
    if (!list.length) return false;

    const hits = new Set();
    const maxHits = 800;
    const maxBack = 120;
    for (const editorOffset of list) {
      if (hits.size >= maxHits) break;
      const renderIdx = mapEditorOffsetToRenderIdx(Number(editorOffset));
      if (!Number.isFinite(renderIdx)) continue;
      let els = outputElement.querySelectorAll("._" + renderIdx + "_");
      if ((!els || !els.length) && Number.isFinite(renderIdx)) {
        for (let d = 1; d <= maxBack; d += 1) {
          const probe = renderIdx - d;
          if (probe < 0) break;
          els = outputElement.querySelectorAll("._" + probe + "_");
          if (els && els.length) break;
        }
      }
      if (!els || !els.length) continue;
      for (const el of Array.from(els)) {
        if (hits.size >= maxHits) break;
        if (!el) continue;
        if (el.classList && el.classList.contains("note-hl")) {
          hits.add(el);
          continue;
        }
        const noteEls = el.querySelectorAll ? el.querySelectorAll(".note-hl") : [];
        if (noteEls && noteEls.length) {
          for (const n of Array.from(noteEls)) {
            if (hits.size >= maxHits) break;
            hits.add(n);
          }
        }
      }
    }

    lastSvgNoteEls = Array.from(hits);
    for (const el of lastSvgNoteEls) {
      try { el.classList.add("svg-intonation-note"); } catch {}
    }
    return lastSvgNoteEls.length > 0;
  }

  function focusEditorAt(offset) {
    const editorView = getEditorView();
    if (!editorView || !Number.isFinite(offset)) return;
    const docLen = editorView.state && editorView.state.doc ? editorView.state.doc.length : 0;
    const safeOff = Math.max(0, Math.min(docLen, offset));
    editorView.dispatch({ selection: { anchor: safeOff, head: safeOff }, scrollIntoView: true });
    try { editorView.focus(); } catch {}
  }

  function scrollToCurrentHighlight() {
    const note = lastSvgNoteEls && lastSvgNoteEls.length ? lastSvgNoteEls[0] : null;
    const bar = lastSvgBarEls && lastSvgBarEls.length ? lastSvgBarEls[0] : null;
    if (note) maybeScrollRenderToNote(note);
    else if (bar) maybeScrollRenderToNote(bar);
  }

  return {
    clearSvgBarHighlight,
    clearSvgNoteHighlight,
    focusEditorAt,
    getSelectionScope,
    highlightBarsAtOffsets,
    highlightNotesAtOffsets,
    plugin,
    scrollToCurrentHighlight,
    setHighlightRanges,
  };
}

export {
  createIntonationRendererBridge,
};
