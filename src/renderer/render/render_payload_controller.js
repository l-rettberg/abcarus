function createRenderPayloadController({
  getEditorText = () => "",
  getActiveFileEntry = () => null,
  getHeaderText = () => "",
  isPayloadMode = () => false,
  isChordProEnabled = () => false,
  isChordProFullView = () => false,
  computePayloadTuneOffset = () => 0,
  countLinesForPrefix = () => 0,
  sanitizeHeaderText = (text) => text,
  buildHeaderPrefix = (_header, _includeCheckbars, tuneText) => ({ text: "", offset: 0, tuneText }),
  assertCleanAbcText = () => true,
} = {}) {
  function getRenderPayload() {
    if (isPayloadMode()) {
      const text = getEditorText();
      const offset = computePayloadTuneOffset(text);
      const out = { text, offset };
      assertCleanAbcText(out.text, "render payload");
      return out;
    }

    if (isChordProEnabled()) {
      if (isChordProFullView()) return { text: "", offset: 0, lineOffset: 0, empty: true };
      const tuneText = getEditorText();
      const prefixPayload = buildHeaderPrefix("", true, tuneText);
      const text = prefixPayload.text ? `${prefixPayload.text}${tuneText}` : tuneText;
      const lineOffset = countLinesForPrefix(prefixPayload.text);
      const out = { text, offset: prefixPayload.offset || 0, lineOffset };
      assertCleanAbcText(out.text, "render payload");
      return out;
    }

    const tuneText = getEditorText();
    const entry = getActiveFileEntry();
    const headerTextRaw = entry ? getHeaderText() : "";
    const headerText = sanitizeHeaderText(headerTextRaw);
    const prefixPayload = buildHeaderPrefix(headerText, true, tuneText);
    if (!prefixPayload.text) return { text: tuneText, offset: 0 };
    const out = { text: `${prefixPayload.text}${tuneText}`, offset: prefixPayload.offset };
    assertCleanAbcText(out.text, "render payload");
    return out;
  }

  return {
    getRenderPayload,
  };
}

export {
  createRenderPayloadController,
};
