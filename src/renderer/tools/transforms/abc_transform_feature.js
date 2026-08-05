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
  transformTempoScaling,
} from "../../abc/text_transforms.js";

function createAbcTransformFeature({
  windowRef = typeof window !== "undefined" ? window : null,
  devConfig = {},
  getEditorText = () => "",
  getHeaderText = () => "",
  getSettings = () => null,
  setEditorTextForSmoke = () => {},
  applyTransformedText = () => {},
  showTransformError = async () => {},
  setStatus = () => {},
  logError = () => {},
  alignBarsInText = (text) => text,
} = {}) {
  let transposePreviewBaseText = null;
  let transposePreviewHeaderText = null;
  let transposePreviewDelta = 0;

  function resetTransposePreview() {
    transposePreviewBaseText = null;
    transposePreviewHeaderText = null;
    transposePreviewDelta = 0;
  }

  function getTransposePreview(options = {}) {
    const currentText = String(options.currentText != null ? options.currentText : getEditorText());
    const currentHeaderText = String(options.currentHeaderText != null ? options.currentHeaderText : getHeaderText());
    if (transposePreviewBaseText == null) {
      transposePreviewBaseText = currentText;
      transposePreviewHeaderText = currentHeaderText;
      transposePreviewDelta = 0;
    }
    return {
      baseText: String(transposePreviewBaseText || ""),
      headerText: String(transposePreviewHeaderText || ""),
      delta: Number(transposePreviewDelta) || 0,
    };
  }

  function setTransposePreview(baseText, headerText, delta) {
    transposePreviewBaseText = String(baseText || "");
    transposePreviewHeaderText = String(headerText || "");
    transposePreviewDelta = Number(delta) || 0;
  }

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

    const turkish = options.turkishNotation;
    if (turkish) {
      const pitchSteps = Number.isFinite(Number(turkish.pitchSteps)) ? Number(turkish.pitchSteps) : -5;
      const durationFactor = Number.isFinite(Number(turkish.durationFactor)) ? Number(turkish.durationFactor) : 2;
      if (![2, 0.5].includes(durationFactor)) {
        await showTransformError("Turkish notation macro supports duration factors 2 or 0.5.");
        setStatus("Error");
        return;
      }
      const lengthMode = durationFactor === 2 ? "double" : "half";
      let transformed = transformLengthScaling(abcText, lengthMode);
      transformed = transformTempoScaling(transformed, 1 / durationFactor);
      const headerText = getHeaderText();
      const support = getNativeTransposeSupport(transformed, { headerText });
      if (!support.ok) {
        await showTransformError(support.reason || "Turkish notation macro cannot transpose this tune.");
        setStatus("Error");
        return;
      }
      try {
        transformed = transformTranspose(transformed, pitchSteps, { headerText });
        applyTransformedText(transformed);
        setStatus("OK");
        return;
      } catch (e) {
        logError(`Turkish notation macro failed.\n\n${(e && e.stack) ? e.stack : String(e)}`);
        await showTransformError("Turkish notation macro failed.");
        setStatus("Error");
        return;
      }
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

  function installTurkishNotationMacro() {
    const win = windowRef;
    if (!win) return false;
    win.__abcarusTurkishNotation = {
      convert: () => apply({ turkishNotation: { pitchSteps: -5, durationFactor: 2 } }),
      restore: () => apply({ turkishNotation: { pitchSteps: 5, durationFactor: 0.5 } }),
    };
    return true;
  }

  return {
    alignBars,
    apply,
    installDevSmoke,
    installTurkishNotationMacro,
    resetTransposePreview,
  };
}

export {
  createAbcTransformFeature,
};
