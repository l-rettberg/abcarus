import { build } from "esbuild";
import { readFile } from "node:fs/promises";

async function assertSaveIntentGuards() {
  const rendererPath = "src/renderer/renderer.js";
  const src = await readFile(rendererPath, "utf8");

  if (!src.includes("const SAVE_INTENT = Object.freeze(")) {
    throw new Error("Missing SAVE_INTENT model in renderer.");
  }
  if (!src.includes("function resolveSaveSession()")) {
    throw new Error("Missing resolveSaveSession() in renderer.");
  }

  const saveStart = src.indexOf("async function performSaveFlow()");
  const saveEnd = src.indexOf("async function performSaveAsFlow()", saveStart);
  if (saveStart < 0 || saveEnd < 0) throw new Error("Unable to isolate performSaveFlow().");
  const saveBody = src.slice(saveStart, saveEnd);
  if (!saveBody.includes("const session = resolveSaveSession();")) {
    throw new Error("performSaveFlow() must route by resolveSaveSession().");
  }
  if (!saveBody.includes("session.intent === SAVE_INTENT.APPEND_TO_FILE")) {
    throw new Error("performSaveFlow() must handle explicit append intent.");
  }
  if (!src.includes("function hasIntentionalSelectionPlaybackSpan(text, start, end)")) {
    throw new Error("Missing selection intent gate helper.");
  }
  if (!src.includes("if (!hasIntentionalSelectionPlaybackSpan(text, start, end)) return false;")) {
    throw new Error("playSelectionOnce() must gate accidental selections.");
  }
  if (!src.includes("buildSelectionPlaybackToast(selectionSettings)")) {
    throw new Error("Selection playback must show active flags toast.");
  }
  if (!src.includes("function resolveMeasureStartRenderIdxSequential(measureIndex, n, { minBound, minStartRenderIdx } = {})")) {
    throw new Error("Missing sequential measure resolver for focus loop bounds.");
  }
  if (!src.includes("function resolveFocusSegmentBarsByNumber(barMap, byNumber, from, to)")) {
    throw new Error("Missing Focus bar-number resolver for segment mode.");
  }
  if (!src.includes("byNumberRange = resolveFocusSegmentBarsByNumber(bars, byNumber, from, to);")) {
    throw new Error("Focus segment mode must resolve From/To via abc2svg bar numbering.");
  }
  if (!src.includes("const firstMeasureOffset = findMeasureStartOffsetByNumberInPrimaryVoice(tuneText, 1);")) {
    throw new Error("Focus plan must compute first measure fallback offset.");
  }
  if (!src.includes("mode === \"segment\"") || !src.includes("Number(state.fromMeasure) === 1")) {
    throw new Error("Focus segment mode must guard the From=1 fallback path.");
  }
  if (!src.includes("startOffset = firstMeasureOffset;")) {
    throw new Error("Focus segment mode must apply first-measure fallback start.");
  }
  if (!src.includes("let playbackScopedOptions = null;")) {
    throw new Error("Missing scoped playback options state.");
  }
  if (!src.includes("rangeOrigin === \"selection\" || rangeOrigin === \"ab\" || rangeOrigin === \"focus\"")) {
    throw new Error("Range-origin routing for scoped playback options is missing.");
  }
  if (!src.includes("!scopedMode")) {
    throw new Error("Playback reuse must be disabled for scoped (selection/ab/focus) modes.");
  }
  if (!src.includes("const shouldForceReload = Boolean(entry && entry.forceReload);")) {
    throw new Error("openRecentFile() must support forceReload flag.");
  }
  if (!src.includes("await window.api.reloadWorkingCopyFromDisk();")) {
    throw new Error("openRecentFile() must reload existing working copy from disk.");
  }
  if (!src.includes("await refreshLibraryFile(targetPath, { force: true });")) {
    throw new Error("openRecentFile() must force-refresh library metadata on same-file reopen.");
  }

  const syncStart = src.indexOf("async function flushWorkingCopyTuneSync()");
  const syncEnd = src.indexOf("async function flushWorkingCopyFullSync()", syncStart);
  if (syncStart < 0 || syncEnd < 0) throw new Error("Unable to isolate flushWorkingCopyTuneSync().");
  const syncBody = src.slice(syncStart, syncEnd);
  if (!syncBody.includes("ensureXNumberInAbc(tuneTextRaw")) {
    throw new Error("flushWorkingCopyTuneSync() must normalize tune text via ensureXNumberInAbc().");
  }

  const ensureStart = src.indexOf("function ensureXNumberInAbc(abcText, xNumber)");
  const ensureEnd = src.indexOf("function renumberXLinesConsecutive(", ensureStart);
  if (ensureStart < 0 || ensureEnd < 0) throw new Error("Unable to isolate ensureXNumberInAbc().");
  const ensureFnCode = src.slice(ensureStart, ensureEnd);
  const ensureXNumberInAbc = new Function(`${ensureFnCode}; return ensureXNumberInAbc;`)();

  const input = [
    "%Rude Mechanicals tune library: www.rudemex.co.uk",
    "%Chords and arrangements by the Rude Mechanicals unless otherwise acknowledged",
    "X:1",
    "T: Example",
    "K:C",
    "C2 C2 |",
  ].join("\n");
  const out = String(ensureXNumberInAbc(input, 16) || "");
  if (!out.startsWith("X:16\n%Rude Mechanicals tune library: www.rudemex.co.uk")) {
    throw new Error("ensureXNumberInAbc() must normalize pre-X banner lines.");
  }
  if (out.includes("\nX:1\n")) {
    throw new Error("ensureXNumberInAbc() must replace existing X line.");
  }
}

async function assertInlineToolbarIconsCompatibility() {
  const indexPath = "src/renderer/index.html";
  const stylePath = "src/renderer/style.css";
  const html = await readFile(indexPath, "utf8");
  const css = await readFile(stylePath, "utf8");

  if (!html.includes("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"0\" height=\"0\"")) {
    throw new Error("Missing inline SVG sprite in renderer HTML.");
  }
  if (!html.includes("<use href=\"#ui-library\"></use>")) {
    throw new Error("Toolbar icons must use inline sprite references.");
  }
  if (css.includes("background-image: url(\"../../assets/icons/ui/")) {
    throw new Error("Toolbar icons must not use external SVG files.");
  }
  if (!css.includes("stroke: currentColor;") || !css.includes("fill: none;")) {
    throw new Error(".btn-icon must use stroke/fill inline-SVG styling.");
  }

  const requiredSymbols = [
    "ui-fonts",
    "ui-focus",
    "ui-split",
    "ui-alert",
    "ui-follow",
    "ui-globe",
    "ui-clear",
  ];
  for (const symbol of requiredSymbols) {
    if (!html.includes(`<symbol id="${symbol}"`)) {
      throw new Error(`Missing toolbar SVG symbol: ${symbol}`);
    }
  }
}

async function assertAlignBarsDoesNotCrossSectionFields() {
  const rendererPath = "src/renderer/renderer.js";
  const src = await readFile(rendererPath, "utf8");
  const start = src.indexOf("const BAR_SEP_SYMBOLS =");
  const end = src.indexOf("function alignBarsInEditor()", start);
  if (start < 0 || end < 0) throw new Error("Unable to isolate Align Bars helpers.");

  const module = { exports: {} };
  const helpers = `${src.slice(start, end)}\nmodule.exports = { alignBarsInText };\n`;
  const load = new Function("module", "exports", helpers);
  load(module, module.exports);
  const { alignBarsInText } = module.exports;
  if (typeof alignBarsInText !== "function") throw new Error("alignBarsInText() is unavailable.");

  const input = [
    "X:1",
    "M:10/8",
    "L:1/16",
    "K:C",
    "[P:A] A4 G2A2 GA Bcde d4Bc |",
    "d4 e2 d2 cB A2 Bd c4 z2 |",
    "[P:E]",
    "[L:1/8]",
    "[M:6/4]",
    "Ec/B/A A^GA (B/d/)(c/B/)(A/B/) ^GFE |",
    "zBd d>cB de{/g}f e3 |",
  ].join("\n");

  const out = alignBarsInText(input);
  const lines = String(out || "").split(/\r\n|\n|\r/);
  const aLine = lines.find((line) => line.includes("[P:A]"));
  const eLine = lines.find((line) => line.startsWith("Ec/B/A"));
  if (!aLine || !eLine) throw new Error("Align Bars regression fixture did not produce expected lines.");
  if (/^\s/.test(aLine)) {
    throw new Error("Align Bars inserted a leading empty column before the first section.");
  }
  if (/^\s/.test(eLine)) {
    throw new Error("Align Bars inserted a leading empty column after inline M:/L: section fields.");
  }
}

async function assertBareContinuationDirectiveHighlight() {
  const rendererPath = "src/renderer/renderer.js";
  const src = await readFile(rendererPath, "utf8");
  const markerStart = src.indexOf("// Field/directive continuation marker");
  const markerEnd = src.indexOf("if (text.trim().length)", markerStart);
  if (markerStart < 0 || markerEnd < 0) {
    throw new Error("Unable to isolate bare +: highlighting block.");
  }
  const block = src.slice(markerStart, markerEnd);
  if (!block.includes('/^\\s*\\+:\\s*/.test(text)')) {
    throw new Error("Bare +: continuation lines must be recognized by the ABC highlighter.");
  }
  if (!block.includes('lastNonEmptyKind === "directive" ? "cm-abc-directive" : "cm-abc-header"')) {
    throw new Error("Bare +: continuation lines must inherit directive/header styling from the previous info field.");
  }
  if (block.includes('lastNonEmptyKind = "directive"')) {
    throw new Error("Bare +: continuation lines must not force following continuations into directive styling.");
  }
}

async function assertMidiDrumContinuationCompat() {
  const rendererPath = "src/renderer/renderer.js";
  const src = await readFile(rendererPath, "utf8");
  const start = src.indexOf("function collapseMidiDrumContinuationsForCompat(text)");
  const end = src.indexOf("function sanitizeAbcForPlayback(text", start);
  if (start < 0 || end < 0) throw new Error("Unable to isolate MIDI drum continuation compat helper.");

  const module = { exports: {} };
  const load = new Function("module", "exports", `${src.slice(start, end)}\nmodule.exports = { collapseMidiDrumContinuationsForCompat };\n`);
  load(module, module.exports);
  const { collapseMidiDrumContinuationsForCompat } = module.exports;
  if (typeof collapseMidiDrumContinuationsForCompat !== "function") {
    throw new Error("collapseMidiDrumContinuationsForCompat() is unavailable.");
  }

  const input = [
    "X:1",
    "M:10/8",
    "L:1/16",
    "K:C",
    "V:1",
    "%%MIDI drum d2dd2d2d2d",
    "%%MIDI drum +: 64 62 62 64 62 62",
    "%%MIDI drum +: 100 90 70 90 70 70",
    "%%MIDI drumon",
  ].join("\n");
  const result = collapseMidiDrumContinuationsForCompat(input);
  const out = String(result && result.text ? result.text : "");
  const lines = out.split(/\r\n|\n|\r/);
  if (!out.includes("%%MIDI drum d2dd2d2d2d 64 62 62 64 62 62 100 90 70 90 70 70")) {
    throw new Error("MIDI drum +: continuation must be collapsed before abc2svg render/error scan.");
  }
  if (lines.length !== input.split(/\r\n|\n|\r/).length) {
    throw new Error("MIDI drum continuation collapse must preserve line count for diagnostics.");
  }
  if (lines.some((line) => /^%%MIDI\s+drum\s+\+:/i.test(line))) {
    throw new Error("Collapsed MIDI drum text must not leave raw %%MIDI drum +: lines.");
  }

  const renderStart = src.indexOf("function renderNow()");
  const renderEnd = src.indexOf("\ninitEditor();", renderStart);
  if (renderStart < 0 || renderEnd < 0) throw new Error("Unable to isolate renderNow().");
  const renderBody = src.slice(renderStart, renderEnd);
  if (!renderBody.includes("const drumCompat = collapseMidiDrumContinuationsForCompat(renderTextBase);")) {
    throw new Error("renderNow() must collapse MIDI drum continuations before abc2svg sees render text.");
  }
}

async function assertRenderCompatOffsetRemap() {
  const rendererPath = "src/renderer/renderer.js";
  const src = await readFile(rendererPath, "utf8");
  const mapStart = src.indexOf("function getRenderCompatMap()");
  const mapEnd = src.indexOf("function lruGet(", mapStart);
  const collapseStart = src.indexOf("function collapseMidiDrumContinuationsForCompat(text)");
  const collapseEnd = src.indexOf("function sanitizeAbcForPlayback(text", collapseStart);
  if (mapStart < 0 || mapEnd < 0 || collapseStart < 0 || collapseEnd < 0) {
    throw new Error("Unable to isolate render compat remap helpers.");
  }

  const module = { exports: {} };
  const code = [
    "let lastRenderPayload = null;",
    src.slice(mapStart, mapEnd),
    src.slice(collapseStart, collapseEnd),
    "module.exports = {",
    "  collapseMidiDrumContinuationsForCompat,",
    "  mapSourceOffsetToRenderOffset,",
    "  mapRenderOffsetToSourceOffset,",
    "  mapEditorOffsetToRenderIdx,",
    "  mapRenderIdxToEditorOffset,",
    "};",
  ].join("\n");
  const load = new Function("module", "exports", code);
  load(module, module.exports);
  const {
    collapseMidiDrumContinuationsForCompat,
    mapSourceOffsetToRenderOffset,
    mapRenderOffsetToSourceOffset,
    mapEditorOffsetToRenderIdx,
    mapRenderIdxToEditorOffset,
  } = module.exports;

  const input = [
    "X:1",
    "M:10/8",
    "L:1/16",
    "K:C",
    "V:1",
    "%%MIDI drum d2dd2d2d2d",
    "%%MIDI drum +: 64 62 62 64 62 62",
    "%%MIDI drum +: 100 90 70 90 70 70",
    "C2 D2 E2 F2 |",
  ].join("\n");
  const result = collapseMidiDrumContinuationsForCompat(input);
  const compatMap = result && result.compatMap ? result.compatMap : null;
  if (!compatMap || !Array.isArray(compatMap.shifts) || !compatMap.shifts.length) {
    throw new Error("MIDI drum compat collapse must expose an offset remap for note highlighting.");
  }
  const sourcePos = input.indexOf("C2 D2 E2 F2");
  const renderPos = result.text.indexOf("C2 D2 E2 F2");
  if (sourcePos < 0 || renderPos < 0) throw new Error("Render compat remap fixture is invalid.");
  if (mapSourceOffsetToRenderOffset(sourcePos, compatMap) !== renderPos) {
    throw new Error("Source->render offset remap must account for MIDI drum collapse growth.");
  }
  if (mapRenderOffsetToSourceOffset(renderPos, compatMap) !== sourcePos) {
    throw new Error("Render->source offset remap must invert MIDI drum collapse growth.");
  }
  const payload = { offset: 0, compatMap };
  if (mapEditorOffsetToRenderIdx(sourcePos, payload) !== renderPos) {
    throw new Error("Editor->render remap must use the compat offset map.");
  }
  if (mapRenderIdxToEditorOffset(renderPos, payload) !== sourcePos) {
    throw new Error("Render->editor remap must use the compat offset map.");
  }
}

async function assertDirectiveErrorsDoNotGetMeasureStats() {
  const rendererPath = "src/renderer/renderer.js";
  const src = await readFile(rendererPath, "utf8");
  const start = src.indexOf("function shouldComputeMeasureStatsAt(editorText, anchorOffset)");
  const end = src.indexOf("function setErrorFocusMessage(entry, from)", start);
  if (start < 0 || end < 0) throw new Error("Unable to isolate measure-stats eligibility helper.");

  const module = { exports: {} };
  const load = new Function("module", "exports", `${src.slice(start, end)}\nmodule.exports = { shouldComputeMeasureStatsAt };\n`);
  load(module, module.exports);
  const { shouldComputeMeasureStatsAt } = module.exports;
  if (typeof shouldComputeMeasureStatsAt !== "function") {
    throw new Error("shouldComputeMeasureStatsAt() is unavailable.");
  }

  const input = [
    "X:27",
    "T:Some Saz Semai",
    "M:10/8",
    "L:1/16",
    "K:Am",
    "V:1",
    "%%MIDI drum d2dd2d2d2d",
    "%%MIDI drum +: 64 62 62 64 62 62",
    "C2D2E2F2G2 |",
  ].join("\n");
  const directiveOffset = input.indexOf("%%MIDI drum +:");
  const musicOffset = input.indexOf("C2D2");
  if (shouldComputeMeasureStatsAt(input, directiveOffset)) {
    throw new Error("Directive errors must not get synthetic Beats measure stats.");
  }
  if (!shouldComputeMeasureStatsAt(input, musicOffset)) {
    throw new Error("Music-line errors must still be eligible for Beats measure stats.");
  }
}

async function main() {
  const res = await build({
    entryPoints: ["src/renderer/renderer.js"],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    logLevel: "silent",
  });

  if (!res || !Array.isArray(res.outputFiles) || res.outputFiles.length === 0) {
    throw new Error("Renderer build produced no output.");
  }

  await assertSaveIntentGuards();
  await assertInlineToolbarIconsCompatibility();
  await assertAlignBarsDoesNotCrossSectionFields();
  await assertBareContinuationDirectiveHighlight();
  await assertMidiDrumContinuationCompat();
  await assertRenderCompatOffsetRemap();
  await assertDirectiveErrorsDoNotGetMeasureStats();
}

main().catch((err) => {
  process.stderr.write(`Renderer build check failed: ${err?.stack || err}\n`);
  process.exitCode = 1;
});
