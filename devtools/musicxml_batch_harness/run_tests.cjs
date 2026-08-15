#!/usr/bin/env node
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  convertAbcBatchToMusicXml,
  stripBatchOutputArgs,
} = require("../../src/main/conversion/backends/abc2xml");

async function main() {
  assert.deepEqual(
    stripBatchOutputArgs(["-r", "-m", "2", "3", "-o", "/tmp/out", "-t", "--mxl=add", "--mus53"]),
    ["-r", "--mus53"],
  );

  const result = await convertAbcBatchToMusicXml({
    python: process.env.PYTHON || "python3",
    scriptPath: path.resolve(__dirname, "../../third_party/abc2xml/abc2xml.py"),
    items: [
      { abcText: "%%scale 0.8\nX:1\nT:First tune\nM:4/4\nL:1/4\nK:C\nCDEF|\n" },
      { abcText: "%%scale 0.9\nX:1\nT:Second tune\nM:4/4\nL:1/4\nK:G\nGABc|\n" },
    ],
  });
  assert.equal(result.usedFallback, false);
  assert.equal(result.failures.length, 0);
  assert.equal(result.converted.length, 2);
  assert.match(result.converted[0].xmlText, /<work-title>First tune<\/work-title>/);
  assert.match(result.converted[1].xmlText, /<work-title>Second tune<\/work-title>/);
  assert.match(result.converted[0].xmlText, /<score-partwise/);
  console.log("musicxml batch harness: all tests passed");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
