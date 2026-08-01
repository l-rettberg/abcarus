import { buildDefaultDrumVelocityMap } from "../drums.js";
import { openAbcHelperAtCursor } from "./abc_helpers_controller.js";
import { parseDecorationCatalogEnrichment } from "./abc_helpers_model.js";

export function createAbcHelpersFeature({
  windowRef,
  api,
  readFile = async () => null,
  EditorSelection,
  enableDraggableFixedPopover,
  showToast = () => {},
  isInlineFieldOnlyLine = () => false,
  renderAbcToSvgMarkup = null,
} = {}) {
  let decorationCatalogEnrichment = null;
  let decorationCatalogEnrichmentTried = false;
  let drumVelocityMap = buildDefaultDrumVelocityMap();

  async function loadDecorationCatalogEnrichment() {
    if (decorationCatalogEnrichmentTried) return decorationCatalogEnrichment;
    decorationCatalogEnrichmentTried = true;

    try {
      if (!api || typeof api.pathJoin !== "function" || typeof api.pathDirname !== "function") return null;
      const href = String(windowRef && windowRef.location && windowRef.location.href
        ? windowRef.location.href
        : "");
      if (!href.startsWith("file://")) return null;
      const rendererPath = decodeURIComponent(new URL(href).pathname || "");
      if (!rendererPath.includes("/src/renderer/")) return null;
      const rendererDir = api.pathDirname(rendererPath);
      const srcDir = api.pathDirname(rendererDir);
      const rootDir = api.pathDirname(srcDir);
      const jsonPath = api.pathJoin(
        rootDir,
        "kitchen",
        "derived",
        "abc2svg-decorations-catalog.json"
      );
      const result = await readFile(jsonPath);
      if (!result || !result.ok || !result.data) return null;
      decorationCatalogEnrichment = parseDecorationCatalogEnrichment(result.data);
      return decorationCatalogEnrichment;
    } catch {
      return null;
    }
  }

  function openAtCursor(view) {
    return openAbcHelperAtCursor({
      view,
      EditorSelection,
      enableDraggableFixedPopover,
      showToast,
      drumVelocityMap,
      isInlineFieldOnlyLine,
      renderAbcToSvgMarkup,
      loadDecorationCatalogEnrichment,
    });
  }

  return {
    openAtCursor,
    setDrumVelocityMap(next) {
      drumVelocityMap = next || buildDefaultDrumVelocityMap();
    },
  };
}
