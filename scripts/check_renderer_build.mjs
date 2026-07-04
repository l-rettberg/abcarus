import { build } from "esbuild";
import { readFile } from "node:fs/promises";

async function assertSaveIntentGuards() {
  const rendererPath = "src/renderer/renderer.js";
  const src = await readFile(rendererPath, "utf8");
  const selectionPlaybackModelPath = "src/renderer/playback/selection_playback_model.js";
  const selectionPlaybackModel = await readFile(selectionPlaybackModelPath, "utf8").catch(() => "");
  const selectionPlaybackRuntimePath = "src/renderer/playback/selection_playback_runtime.js";
  const selectionPlaybackRuntime = await readFile(selectionPlaybackRuntimePath, "utf8").catch(() => "");
  const abSelectionPlaybackControllerPath = "src/renderer/playback/ab_selection_playback_controller.js";
  const abSelectionPlaybackController = await readFile(abSelectionPlaybackControllerPath, "utf8").catch(() => "");

  if (!src.includes("const SAVE_INTENT = Object.freeze(")) {
    throw new Error("Missing SAVE_INTENT model in renderer.");
  }
  if (!src.includes("function resolveSaveSession()")) {
    throw new Error("Missing resolveSaveSession() in renderer.");
  }
  if (!src.includes("async function verifyWorkingCopySaveReachedDisk(filePath)")) {
    throw new Error("Missing post-commit working-copy save verification.");
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
  if (
    !src.includes("function hasIntentionalSelectionPlaybackSpan(text, start, end)")
    && !selectionPlaybackModel.includes("function hasIntentionalSelectionPlaybackSpan(text, start, end)")
  ) {
    throw new Error("Missing selection intent gate helper.");
  }
  if (
    !src.includes("if (!hasIntentionalSelectionPlaybackSpan(text, start, end)) return false;")
    && !abSelectionPlaybackController.includes("!hasIntentionalSelectionPlaybackSpan(text, start, end)")
  ) {
    throw new Error("playSelectionOnce() must gate accidental selections.");
  }
  if (
    !src.includes("buildSelectionPlaybackToast(selectionSettings)")
    && !abSelectionPlaybackController.includes("buildSelectionPlaybackToast(selectionSettings)")
  ) {
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
  if (
    !src.includes("let playbackScopedOptions = null;")
    && !selectionPlaybackRuntime.includes("let scopedOptions = null;")
  ) {
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
  if (!syncBody.includes("workingCopyTuneSyncRunPromise")) {
    throw new Error("flushWorkingCopyTuneSync() must wait for in-flight sync before save commits.");
  }
  if (!syncBody.includes("result = { ok: true, path: filePath };")) {
    throw new Error("flushWorkingCopyTuneSync() must report successful tune sync explicitly.");
  }
  if (!src.includes("async function performSimpleTuneSave(filePath")) {
    throw new Error("Renderer must provide the simple full-file tune save path.");
  }
  if (!saveBody.includes("const ok = await performSimpleTuneSave(activeTuneMeta.path")) {
    throw new Error("performSaveFlow() must use the simple full-file tune save path for active ABC tunes.");
  }
  const simpleSaveStart = src.indexOf("async function performSimpleTuneSave(filePath");
  const simpleSaveEnd = src.indexOf("async function showSaveError(", simpleSaveStart);
  if (simpleSaveStart < 0 || simpleSaveEnd < 0) throw new Error("Unable to isolate performSimpleTuneSave().");
  const simpleSaveBody = src.slice(simpleSaveStart, simpleSaveEnd);
  if (!simpleSaveBody.includes("const verifyRes = await readFile(p);")) {
    throw new Error("performSimpleTuneSave() must read back the disk file after writing.");
  }
  if (!simpleSaveBody.includes("String(verifyRes.data || \"\") !== updatedText")) {
    throw new Error("performSimpleTuneSave() must verify that disk text matches the saved buffer.");
  }
  if (!simpleSaveBody.includes("await alignWorkingCopyWithDiskAfterSimpleSave(p);")) {
    throw new Error("performSimpleTuneSave() must keep any open working copy aligned after disk save.");
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
  const barMetricsSrc = await readFile("src/renderer/abc/bar_metrics.js", "utf8");
  const alignBarsSrc = await readFile("src/renderer/abc/align_bars.js", "utf8");

  const metricsModule = { exports: {} };
  const metricsHelpers = barMetricsSrc.replace(
    /export\s+\{[\s\S]*?\};\s*$/,
    "module.exports = { BAR_SEP_NO_SPACE, getDefaultLen, getMetre, isLikelyAnacrusis, splitLineIntoParts };",
  );
  new Function("module", "exports", metricsHelpers)(metricsModule, metricsModule.exports);
  const {
    BAR_SEP_NO_SPACE,
    getDefaultLen,
    getMetre,
    isLikelyAnacrusis,
    splitLineIntoParts,
  } = metricsModule.exports;

  const module = { exports: {} };
  const helpers = alignBarsSrc
    .replace(/import\s+\{[\s\S]*?\}\s+from\s+"\.\/bar_metrics\.js";\s*/, "")
    .replace(
      /export\s+\{[\s\S]*?\};\s*$/,
      "module.exports = { alignBarsInText, getBarSeparatorColumns };",
    );
  const load = new Function(
    "module",
    "exports",
    "BAR_SEP_NO_SPACE",
    "getDefaultLen",
    "getMetre",
    "isLikelyAnacrusis",
    "splitLineIntoParts",
    helpers,
  );
  load(
    module,
    module.exports,
    BAR_SEP_NO_SPACE,
    getDefaultLen,
    getMetre,
    isLikelyAnacrusis,
    splitLineIntoParts,
  );
  const { alignBarsInText, getBarSeparatorColumns } = module.exports;
  if (typeof alignBarsInText !== "function") throw new Error("alignBarsInText() is unavailable.");
  if (typeof getBarSeparatorColumns !== "function") throw new Error("getBarSeparatorColumns() is unavailable.");

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

  const lyricInterleaved = [
    "X:2",
    "M:6/8",
    "L:1/16",
    "K:G",
    "z6 z (B,C^DEF) | Gz2<(!>!A2G) (ABAGFE) |",
    "w:",
    "^DzEDC2 E6 | E2^D2C2 D2 TE4 |",
    "w: lyric | text",
    "z4 (E^D) E2 F4 | (FG) (F/2G/2F/2E/2-)E2 F6- |",
  ].join("\n");
  const lyricOut = alignBarsInText(lyricInterleaved);
  if (lyricOut === lyricInterleaved) {
    throw new Error("Align Bars did not align music lines separated by w: lyric lines.");
  }
  const lyricLines = String(lyricOut || "").split(/\r\n|\n|\r/);
  const lyricMusicLine = lyricLines.find((line) => line.startsWith("^DzEDC2"));
  const alignedLyricLine = lyricLines.find((line) => line.startsWith("w: lyric"));
  if (!/^w:\s*$/m.test(lyricOut) || !lyricMusicLine || !alignedLyricLine) {
    throw new Error("Align Bars lost w: lyric lines while aligning interleaved music.");
  }
  if (lyricMusicLine.indexOf("|") !== alignedLyricLine.indexOf("|")) {
    throw new Error("Align Bars did not align compatible w: separators to the preceding music line.");
  }

  const lyricLeadingRepeat = [
    "X:3",
    "M:2/4",
    "L:1/4",
    "K:C",
    "|: C D E F G A B c | d e f g a b c d |",
    "w:first words | second words |",
  ].join("\n");
  const leadingRepeatOut = alignBarsInText(lyricLeadingRepeat);
  const leadingRepeatLines = String(leadingRepeatOut || "").split(/\r\n|\n|\r/);
  const leadingRepeatMusic = leadingRepeatLines.find((line) => line.includes("|: C"));
  const leadingRepeatLyric = leadingRepeatLines.find((line) => line.startsWith("w:first"));
  if (!leadingRepeatMusic || !leadingRepeatLyric) {
    throw new Error("Align Bars lost leading-repeat lyric regression lines.");
  }
  const musicSepCols = getBarSeparatorColumns(leadingRepeatMusic);
  const lyricSepCols = getBarSeparatorColumns(leadingRepeatLyric);
  if (musicSepCols.length !== 3 || lyricSepCols.length !== 2) {
    throw new Error("Align Bars leading-repeat lyric regression fixture has unexpected separator counts.");
  }
  if (lyricSepCols[0] !== musicSepCols[1] || lyricSepCols[1] !== musicSepCols[2]) {
    throw new Error("Align Bars did not skip the leading repeat separator when aligning w: separators.");
  }
}

async function assertBareContinuationDirectiveHighlight() {
  const decorationsPath = "src/renderer/editor/abc_decorations.js";
  const src = await readFile(decorationsPath, "utf8");
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

async function assertSepIsPrestrippedForRender() {
  const rendererPath = "src/renderer/renderer.js";
  const src = await readFile(rendererPath, "utf8");
  const start = src.indexOf("function stripSepForRender(text)");
  const end = src.indexOf("function parseBarToken(rawToken)", start);
  if (start < 0 || end < 0) throw new Error("Unable to isolate %%sep render helper.");

  const module = { exports: {} };
  const load = new Function("module", "exports", `${src.slice(start, end)}\nmodule.exports = { stripSepForRender };\n`);
  load(module, module.exports);
  const { stripSepForRender } = module.exports;
  const input = "X:1\nK:C\nC |]\n%%sep 20 20 100\nW:words\n";
  const out = stripSepForRender(input);
  if (!out || !out.replaced) throw new Error("stripSepForRender() must detect %%sep lines.");
  if (out.text.length !== input.length) throw new Error("stripSepForRender() must preserve source length.");
  if (/^%%sep/m.test(out.text)) throw new Error("stripSepForRender() must neutralize %%sep before rendering.");

  const prestripCount = (src.match(/const sepStripInitial = stripSepForRender/g) || []).length;
  if (prestripCount < 2) {
    throw new Error("Live and print render paths must pre-strip %%sep before calling abc2svg.");
  }
}

async function assertPrintSuggestedBaseNameIncludesKey() {
  const rendererPath = "src/renderer/renderer.js";
  const headerFieldsPath = "src/renderer/abc/header_fields.js";
  const printHelpersPath = "src/renderer/print/print_helpers.js";
  const src = await readFile(rendererPath, "utf8");
  const headerFieldsSrc = await readFile(headerFieldsPath, "utf8");
  const printHelpersSrc = await readFile(printHelpersPath, "utf8");
  const start = src.indexOf("function buildSuggestedTuneBaseName(");
  const end = src.indexOf("function getPlaybackText()", start);
  if (start < 0 || end < 0) throw new Error("Unable to isolate print suggested filename helpers.");

  const module = { exports: {} };
  const prelude = "let activeTuneMeta = null; let editorText = ''; function getEditorValue() { return editorText; }\n";
  const headerHelpers = headerFieldsSrc.replace(/export\s+\{[\s\S]*?\};\s*$/, "");
  const printHelpers = printHelpersSrc.replace(/export\s+\{[\s\S]*?\};\s*$/, "");
  const load = new Function("module", "exports", `${prelude}${headerHelpers}\n${printHelpers}\n${src.slice(start, end)}\nmodule.exports = { getSuggestedBaseName, getSuggestedPrintBaseName, setText: (value) => { editorText = value; } };\n`);
  load(module, module.exports);
  const { getSuggestedBaseName, getSuggestedPrintBaseName, setText } = module.exports;
  setText([
    "X:1",
    "T:Զով Գիշեր Է",
    "T:Zov Gisher E",
    "C:Komitas",
    "M:6/8",
    "K:Gmaj",
    "GABc |]",
  ].join("\n"));
  if (getSuggestedBaseName() !== "Zov Gisher E - Komitas") {
    throw new Error("Default suggested filename should keep title/composer without key.");
  }
  if (getSuggestedPrintBaseName() !== "Zov Gisher E - Komitas - Gmaj") {
    throw new Error("Print/PDF suggested filename should include title, composer, and key.");
  }
  setText("X:2\nT:Untitled Keyless\nK:none\nCDEF |]\n");
  if (getSuggestedPrintBaseName() !== "Untitled Keyless") {
    throw new Error("Print/PDF suggested filename must omit K:none.");
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
  await assertDirectiveErrorsDoNotGetMeasureStats();
  await assertSepIsPrestrippedForRender();
  await assertPrintSuggestedBaseNameIncludesKey();
}

main().catch((err) => {
  process.stderr.write(`Renderer build check failed: ${err?.stack || err}\n`);
  process.exitCode = 1;
});
