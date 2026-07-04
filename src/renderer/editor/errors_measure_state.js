import {
  ViewPlugin,
} from "../../../third_party/codemirror/cm.js";
import {
  buildMeasureErrorDecorations,
} from "./range_decorations.js";

function createMeasureErrorState() {
  let ranges = [];
  let version = 0;

  const plugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.version = version;
      this.decorations = buildMeasureErrorDecorations(view.state, ranges);
    }

    update(update) {
      if (update.docChanged) {
        try {
          this.decorations = this.decorations.map(update.changes);
        } catch {}
        if (ranges && ranges.length) {
          try {
            const max = update.state.doc.length;
            const mapped = [];
            for (const r of ranges) {
              const start = update.changes.mapPos(Number(r.start), 1);
              const end = update.changes.mapPos(Number(r.end), -1);
              const s = Math.max(0, Math.min(start, max));
              const e = Math.max(s, Math.min(end, max));
              if (e > s) mapped.push({ start: s, end: e });
            }
            ranges = mapped;
          } catch {}
        }
      }
      if (update.docChanged || update.selectionSet || this.version !== version) {
        this.version = version;
        this.decorations = buildMeasureErrorDecorations(update.state, ranges);
      }
    }
  }, {
    decorations: (v) => v.decorations,
  });

  function getRanges() {
    return ranges;
  }

  function setRanges(nextRanges) {
    ranges = Array.isArray(nextRanges) ? nextRanges : [];
    version += 1;
  }

  return {
    getRanges,
    plugin,
    setRanges,
  };
}

export {
  createMeasureErrorState,
};
