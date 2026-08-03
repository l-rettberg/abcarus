import { createIntonationRendererBridge } from "../tools/intonation_explorer/intonation_renderer_bridge.js";

function isMicrotonalNotationSupported(settings) {
  return Boolean(settings && (
    settings.supportMicrotonalNotation
    || settings.makamToolsEnabled
    || settings.studyToolsEnabled
  ));
}

function createMicrotonalDomain({
  api = null,
  documentRef = typeof document !== "undefined" ? document : null,
  navigatorRef = typeof navigator !== "undefined" ? navigator : null,
  ViewPlugin,
  state = {},
  host = {},
} = {}) {
  let microtonalTools = null;
  let intonationExplorer = null;
  let featuresPromise = null;

  const rendererBridge = createIntonationRendererBridge({
    ViewPlugin,
    getEditorView: host.getEditorView,
    getOutputElement: host.getOutputElement,
    findMeasureRangeAt: host.findMeasureRangeAt,
    mapEditorOffsetToRenderIdx: host.mapEditorOffsetToRenderIdx,
    maybeScrollRenderToNote: host.maybeScrollRenderToNote,
    isRawMode: state.isRawMode,
    isPayloadMode: state.isPayloadMode,
  });

  function getById(id) {
    return documentRef && typeof documentRef.getElementById === "function"
      ? documentRef.getElementById(id)
      : null;
  }

  function logError(error) {
    if (typeof host.logError !== "function") return;
    host.logError(error && error.message ? error.message : String(error));
  }

  function showToast(message, timeout) {
    if (typeof host.showToast === "function") host.showToast(message, timeout);
  }

  function resolveActiveTune(snapshot) {
    if (typeof host.resolveTuneEntryFromSnapshot !== "function") return null;
    const activeTuneMeta = typeof state.getActiveTuneMeta === "function"
      ? state.getActiveTuneMeta()
      : null;
    return host.resolveTuneEntryFromSnapshot(snapshot, {
      tuneUid: typeof state.getActiveTuneUid === "function" ? state.getActiveTuneUid() : "",
      tuneIndex: typeof state.getActiveTuneIndex === "function" ? state.getActiveTuneIndex() : -1,
      startOffset: activeTuneMeta && activeTuneMeta.startOffset,
    });
  }

  async function ensureFeatures() {
    if (intonationExplorer) return intonationExplorer;
    if (featuresPromise) return featuresPromise;

    featuresPromise = Promise.all([
      import("../tools/microtonal/microtonal_tools_feature.js"),
      import("../tools/intonation_explorer/intonation_explorer_feature.js"),
      import("./perde_service.js"),
    ]).then(([
      { createMicrotonalToolsFeature },
      { createIntonationExplorerFeature },
      { createPerdeService },
    ]) => {
      microtonalTools = createMicrotonalToolsFeature({
        makamDna: {
          modal: getById("makamDnaModal"),
          closeButton: getById("makamDnaClose"),
          cancelButton: getById("makamDnaCancel"),
          editor: getById("makamDnaEditor"),
          status: getById("makamDnaStatus"),
          resetBuiltinButton: getById("makamDnaResetBuiltin"),
          saveButton: getById("makamDnaSave"),
        },
        api,
        enableDraggable: host.enableDraggableModal,
        logError,
        showToast,
        onMakamDnaChanged: async () => {
          if (!intonationExplorer) return;
          intonationExplorer.populateMakams();
          if (intonationExplorer.isVisible()) {
            try {
              await intonationExplorer.refresh();
            } catch (error) {
              logError(error);
            }
          }
        },
      });

      intonationExplorer = createIntonationExplorerFeature({
        elements: {
          document: documentRef,
        },
        host: {
          clearSvgBarHighlight: rendererBridge.clearSvgBarHighlight,
          clearSvgNoteHighlight: rendererBridge.clearSvgNoteHighlight,
          enableDraggableToolPanel: host.enableDraggableToolPanel,
          ensureToolPanelDefaultLeftPosition: host.ensureToolPanelDefaultLeftPosition,
          focusEditorAt: rendererBridge.focusEditorAt,
          getSelectionScope: rendererBridge.getSelectionScope,
          highlightBarsAtOffsets: rendererBridge.highlightBarsAtOffsets,
          highlightNotesAtOffsets: rendererBridge.highlightNotesAtOffsets,
          isPerfEnabled: host.isPerfEnabled,
          isRawMode: state.isRawMode,
          logError,
          logPerf: host.logPerf,
          nowMs: host.nowMs,
          refreshActiveTuneSnapshot: host.refreshActiveTuneSnapshot,
          resolveActiveTune,
          scrollToCurrentHighlight: rendererBridge.scrollToCurrentHighlight,
          setHighlightRanges: rendererBridge.setHighlightRanges,
          showToast,
        },
        microtonalTools,
        perdeService: createPerdeService(),
        clipboard: navigatorRef && navigatorRef.clipboard ? navigatorRef.clipboard : null,
      });
      intonationExplorer.wire();
      return intonationExplorer;
    });

    try {
      return await featuresPromise;
    } catch (error) {
      featuresPromise = null;
      throw error;
    }
  }

  function closeExplorer() {
    if (intonationExplorer) intonationExplorer.close();
    if (microtonalTools) microtonalTools.closeMakamDnaModal();
  }

  function applySettings(settings) {
    if (!isMicrotonalNotationSupported(settings)) closeExplorer();
  }

  async function toggleExplorer() {
    const settings = typeof state.getSettings === "function" ? state.getSettings() : null;
    if (settings != null && !isMicrotonalNotationSupported(settings)) {
      showToast(
        "Microtonal notation support is disabled. Enable Settings → Options → Tools → Microtonal notation.",
        4800,
      );
      return false;
    }
    try {
      const explorer = await ensureFeatures();
      const latestSettings = typeof state.getSettings === "function" ? state.getSettings() : null;
      if (latestSettings != null && !isMicrotonalNotationSupported(latestSettings)) {
        closeExplorer();
        return false;
      }
      explorer.toggle();
      return true;
    } catch (error) {
      logError(error);
      showToast("Unable to open Intonation Explorer.", 4800);
      return false;
    }
  }

  return {
    applySettings,
    closeExplorer,
    editorExtension: rendererBridge.plugin,
    isExplorerVisible: () => Boolean(intonationExplorer && intonationExplorer.isVisible()),
    isSupported: isMicrotonalNotationSupported,
    toggleExplorer,
  };
}

export {
  createMicrotonalDomain,
  isMicrotonalNotationSupported,
};
