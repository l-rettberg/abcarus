#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({
  entryPoints: ["src/renderer/tools/transforms/abc_transform_feature.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const source = result.outputFiles[0].text;
const encoded = Buffer.from(source, "utf8").toString("base64");
const { createAbcTransformFeature } = await import(`data:text/javascript;base64,${encoded}`);

const input = [
  "X:141",
  "T:Turkish sample",
  "L:1/8",
  "Q:1/8=120",
  "K:C",
  "V:1 clef=treble",
  "C D2 E/ F |",
].join("\n");
let output = "";
const statuses = [];
const feature = createAbcTransformFeature({
  windowRef: {},
  getEditorText: () => input,
  getHeaderText: () => "",
  getSettings: () => ({ useNativeTranspose: true }),
  applyTransformedText: (text) => { output = text; },
  setStatus: (status) => statuses.push(status),
  showTransformError: async (message) => { throw new Error(message); },
});

await feature.apply({ turkishNotation: { pitchSteps: -5, durationFactor: 2 } });
assert.match(output, /^L:1\/16$/m);
assert.match(output, /^Q:1\/8=60$/m);
assert.match(output, /G,2\s+A,4\s+B,\s+C2/);
assert.equal(statuses.at(-1), "OK");

console.log("turkish notation harness: all tests passed");
