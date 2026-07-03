export function createPayloadModeFeature() {
  let source = null;
  let layerSpans = [];
  let showLayers = false;
  let view = "render";
  let renderState = null;
  let playbackState = null;

  const normalizeSpans = (spans) => Array.isArray(spans) ? spans : [];

  const getView = () => view;

  const isPlaybackView = () => view === "playback";

  const getRenderState = () => renderState;

  const getLayerDecorationOptions = (enabled) => ({
    payloadMode: Boolean(enabled),
    showLayers,
    layerSpans,
  });

  const enter = ({ sourceText, sourceSelection, tuneUid, payloadText, spans } = {}) => {
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

  const exit = () => {
    const restore = source;
    source = null;
    layerSpans = [];
    showLayers = false;
    view = "render";
    renderState = null;
    playbackState = null;
    return restore;
  };

  return {
    captureRenderEdit,
    enter,
    exit,
    getLayerDecorationOptions,
    getRenderState,
    getView,
    isPlaybackView,
    setPlaybackState,
    setRenderView,
  };
}
