#!/usr/bin/env node
/* eslint-disable no-console */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import esbuild from "esbuild";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

async function loadPlaybackPayloadModel() {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, "src/renderer/playback/playback_payload_model.js")],
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

function createAbc2svgSandbox() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    navigator: {},
    alert() {},
    prompt() { return null; },
    sessionStorage: { getItem() {}, setItem() {}, removeItem() {} },
    window: null,
    exports: {},
    module: { exports: {} },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["abc2svg-1.js", "MIDI-1.js", "snd-1.js"]) {
    vm.runInContext(
      fs.readFileSync(path.join(ROOT, "third_party/abc2svg", file), "utf8"),
      sandbox,
      { filename: file }
    );
  }
  return sandbox;
}

function parseWithAbc2svg(sandbox, abcText) {
  const AbcCtor = sandbox.abc2svg && sandbox.abc2svg.Abc;
  assert(typeof AbcCtor === "function", "abc2svg constructor unavailable");
  const messages = [];
  const abc = new AbcCtor({
    img_out() {},
    err(m) { messages.push(String(m || "")); },
    errmsg(m) { messages.push(String(m || "")); },
  });
  abc.tosvg("drum_payload", abcText);
  return { abc, messages };
}

function countDrumNotes(sandbox, parsed) {
  const toAudio = typeof sandbox.ToAudio === "function" ? sandbox.ToAudio() : null;
  assert(toAudio && typeof toAudio.add === "function", "ToAudio.add unavailable");
  const tunes = parsed.abc && Array.isArray(parsed.abc.tunes) ? parsed.abc.tunes : [];
  assert(tunes.length > 0, "No tunes parsed for audio generation");
  let count = 0;
  for (const tune of tunes) {
    toAudio.add(tune[0], tune[1], tune[3]);
    const seen = new Set();
    for (let s = tune[0]; s && !seen.has(s); s = s.ts_next) {
      seen.add(s);
      if (s && s.p_v && s.p_v.id === "_drum" && Array.isArray(s.notes)) count += s.notes.length;
    }
  }
  return count;
}

async function run() {
  const {
    normalizeReadableMidiDrumsForPlayback,
    relocateMidiDrumDirectivesIntoBody,
  } = await loadPlaybackPayloadModel();
  assert(typeof normalizeReadableMidiDrumsForPlayback === "function", "normalizer export missing");
  assert(typeof relocateMidiDrumDirectivesIntoBody === "function", "drum relocator export missing");

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

  const headerReadable = [
    "X:2",
    "M:9/8",
    "L:1/8",
    "%%MIDI drumon",
    "%%MIDI drum     d2  d  d  d2 d2 d",
    "%%MIDI drum +:  64  62 62 64 62 62",
    "%%MIDI drum +:  100 90 70 90 70 70",
    "K:Emin",
    "V:1",
    "A2 B2 B2 B3|]",
  ].join("\n");
  const relocated = relocateMidiDrumDirectivesIntoBody(
    normalizeReadableMidiDrumsForPlayback(headerReadable)
  ).text;
  assert(/K:Emin\n%%MIDI drumon\n%%MIDI drum d2ddd2d2d 64 62 62 64 62 62 100 90 70 90 70 70/m.test(relocated), "header drums should move after K:");
  const sandbox = createAbc2svgSandbox();
  const parsed = parseWithAbc2svg(sandbox, relocated);
  assert(!parsed.messages.some((m) => /must be in a voice/i.test(m)), `relocated drums reported voice error: ${parsed.messages.join("; ")}`);
  assert(countDrumNotes(sandbox, parsed) > 0, "relocated readable drums should generate native drum notes");

  console.log("% PASS drum payload harness");
}

run().catch((e) => {
  console.log("% FAIL drum payload harness");
  console.log(String(e && e.stack ? e.stack : e));
  process.exitCode = 1;
});
