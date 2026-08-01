function createPayloadModeDecorations({
  ViewPlugin = null,
  buildPayloadLayerDecorations = () => [],
  getOptions = () => ({}),
  refreshEditor = () => {},
} = {}) {
  let version = 0;

  const plugin = ViewPlugin && typeof ViewPlugin.fromClass === "function"
    ? ViewPlugin.fromClass(class {
      constructor(view) {
        this.version = version;
        this.decorations = buildPayloadLayerDecorations(view.state, getOptions());
      }
      update(update) {
        if (update.docChanged || this.version !== version) {
          this.version = version;
          this.decorations = buildPayloadLayerDecorations(update.state, getOptions());
        }
      }
    }, {
      decorations: (v) => v.decorations,
    })
    : [];

  function refresh() {
    version += 1;
    refreshEditor();
  }

  return {
    plugin,
    refresh,
  };
}

export {
  createPayloadModeDecorations,
};
