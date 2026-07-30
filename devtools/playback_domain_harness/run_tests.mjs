#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function importBundledModule(filePath) {
  const result = await build({
    entryPoints: [resolve(filePath)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  const source = result.outputFiles[0].text;
  const encoded = Buffer.from(source, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const { createPlaybackDomain } = await importBundledModule(
  "src/renderer/playback/playback_domain.js",
);

const trace = [];
const transport = {
  isPlaying: false,
  isPaused: false,
  waitingForFirstNote: false,
  playbackIndexOffset: 12,
  playbackLoopFromMeasure: 4,
  playbackLoopToMeasure: 8,
  playbackState: {
    byTime: [],
    byIstart: [],
    measureStarts: [],
  },
  appendTrace: (event) => trace.push(event),
};
let focusEnabled = true;
const domain = createPlaybackDomain({
  transport,
  selectionRuntime: {},
  getEditorLength: () => 100,
  getFocusModeEnabled: () => focusEnabled,
});

assert.equal(domain.isBusy(), false);
assert.equal(domain.isFollowEnabled(), true);
domain.setFollowEnabled(false);
assert.equal(domain.isFollowEnabled(), false);
transport.waitingForFirstNote = true;
assert.equal(domain.isBusy(), true);
transport.waitingForFirstNote = false;

assert.throws(
  () => domain.getPayload(),
  /Playback controller is not attached: payload/,
);

const calls = [];
domain.attach({
  abSelection: {
    getSelectionSettings: () => ({ suppressRepeats: false, allowMidiDrums: true }),
    getSelectionRange: () => ({ startOffset: 2, endOffset: 7 }),
    withTempPlaybackFlags: (flags, action) => {
      calls.push(["flags", flags]);
      return action();
    },
  },
  payload: {
    getPlaybackPayload: () => ({ text: "X:1\nK:C\n", offset: 12 }),
    getPlaybackSourceKey: () => "source-key",
  },
  transport: {
    setPlaybackRange: (range) => calls.push(["range", range]),
    stopPlaybackTransport: () => calls.push("stop"),
  },
});

assert.deepEqual(domain.getScopedSettingsForOrigin("focus"), {
  suppressRepeats: true,
  allowMidiDrums: true,
});
focusEnabled = false;
assert.deepEqual(domain.getScopedSettingsForOrigin("focus"), {
  suppressRepeats: false,
  allowMidiDrums: true,
});
assert.deepEqual(domain.withScopedOrigin({ loop: true }, "selection"), {
  loop: true,
  origin: "selection",
});
assert.equal(domain.toDerivedOffset(8), 20);
assert.equal(domain.toEditorOffset(20), 8);
assert.equal(domain.toDerivedOffset("bad"), null);
assert.equal(domain.getSourceKey(), "source-key");
assert.equal(domain.getPayload().offset, 12);
assert.deepEqual(domain.getSelectionRange(), { startOffset: 2, endOffset: 7 });
domain.setRange({ startOffset: 1, endOffset: 3 });
domain.stopTransport();
domain.appendTrace({ index: 5 });
assert.deepEqual(trace, [{ index: 5 }]);
assert.deepEqual(calls, [
  ["range", { startOffset: 1, endOffset: 3 }],
  "stop",
]);

const rendererSource = await readFile("src/renderer/renderer.js", "utf8");
assert.doesNotMatch(rendererSource, /function\s+getPlaybackPayload\s*\(/);
assert.doesNotMatch(rendererSource, /function\s+startPlaybackFromRange\s*\(/);
assert.doesNotMatch(rendererSource, /function\s+setPlaybackRange\s*\(/);
assert.doesNotMatch(rendererSource, /function\s+getScopedPlaybackSettingsForOrigin\s*\(/);
assert.doesNotMatch(rendererSource, /buildPlaybackStateModel|snapIstartToPlayableModel/);
assert.doesNotMatch(
  rendererSource,
  /playbackTransport\.[A-Za-z_$][A-Za-z0-9_$]*\s*=/,
);
assert.match(rendererSource, /createPlaybackDomain\s*\(/);

console.log("playback domain harness: all tests passed");
