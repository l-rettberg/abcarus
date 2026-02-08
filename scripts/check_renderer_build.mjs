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
}

main().catch((err) => {
  process.stderr.write(`Renderer build check failed: ${err?.stack || err}\n`);
  process.exitCode = 1;
});
