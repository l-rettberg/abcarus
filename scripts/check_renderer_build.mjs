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
}

main().catch((err) => {
  process.stderr.write(`Renderer build check failed: ${err?.stack || err}\n`);
  process.exitCode = 1;
});
