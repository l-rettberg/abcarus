import {
  getNativeTransposeSupport,
  transformTranspose,
} from "../../transpose.mjs";
import {
  normalizeMeasuresLineBreaks,
  transformMeasuresByLinebreakMarker,
  transformMeasuresPerLine,
} from "../../measures.mjs";
import {
  transformLengthScaling,
} from "../../abc/text_transforms.js";

function createAbcTransformFeature({
  windowRef = typeof window !== "undefined" ? window : null,
  devConfig = {},
  getEditorText = () => "",
  getHeaderText = () => "",
  getSettings = () => null,
  getTransposePreview = () => ({ baseText: "", headerText: "", delta: 0 }),
  setTransposePreview = () => {},
  setEditorTextForSmoke = () => {},
  applyTransformedText = () => {},
  showTransformError = async () => {},
  setStatus = () => {},
  logError = () => {},
  alignBarsInText = (text) => text,
} = {}) {
  async function apply(options = {}) {
    const abcText = getEditorText();
    if (!abcText.trim()) {
      setStatus("No notation to transform.");
      return;
    }
    if (options.doubleLengths && options.halfLengths) {
      await showTransformError("Choose either double or half note lengths, not both.");
      return;
    }

    const settings = getSettings() || {};
    const autoAlign = Boolean(settings && settings.autoAlignBarsAfterTransforms);
    const hasOnlyLengthTransform = (options.doubleLengths || options.halfLengths)
      && options.transposeSemitones == null
      && !options.measuresPerLine
      && !options.linebreakMarker
      && !options.voice
      && options.renumberX == null;
    if (hasOnlyLengthTransform) {
      const mode = options.doubleLengths ? "double" : "half";
      let transformed = transformLengthScaling(abcText, mode);
      if (autoAlign) transformed = alignBarsInText(transformed);
      applyTransformedText(transformed);
      setStatus("OK");
      return;
    }

    const hasOnlyMeasuresPerLine = options.measuresPerLine
      && options.transposeSemitones == null
      && !options.linebreakMarker
      && !options.voice
      && options.renumberX == null
      && !options.doubleLengths
      && !options.halfLengths;
    if (hasOnlyMeasuresPerLine) {
      let transformed = transformMeasuresPerLine(abcText, options.measuresPerLine);
      transformed = normalizeMeasuresLineBreaks(transformed);
      transformed = alignBarsInText(transformed);
      transformed = normalizeMeasuresLineBreaks(transformed);
      applyTransformedText(transformed);
      setStatus("OK");
      return;
    }

    const hasOnlyLinebreakMarker = options.linebreakMarker
      && options.transposeSemitones == null
      && !options.measuresPerLine
      && !options.voice
      && options.renumberX == null
      && !options.doubleLengths
      && !options.halfLengths;
    if (hasOnlyLinebreakMarker) {
      let transformed = transformMeasuresByLinebreakMarker(abcText);
      transformed = normalizeMeasuresLineBreaks(transformed);
      if (autoAlign) {
        transformed = alignBarsInText(transformed);
        transformed = normalizeMeasuresLineBreaks(transformed);
      }
      applyTransformedText(transformed);
      setStatus("OK");
      return;
    }

    const hasOnlyTranspose = options.transposeSemitones != null
      && !options.measuresPerLine
      && !options.linebreakMarker
      && !options.voice
      && options.renumberX == null
      && !options.doubleLengths
      && !options.halfLengths;
    if (hasOnlyTranspose) {
      const preferNative = !settings || settings.useNativeTranspose !== false;
      if (preferNative) {
        const preview = getTransposePreview({
          currentText: abcText,
          currentHeaderText: getHeaderText(),
        });
        const nextDelta = preview.delta + Number(options.transposeSemitones || 0);
        const headerText = preview.headerText;
        const support = getNativeTransposeSupport(preview.baseText, { headerText });
        if (!support.ok) {
          await showTransformError(support.reason || "Default transpose is not supported for this tune.");
          setStatus("Error");
          return;
        }
        try {
          const transformed = nextDelta === 0
            ? preview.baseText
            : transformTranspose(preview.baseText, nextDelta, { headerText });
          const aligned = autoAlign ? alignBarsInText(transformed) : transformed;
          setTransposePreview(preview.baseText, headerText, nextDelta);
          applyTransformedText(aligned, { resetTransposePreview: false });
          setStatus("OK");
          return;
        } catch (e) {
          logError(`Native transpose failed.\n\n${(e && e.stack) ? e.stack : String(e)}`);
        }
      }
    }

    await showTransformError("This transform combination is not supported.");
    setStatus("Error");
  }

  function alignBars() {
    const text = getEditorText();
    if (!text.trim()) {
      setStatus("No notation to align.");
      return;
    }
    const aligned = alignBarsInText(text);
    if (aligned === text) {
      setStatus("Already aligned.");
      return;
    }
    applyTransformedText(aligned);
    setStatus("OK");
  }

  function installDevSmoke() {
    if (!devConfig || devConfig.ABCARUS_DEV_TRANSFORM_SMOKE !== "1") return false;
    const win = windowRef;
    if (!win) return false;
    win.__abcarusDevTransformSmoke = {
      apply: (options) => apply(options || {}),
      getText: () => getEditorText(),
      setText: (text) => setEditorTextForSmoke(String(text || "")),
    };
    return true;
  }

  return {
    alignBars,
    apply,
    installDevSmoke,
  };
}

export {
  createAbcTransformFeature,
};
