import { buildAbDecorations } from "../editor/range_decorations.js";

export function createAbMarkerExtension({
  ViewPlugin,
  runtime,
} = {}) {
  if (!ViewPlugin || !runtime) return null;

  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.version = runtime.getMarkerVersion();
      this.decorations = buildAbDecorations(view.state, runtime.getMarkers());
    }

    update(update) {
      if (
        update.docChanged
        || update.selectionSet
        || this.version !== runtime.getMarkerVersion()
      ) {
        this.version = runtime.getMarkerVersion();
        this.decorations = buildAbDecorations(update.state, runtime.getMarkers());
      }
    }
  }, {
    decorations: (plugin) => plugin.decorations,
  });
}
