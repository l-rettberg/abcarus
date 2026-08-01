#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: ["src/renderer/editor/abc_completion.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const encoded = Buffer.from(bundled.outputFiles[0].text, "utf8").toString("base64");
const { buildAbcCompletionSource } = await import(`data:text/javascript;base64,${encoded}`);

function runSource(lineText, lineFrom, relativePos, matchFrom) {
  const source = buildAbcCompletionSource();
  return source({
    pos: lineFrom + relativePos,
    state: {
      doc: {
        lineAt: () => ({ from: lineFrom, text: lineText }),
      },
    },
    matchBefore: () => ({
      from: matchFrom,
      to: lineFrom + relativePos,
      text: lineText.slice(0, relativePos),
    }),
  });
}

const directive = runSource("%%MI", 120, 4, 120);
assert.ok(directive && directive.options.length > 0);
assert.equal(directive.from, 120, "directive completion range must use absolute match.from");

const meter = runSource("M:3", 240, 3, 242);
assert.ok(meter && meter.options.length > 0);
assert.equal(meter.from, 242, "header value completion range must use absolute match.from");

const key = runSource("K:E", 360, 3, 362);
assert.ok(key && key.options.length > 0);
assert.equal(key.from, 362, "key completion must start after the field colon");

console.log("abc completion harness: all tests passed");
