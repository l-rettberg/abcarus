import {
  ViewPlugin,
} from "../../../third_party/codemirror/cm.js";
import {
  buildErrorActivationDecorations,
} from "./range_decorations.js";

function createErrorsActivationHighlightPlugin(highlightState) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.version = highlightState.getVersion();
      this.decorations = buildErrorActivationDecorations(view.state, highlightState.getRange());
    }

    update(update) {
      if (update.docChanged && highlightState.hasActive() && highlightState.getRange()) {
        try {
          highlightState.mapRange(update.changes, update.state.doc.length);
        } catch {}
      }
      if (update.docChanged) {
        try {
          this.decorations = this.decorations.map(update.changes);
        } catch {}
      }
      if (this.version !== highlightState.getVersion()) {
        this.version = highlightState.getVersion();
        this.decorations = buildErrorActivationDecorations(update.state, highlightState.getRange());
      }
    }
  }, {
    decorations: (value) => value.decorations,
  });
}

export {
  createErrorsActivationHighlightPlugin,
};
