function setUiFontsFromSettings({
  documentRef = typeof document !== "undefined" ? document : null,
  settings = null,
  libraryTree = null,
} = {}) {
  const root = documentRef && documentRef.documentElement ? documentRef.documentElement : null;
  if (!root) return;
  const family = settings && typeof settings.uiFontFamily === "string" ? settings.uiFontFamily.trim() : "";
  const size = settings && Number.isFinite(Number(settings.uiFontSize)) ? Number(settings.uiFontSize) : NaN;
  const libraryFamily = settings && typeof settings.libraryUiFontFamily === "string" ? settings.libraryUiFontFamily.trim() : "";
  const librarySize = settings && Number.isFinite(Number(settings.libraryUiFontSize)) ? Number(settings.libraryUiFontSize) : NaN;
  try {
    if (family) root.style.setProperty("--font-family-ui", family);
    else root.style.removeProperty("--font-family-ui");
  } catch {}
  try {
    if (Number.isFinite(size) && size > 0) root.style.setProperty("--font-size-ui", `${Math.round(size)}px`);
    else root.style.removeProperty("--font-size-ui");
  } catch {}
  try {
    if (libraryFamily) root.style.setProperty("--library-font-family", libraryFamily);
    else root.style.removeProperty("--library-font-family");
  } catch {}
  try {
    if (Number.isFinite(librarySize) && librarySize > 0) root.style.setProperty("--library-font-size", `${Math.round(librarySize)}px`);
    else root.style.removeProperty("--library-font-size");
  } catch {}

  try {
    if (libraryTree) {
      libraryTree.style.fontFamily = libraryFamily || "";
      libraryTree.style.fontSize = (Number.isFinite(librarySize) && librarySize > 0) ? `${Math.round(librarySize)}px` : "";
    }
  } catch {}
}

function setEditorHelpFromSettings({
  settings = null,
  reconfigureEditor = () => {},
} = {}) {
  const enabled = settings ? Boolean(settings.editorHelpEnabled) : true;
  try {
    reconfigureEditor({
      completionEnabled: enabled,
      hoverEnabled: enabled,
    });
  } catch {}
}

export {
  setEditorHelpFromSettings,
  setUiFontsFromSettings,
};
