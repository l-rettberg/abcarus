#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "../..");
const ABC2SVG_PATH = path.join(ROOT, "third_party", "abc2svg", "abc2svg-1.js");
const SND_PATH = path.join(ROOT, "third_party", "abc2svg", "snd-1.js");

function fail(message) {
  throw new Error(String(message || "Test failed"));
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function createSandbox() {
  const sessionStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  };
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    navigator: {},
    alert() {},
    prompt() { return null; },
    sessionStorage,
    window: null,
    exports: {},
    module: { exports: {} },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ABC2SVG_PATH, "utf8"), sandbox, { filename: "abc2svg-1.js" });
  vm.runInContext(fs.readFileSync(SND_PATH, "utf8"), sandbox, { filename: "snd-1.js" });
  return sandbox;
}

function parseOnce(sandbox, abcText) {
  const AbcCtor = sandbox.abc2svg && sandbox.abc2svg.Abc;
  assert(typeof AbcCtor === "function", "abc2svg constructor unavailable");
  const messages = [];
  const user = {
    img_out() {},
    err(m) { messages.push(String(m || "")); },
    errmsg(m) { messages.push(String(m || "")); },
  };
  const abc = new AbcCtor(user);
  abc.tosvg("test", String(abcText || ""));
  return { abc, messages };
}

const DRUM_TUNE = `X:1
T:Drum Hook Regression
M:4/4
L:1/8
Q:1/4=120
K:C
%%MIDI drumon
%%MIDI drum dddddddd 36 42 42 42 38 42 42 42
V:1
CDEF GABc|cBAG FEDC|]
`;

const DRUM_CONTINUATION_TUNE = `X:2
T:Drum Continuation Regression
M:10/8
L:1/16
K:C
%%MIDI drum d2dd2d2d2d
%%MIDI drum +: 64 62 62 64 62 62
%%MIDI drum +: 100 90 70 90 70 70
%%MIDI drumon
V:1
C2D2E2F2G2 |]
`;

function main() {
  const sandbox = createSandbox();
  assert(sandbox.abc2svg && sandbox.abc2svg.drum, "snd-1.js did not register abc2svg.drum");
  assert(typeof sandbox.abc2svg.drum === "object", "abc2svg.drum should remain an object in current upstream");
  assert(typeof sandbox.abc2svg.drum.beg_end === "function", "abc2svg.drum.beg_end missing");

  const drum = parseOnce(sandbox, DRUM_TUNE);
  assert(drum.messages.length === 0, `native drum tune reported errors: ${drum.messages.join("; ")}`);
  const continuation = parseOnce(sandbox, DRUM_CONTINUATION_TUNE);
  assert(continuation.messages.length === 0, `native drum continuation tune reported errors: ${continuation.messages.join("; ")}`);
  console.log("% PASS abc2svg playback harness: native drum hooks and continuations are available");
}

try {
  main();
} catch (error) {
  console.error("% FAIL abc2svg playback harness:", error && error.message ? error.message : String(error));
  process.exit(1);
}
