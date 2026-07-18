import {
  ViewPlugin,
} from "../../../third_party/codemirror/cm.js";
import {
  buildPracticeBarDecorations,
} from "../editor/range_decorations.js";

function createPracticeBarHighlightController({
  getOutElement,
  getRenderPane,
  getEditorView,
  findMeasureRangeAt,
  mapEditorOffsetToRenderIdx,
} = {}) {
  let practiceBarHighlightRange = null; // {from,to} editor offsets
  let practiceBarHighlightVersion = 0;
  let lastSvgPracticeBarEls = [];

  const plugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.version = practiceBarHighlightVersion;
      this.decorations = buildPracticeBarDecorations(view.state, practiceBarHighlightRange);
    }

    update(update) {
      if (update.docChanged) {
        try {
          this.decorations = this.decorations.map(update.changes);
        } catch {}
        if (practiceBarHighlightRange) {
          try {
            const max = update.state.doc.length;
            const mappedFrom = update.changes.mapPos(Number(practiceBarHighlightRange.from), 1);
            const mappedTo = update.changes.mapPos(Number(practiceBarHighlightRange.to), -1);
            const from = Math.max(0, Math.min(mappedFrom, max));
            const to = Math.max(from, Math.min(mappedTo, max));
            practiceBarHighlightRange = (to > from) ? { from, to } : null;
          } catch {}
        }
      }
      if (update.docChanged || update.selectionSet || this.version !== practiceBarHighlightVersion) {
        this.version = practiceBarHighlightVersion;
        this.decorations = buildPracticeBarDecorations(update.state, practiceBarHighlightRange);
      }
    }
  }, {
    decorations: (v) => v.decorations,
  });

  function clearSvgPracticeBarHighlight() {
    for (const el of lastSvgPracticeBarEls) {
      try { el.classList.remove("svg-practice-bar"); } catch {}
    }
    lastSvgPracticeBarEls = [];
  }

  function getSvgPracticeBarElements() {
    return lastSvgPracticeBarEls.slice();
  }

  function highlightSvgPracticeBarAtEditorOffset(editorOffset) {
    const out = typeof getOutElement === "function" ? getOutElement() : null;
    const renderPane = typeof getRenderPane === "function" ? getRenderPane() : null;
    const editorView = typeof getEditorView === "function" ? getEditorView() : null;
    if (!out || !renderPane) return false;
    if (!Number.isFinite(editorOffset)) return false;
    if (!editorView) return false;
    const editorText = editorView.state.doc.toString();
    const measure = findMeasureRangeAt(editorText, editorOffset);
    const barEls = measure ? Array.from(out.querySelectorAll(".bar-hl")) : [];
    if (measure && barEls.length) {
      const start = mapEditorOffsetToRenderIdx(measure.start);
      const end = mapEditorOffsetToRenderIdx(measure.end);
      const hits = barEls.filter((el) => {
        const s = Number(el.dataset && el.dataset.start);
        const e = Number(el.dataset && el.dataset.end);
        if (!Number.isFinite(s)) return false;
        const stop = Number.isFinite(e) ? e : s + 1;
        return s < end && stop > start;
      });
      if (hits.length) {
        clearSvgPracticeBarHighlight();
        lastSvgPracticeBarEls = hits;
        for (const el of lastSvgPracticeBarEls) {
          try { el.classList.add("svg-practice-bar"); } catch {}
        }
        return true;
      }
    }
    clearSvgPracticeBarHighlight();
    return false;
  }

  function setPracticeBarHighlight(range) {
    const next = range && Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from
      ? { from: range.from, to: range.to }
      : null;
    if (
      practiceBarHighlightRange
      && next
      && practiceBarHighlightRange.from === next.from
      && practiceBarHighlightRange.to === next.to
    ) return;
    if (!practiceBarHighlightRange && !next) return;
    practiceBarHighlightRange = next;
    practiceBarHighlightVersion += 1;
    const editorView = typeof getEditorView === "function" ? getEditorView() : null;
    if (!editorView) return;
    editorView.dispatch({
      selection: editorView.state.selection,
      scrollIntoView: false,
    });
  }

  return {
    plugin,
    clearSvgPracticeBarHighlight,
    getSvgPracticeBarElements,
    highlightSvgPracticeBarAtEditorOffset,
    setPracticeBarHighlight,
  };
}

export { createPracticeBarHighlightController };
