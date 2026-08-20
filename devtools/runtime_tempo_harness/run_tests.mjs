#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";

const bundled = await build({
  entryPoints: [resolve("src/renderer/playback/runtime_tempo_model.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const encoded = Buffer.from(bundled.outputFiles[0].text, "utf8").toString("base64");
const model = await import(`data:text/javascript;base64,${encoded}`);

assert.deepEqual(
  model.parseSimpleAbcTempo('X:1\nT:Test\nQ:"Andante" 1/4=120\nK:C\nC|\n'),
  { numerator: 1, denominator: 4, bpm: 120 },
);
assert.equal(model.parseSimpleAbcTempo("X:1\nQ:120\nK:C\nC|\n"), null);
assert.equal(model.parseSimpleAbcTempo("X:1\nQ:1/4 1/4=120\nK:C\nC|\n"), null);
assert.equal(model.parseSimpleAbcTempo("X:1\nK:C\nQ:1/4=120\nC|\n"), null);

assert.deepEqual(
  model.getRuntimeTempoPresentation("X:1\nQ:1/8=120\nK:C\nC|\n", 0.75),
  {
    tempo: { numerator: 1, denominator: 8, bpm: 120 },
    multiplier: 0.75,
    effectiveBpm: 90,
    label: "1/8 = 90 BPM",
  },
);
assert.equal(model.getRuntimeTempoPresentation("X:1\nQ:120\nK:C\n", 0.75).label, "75%");
assert.equal(model.stepRuntimeTempoMultiplier("X:1\nQ:1/4=120\nK:C\n", 0.75, 1), 91 / 120);
assert.equal(model.stepRuntimeTempoMultiplier("X:1\nQ:120\nK:C\n", 0.75, -1), 0.74);
assert.equal(model.clampRuntimeTempoMultiplier(0.1), 0.5);
assert.equal(model.clampRuntimeTempoMultiplier(2), 1.5);

console.log("runtime tempo harness: all tests passed");
