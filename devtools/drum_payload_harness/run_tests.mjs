#!/usr/bin/env node
/* eslint-disable no-console */
import { createRequire } from "node:module";
import path from "node:path";
import esbuild from "esbuild";

const require = createRequire(import.meta.url);

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

async function loadPlaybackPayloadModel() {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const result = await esbuild.build({
    entryPoints: [path.join(root, "src/renderer/playback/playback_payload_model.js")],
    bundle: true,
    format: "cjs",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  const module = { exports: {} };
  const fn = new Function("module", "exports", "require", code);
  fn(module, module.exports, require);
  return module.exports;
}

async function run() {
  const { normalizeReadableMidiDrumsForPlayback } = await loadPlaybackPayloadModel();
  assert(typeof normalizeReadableMidiDrumsForPlayback === "function", "normalizer export missing");

  const readable = [
    "X:1",
    "K:C",
    "%%MIDI drum     d2 dd2 d2d2 d",
    "%%MIDI drum +:  64 62 62 64 62 62",
    "%%MIDI drum +:  100 90 70 90 70 70",
    "%%MIDI drumon",
    "C|",
  ].join("\n");
  const normalized = normalizeReadableMidiDrumsForPlayback(readable);
  const lines = normalized.split(/\n/);
  assert(lines.length === readable.split(/\n/).length, "normalizer should preserve line count");
  assert(normalized.length === readable.length, "normalizer should preserve total payload length when possible");
  assert(
    lines[2] === "%%MIDI drum d2dd2d2d2d 64 62 62 64 62 62 100 90 70 90 70 70",
    `unexpected canonical drum line: ${lines[2]}`
  );
  assert(/^%\s*$/.test(lines[3]), "first continuation should become a comment placeholder");
  assert(/^%\s*$/.test(lines[4]), "second continuation should become a comment placeholder");
  assert(!/^\s*%%\s*MIDI\s+drum\s+\+:/im.test(normalized), "payload must not keep readable +: continuation directives");
  assert(!/^\s*V:\s*DRUM\b/im.test(normalized), "payload must not inject V:DRUM");

  const compact = "%%MIDI drum dddd 36 42 38 42 100 90 80 90";
  assert(normalizeReadableMidiDrumsForPlayback(compact) === compact, "compact drum line should remain unchanged");

  console.log("% PASS drum payload harness");
}

run().catch((e) => {
  console.log("% FAIL drum payload harness");
  console.log(String(e && e.stack ? e.stack : e));
  process.exitCode = 1;
});
