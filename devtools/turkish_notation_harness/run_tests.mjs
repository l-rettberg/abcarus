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
  "M:10/16",
  "L:1/8",
  "Q:1/8=120",
  "K:C",
  "V:1 clef=treble transpose=-17",
  "C D E F |",
].join("\n");
let output = input;
const statuses = [];
const feature = createAbcTransformFeature({
  windowRef: {},
  getEditorText: () => output,
  getHeaderText: () => "",
  getSettings: () => ({ useNativeTranspose: true }),
  applyTransformedText: (text) => { output = text; },
  setStatus: (status) => statuses.push(status),
  showTransformError: async (message) => { throw new Error(message); },
});

await feature.apply({ turkishNotation: { direction: "toConcert" } });
assert.match(output, /^M:10\/8$/m);
assert.match(output, /^L:1\/4$/m);
assert.match(output, /^Q:1\/4=120$/m);
assert.doesNotMatch(output, /transpose\s*=\s*-17/);
assert.equal(statuses.at(-1), "OK");

await feature.apply({ turkishNotation: { direction: "toBolahenk" } });
assert.match(output, /^M:10\/16$/m);
assert.match(output, /^L:1\/8$/m);
assert.match(output, /^Q:1\/8=120$/m);
assert.match(output, /transpose\s*=\s*-17/);

console.log("turkish notation harness: all tests passed");
