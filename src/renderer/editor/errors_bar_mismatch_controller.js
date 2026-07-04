import {
  ViewPlugin,
} from "../../../third_party/codemirror/cm.js";
import {
  buildBarMismatchDecorations,
} from "./range_decorations.js";

function createErrorsBarMismatchController({
  dispatchEditorRefresh,
} = {}) {
  let markers = [];
  let version = 0;

  function mapMarkers(changes, docLength) {
    if (!markers.length || !changes) return;
    const max = Math.max(0, Number(docLength) || 0);
    const mapped = [];
    for (const marker of markers) {
      if (!marker || !Number.isFinite(marker.offset)) continue;
      const nextOffset = changes.mapPos(Number(marker.offset), 1);
      if (!Number.isFinite(nextOffset)) continue;
      const clamped = Math.max(0, Math.min(max, nextOffset));
      mapped.push({ ...marker, offset: clamped });
    }
    markers = mapped;
  }

  const plugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.version = version;
      this.decorations = buildBarMismatchDecorations(view.state, markers);
    }

    update(update) {
      if (update.docChanged) {
        try {
          mapMarkers(update.changes, update.state.doc.length);
        } catch {}
      }
      if (update.docChanged || this.version !== version) {
        this.version = version;
        this.decorations = buildBarMismatchDecorations(update.state, markers);
      }
    }
  }, {
    decorations: (value) => value.decorations,
  });

  function setMarkers(nextMarkers) {
    markers = Array.isArray(nextMarkers) ? nextMarkers : [];
    version += 1;
    if (typeof dispatchEditorRefresh === "function") dispatchEditorRefresh();
  }

  return {
    getMarkers: () => markers,
    plugin,
    setMarkers,
  };
}

export {
  createErrorsBarMismatchController,
};
