import { createPayloadModeController } from "./payload_mode_controller.js";
import {
  buildPlaybackPayloadForDiagnosticsFromRenderText,
  computePayloadTuneOffset,
} from "./payload_mode_model.mjs";

export function createPayloadModeFeature({
  elements = {},
  lockElements = [],
  getCopyText = () => ({ text: "", selectionText: "" }),
  hasEditor = () => false,
  getEditorText = () => "",
  getEditorSelection = () => null,
  setEditorText = () => {},
  setEditorReadOnly = () => {},
  setEditorCursor = () => {},
  restoreEditorSelection = () => {},
  getActiveTuneUid = () => "",
  isRawMode = () => false,
  isFocusModeEnabled = () => false,
  getHeaderText = () => "",
  sanitizeHeaderText = (text) => text,
  buildHeaderPrefixWithLayerSpans = () => ({ text: "", spans: [] }),
  playbackPayloadTransforms = {},
  stopPlayback = () => {},
  resetPlaybackState = () => {},
  clearBarMismatchMarkers = () => {},
  refreshLayerDecorations = () => {},
  scheduleRender = () => {},
  scheduleLibraryTree = () => {},
  showToast = () => {},
  setStatus = () => {},
} = {}) {
  let enabled = false;
  let source = null;
  let layerSpans = [];
  let showLayers = false;
  let view = "render";
  let renderState = null;
  let playbackState = null;

  const normalizeSpans = (spans) => Array.isArray(spans) ? spans : [];
  const getView = () => view;
  const isEnabled = () => enabled;
  const isPlaybackView = () => view === "playback";

  const controller = createPayloadModeController({
    bar: elements.bar,
    renderTab: elements.renderTab,
    playbackTab: elements.playbackTab,
    copyButton: elements.copyButton,
    exitButton: elements.exitButton,
    lockElements,
    getView,
    getCopyText,
    onExit: () => exit(),
    onSetView: (nextView) => setView(nextView),
    showToast,
  });

  const getLayerDecorationOptions = () => ({
    payloadMode: enabled,
    showLayers,
    layerSpans,
  });

  const buildPlaybackPayload = (renderText, renderOffset) => {
    const transforms = playbackPayloadTransforms || {};
    const expandRepeatsRaw = transforms.expandRepeats;
    const expandRepeats = typeof expandRepeatsRaw === "function"
      ? Boolean(expandRepeatsRaw())
      : Boolean(expandRepeatsRaw);
    return buildPlaybackPayloadForDiagnosticsFromRenderText(renderText, renderOffset, {
      injectGchordOn: transforms.injectGchordOn,
      normalizeDollarLineBreaksForPlayback: transforms.normalizeDollarLineBreaksForPlayback,
      normalizeBlankLinesForPlayback: transforms.normalizeBlankLinesForPlayback,
      normalizeReadableMidiDrumsForPlayback: transforms.normalizeReadableMidiDrumsForPlayback,
      sanitizeAbcForPlayback: transforms.sanitizeAbcForPlayback,
      expandRepeatsForPlayback: transforms.expandRepeatsForPlayback,
      expandRepeats,
    });
  };

  const setEnabled = (nextEnabled) => {
    enabled = Boolean(nextEnabled);
    controller.setEnabled(enabled);
    refreshLayerDecorations();
    try { scheduleLibraryTree(); } catch {}
  };

  const updateTabs = () => {
    controller.updateTabs(view);
  };

  const enterState = ({ sourceText, sourceSelection, tuneUid, payloadText, spans } = {}) => {
    source = {
      text: String(sourceText || ""),
      selection: sourceSelection || null,
      tuneUid: tuneUid || null,
    };
    renderState = {
      text: String(payloadText || ""),
      selection: null,
      spans: normalizeSpans(spans),
    };
    playbackState = null;
    view = "render";
    layerSpans = renderState.spans;
    showLayers = false;
    return renderState;
  };

  const captureRenderEdit = ({ text, selection } = {}) => {
    if (!renderState) {
      renderState = { text: String(text || ""), selection: selection || null, spans: layerSpans };
      return renderState;
    }
    renderState.text = String(text || "");
    renderState.selection = selection || null;
    return renderState;
  };

  const setPlaybackState = ({ text, selection = null, spans } = {}) => {
    playbackState = {
      text: String(text || ""),
      selection,
      spans: normalizeSpans(spans),
    };
    view = "playback";
    layerSpans = playbackState.spans;
    return playbackState;
  };

  const setRenderView = () => {
    view = "render";
    layerSpans = renderState && Array.isArray(renderState.spans) ? renderState.spans : [];
    return renderState;
  };

  const exitState = () => {
    const restore = source;
    source = null;
    layerSpans = [];
    showLayers = false;
    view = "render";
    renderState = null;
    playbackState = null;
    return restore;
  };

  const setView = async (nextView) => {
    if (!enabled) return;
    const next = nextView === "playback" ? "playback" : "render";
    const currentView = view;
    if (currentView === next) return;
    if (!hasEditor()) return;

    if (currentView === "render") {
      captureRenderEdit({
        text: getEditorText(),
        selection: getEditorSelection(),
      });
    }

    if (next === "playback") {
      const baseText = renderState && typeof renderState.text === "string"
        ? renderState.text
        : getEditorText();
      const baseOffset = computePayloadTuneOffset(baseText);
      const built = buildPlaybackPayload(baseText, baseOffset);
      const nextPlaybackState = setPlaybackState({
        text: built.text,
        selection: null,
        spans: built.spans || [],
      });

      updateTabs();
      setEditorReadOnly(true);
      setEditorText(nextPlaybackState.text || "");
      setEditorCursor(computePayloadTuneOffset(nextPlaybackState.text || ""), { scrollIntoView: true });
      refreshLayerDecorations();
      scheduleRender({ clearOutput: true });
      return;
    }

    const restore = setRenderView();
    updateTabs();
    setEditorReadOnly(false);
    setEditorText(restore && typeof restore.text === "string" ? restore.text : "");
    if (restore && restore.selection) restoreEditorSelection(restore.selection);
    refreshLayerDecorations();
    scheduleRender({ clearOutput: true });
  };

  const enter = async () => {
    if (enabled) return;
    if (isRawMode() || isFocusModeEnabled()) {
      showToast("Payload Mode is available only in normal mode (exit Raw/Focus first).", 3600);
      return;
    }
    if (!hasEditor()) return;
    const tuneUid = getActiveTuneUid();
    if (!tuneUid) {
      showToast("No active tune.", 2200);
      return;
    }

    try { stopPlayback(); } catch {}
    resetPlaybackState();

    const sourceText = getEditorText();
    const sourceSelection = getEditorSelection();
    const headerText = sanitizeHeaderText(getHeaderText());
    const prefixPayload = buildHeaderPrefixWithLayerSpans(headerText, true, sourceText);
    const payloadText = prefixPayload.text ? `${prefixPayload.text}${sourceText}` : sourceText;

    enterState({
      sourceText,
      sourceSelection,
      tuneUid,
      payloadText,
      spans: prefixPayload.spans || [],
    });

    setEnabled(true);
    clearBarMismatchMarkers();
    updateTabs();
    setEditorReadOnly(false);
    setEditorText(payloadText);
    setEditorCursor(computePayloadTuneOffset(payloadText), { scrollIntoView: true });
    scheduleRender({ clearOutput: true });
    setStatus("OK");
  };

  const exit = async () => {
    if (!enabled) return;
    try { stopPlayback(); } catch {}
    resetPlaybackState();

    const restore = exitState();
    setEnabled(false);
    setEditorReadOnly(false);

    if (restore && typeof restore.text === "string") {
      setEditorText(restore.text);
      if (restore.selection) restoreEditorSelection(restore.selection);
    }
    scheduleRender({ clearOutput: true });
    setStatus("OK");
  };

  return {
    enter,
    exit,
    getLayerDecorationOptions,
    getView,
    isEnabled,
    isPlaybackView,
    setView,
    updateTabs,
    wire: () => controller.wire(),
  };
}
