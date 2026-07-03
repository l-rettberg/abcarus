export function buildDrumDebugDiagnostics({
  tuneText = "",
  isPayloadMode = false,
  hasActiveFileEntry = false,
  headerText = "",
  buildHeaderPrefix = () => ({ text: "", offset: 0 }),
  injectGchordOn = null,
  shouldUseNativeMidiDrums = () => false,
  normalizeLeadingInlineDirectivesForPlayback = (text) => text,
  normalizeDollarLineBreaksForPlayback = (text) => text,
  normalizeBlankLinesForPlayback = (text) => text,
  sanitizeAbcForPlayback = (text) => ({ text }),
  extractDrumPlaybackBars = () => null,
  computeExpectedBarSignatureFromInfo = () => [],
  buildDrumVoiceText = () => "",
  extractBarSignatureFromText = () => [],
  diffSignatures = () => ({ ok: true }),
  lastDrumInjectResult = null,
  lastDrumPlaybackActive = false,
  lastDrumSignatureDiff = null,
  safeString = (value) => String(value == null ? "" : value),
} = {}) {
  const nativeDrums = Boolean(shouldUseNativeMidiDrums());
  let preDrumRaw = String(tuneText || "");
  let source = "payload-mode";

  if (!isPayloadMode) {
    source = "normal";
    const prefixPayload = buildHeaderPrefix(hasActiveFileEntry ? headerText : "", false, preDrumRaw);
    preDrumRaw = prefixPayload.text ? `${prefixPayload.text}${preDrumRaw}` : String(preDrumRaw || "");
    const gchordPreview = typeof injectGchordOn === "function"
      ? injectGchordOn(preDrumRaw, prefixPayload.offset || 0)
      : null;
    if (gchordPreview && gchordPreview.changed) preDrumRaw = gchordPreview.text;
  }

  if (!preDrumRaw) return null;

  preDrumRaw = normalizeDollarLineBreaksForPlayback(preDrumRaw);
  preDrumRaw = normalizeBlankLinesForPlayback(preDrumRaw);
  const sanitized = sanitizeAbcForPlayback(preDrumRaw);
  preDrumRaw = sanitized && sanitized.text ? sanitized.text : preDrumRaw;

  const hasDrumDirective = /(^|\n)\s*(%%MIDI\s+drum\b|I:\s*MIDI\s+drum\b)/i.test(preDrumRaw);
  if (nativeDrums) {
    return {
      summary: "Native %%MIDI drum handling is enabled (no V:DRUM injection).",
      source,
      nativeDrums: true,
      hasDrumDirective,
    };
  }

  const normalized = normalizeLeadingInlineDirectivesForPlayback(preDrumRaw);
  const normalizedChanged = normalized !== preDrumRaw;
  const info = extractDrumPlaybackBars(normalized);
  const expectedSig = computeExpectedBarSignatureFromInfo(info);
  const drumVoice = buildDrumVoiceText(info);
  const actualSig = extractBarSignatureFromText(drumVoice || "");
  const diff = diffSignatures(expectedSig, actualSig);
  const mismatchBar = diff && diff.ok === false && Number.isFinite(diff.index) ? diff.index + 1 : null;
  const summary = diff && diff.ok
    ? "Drum bar skeleton matches V:1."
    : (mismatchBar != null
      ? `Drum skeleton mismatch at bar ${mismatchBar}.`
      : "Drum skeleton mismatch.");
  const preview = drumVoice
    ? drumVoice.split(/\r\n|\n|\r/).slice(0, 80).join("\n")
    : "";
  const lastInjection = lastDrumInjectResult ? {
    changed: Boolean(lastDrumInjectResult.changed),
    insertAtLine: lastDrumInjectResult.insertAtLine || null,
    lineCount: lastDrumInjectResult.lineCount || 0,
  } : null;

  return {
    summary,
    source,
    nativeDrums: false,
    hasDrumDirective,
    normalizedChanged,
    lastInjectionActive: Boolean(lastDrumPlaybackActive),
    lastInjection,
    lastSignatureDiff: lastDrumSignatureDiff || null,
    recomputed: {
      mismatchBar,
      bars: Array.isArray(info && info.bars) ? info.bars.length : 0,
      patterns: Array.isArray(info && info.patterns) ? info.patterns.length : 0,
      expectedBars: Array.isArray(expectedSig) ? expectedSig.length : 0,
      actualBars: Array.isArray(actualSig) ? actualSig.length : 0,
      signatureDiff: diff,
      drumVoicePreview: safeString(preview, 12000),
    },
  };
}
