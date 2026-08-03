import { createRenderPayloadController } from "./render_payload_controller.js";
import {
  getRenderCompatMapFromPayload,
  mapEditorOffsetToRenderIdx as mapEditorOffsetToRenderIdxCore,
  mapRenderIdxToEditorOffset as mapRenderIdxToEditorOffsetCore,
  mapRenderOffsetToSourceOffset as mapRenderOffsetToSourceOffsetCore,
  mapSourceOffsetToRenderOffset as mapSourceOffsetToRenderOffsetCore,
  normalizeHeaderNoneSpacing,
  stripSepForRender,
} from "./render_payload_model.js";
import { createRenderPipelineController } from "./render_pipeline_controller.js";

export function normalizeAccThreeQuarterToneForAbc2svg(text) {
  // abc2svg renders the equivalent three-quarter-tone accidental as 3/2 semitones.
  return String(text || "").replace(/([_^])3\/4/g, "$13/2");
}

export function createRenderRuntime({
  consoleRef = typeof console !== "undefined" ? console : null,
} = {}) {
  let payloadController = null;
  let pipelineController = null;

  function assertCleanAbcText(text, originLabel) {
    const source = String(text || "");
    if (!source.includes("[object Object]")) return true;
    if (consoleRef && typeof consoleRef.error === "function") {
      consoleRef.error(
        `[abcarus] ABC text corruption detected (${originLabel || "unknown"}): contains "[object Object]"`,
      );
    }
    return false;
  }

  function initializePayload(options = {}) {
    payloadController = createRenderPayloadController({
      ...options,
      assertCleanAbcText,
    });
    return payloadController;
  }

  function initializePipeline(options = {}) {
    pipelineController = createRenderPipelineController({
      ...options,
      normalizeHeaderText: normalizeHeaderNoneSpacing,
      stripSepForRender,
      assertCleanAbcText,
    });
    return pipelineController;
  }

  function getRenderPayload() {
    return payloadController
      ? payloadController.getRenderPayload()
      : { text: "", offset: 0, empty: true };
  }

  function getLastRenderPayload() {
    return pipelineController ? pipelineController.getLastPayload() : null;
  }

  function getRenderCompatMap() {
    return getRenderCompatMapFromPayload(getLastRenderPayload());
  }

  function mapSourceOffsetToRenderOffset(offset, compatMap = getRenderCompatMap()) {
    return mapSourceOffsetToRenderOffsetCore(offset, compatMap);
  }

  function mapRenderOffsetToSourceOffset(offset, compatMap = getRenderCompatMap()) {
    return mapRenderOffsetToSourceOffsetCore(offset, compatMap);
  }

  function mapEditorOffsetToRenderIdx(editorOffset, payload = getLastRenderPayload()) {
    return mapEditorOffsetToRenderIdxCore(editorOffset, payload);
  }

  function mapRenderIdxToEditorOffset(renderIdx, payload = getLastRenderPayload()) {
    return mapRenderIdxToEditorOffsetCore(renderIdx, payload);
  }

  function clearOutput(statusText = "Ready") {
    if (pipelineController) pipelineController.clearOutput(statusText);
  }

  function scheduleRender(options = {}) {
    if (pipelineController) pipelineController.scheduleRenderNow(options);
  }

  function renderNow() {
    if (pipelineController) pipelineController.renderNow();
  }

  return {
    assertCleanAbcText,
    clearOutput,
    getLastRenderPayload,
    getRenderCompatMap,
    getRenderPayload,
    initializePayload,
    initializePipeline,
    mapEditorOffsetToRenderIdx,
    mapRenderIdxToEditorOffset,
    mapRenderOffsetToSourceOffset,
    mapSourceOffsetToRenderOffset,
    normalizeAccThreeQuarterToneForAbc2svg,
    normalizeHeaderNoneSpacing,
    renderNow,
    scheduleRender,
    stripSepForRender,
  };
}
