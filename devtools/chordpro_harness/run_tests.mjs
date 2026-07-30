import assert from "node:assert/strict";
import { build } from "esbuild";

async function importBundledModule(filePath) {
  const result = await build({ entryPoints: [filePath], bundle: true, format: "esm", platform: "node", write: false });
  const encoded = Buffer.from(result.outputFiles[0].text, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const {
  isChordProFilePath,
  isChordProText,
  parseChordProBlocks,
} = await importBundledModule("src/renderer/tools/chordpro/chordpro_model.js");

function test(name, fn) {
  fn();
  console.log(`% PASS ${name}`);
}

test("detects ChordPro text markers and file extensions", () => {
  assert.equal(isChordProText("{start_of_abc}\nX:1\n{end_of_abc}"), true);
  assert.equal(isChordProText("X:1\nT:Plain ABC"), false);
  assert.equal(isChordProFilePath("/tmp/song.cho"), true);
  assert.equal(isChordProFilePath("/tmp/song.chordpro"), true);
  assert.equal(isChordProFilePath("/tmp/song.abc"), false);
});

test("parses labeled ABC blocks and preserves offsets", () => {
  const text = [
    "{title: Song}",
    "{start_of_abc label=\"Intro\"}",
    "X:1",
    "T:Intro",
    "{end_of_abc}",
    "{start_of_abc: Main}",
    "X:2",
    "T:Main",
    "{end_of_abc}",
  ].join("\n");
  const parsed = parseChordProBlocks(text);
  assert.equal(parsed.warnings.length, 0);
  assert.equal(parsed.blocks.length, 2);
  assert.equal(parsed.blocks[0].label, "Intro");
  assert.equal(parsed.blocks[0].text, "X:1\nT:Intro\n");
  assert.equal(text.slice(parsed.blocks[1].startOffset, parsed.blocks[1].endOffset), "X:2\nT:Main\n");
});

test("handles CRLF line endings", () => {
  const text = "{start_of_abc title='CRLF'}\r\nX:3\r\nT:CRLF\r\n{end_of_abc}\r\n";
  const parsed = parseChordProBlocks(text);
  assert.equal(parsed.warnings.length, 0);
  assert.equal(parsed.blocks.length, 1);
  assert.equal(parsed.blocks[0].label, "CRLF");
  assert.equal(parsed.blocks[0].text, "X:3\r\nT:CRLF\r\n");
});

test("reports malformed marker pairs without dropping content", () => {
  const nested = parseChordProBlocks([
    "{start_of_abc}",
    "X:1",
    "{start_of_abc}",
    "X:2",
  ].join("\n"));
  assert.deepEqual(nested.warnings.map((warning) => warning.kind), [
    "abc-start-nested",
    "abc-start-without-end",
  ]);
  assert.equal(nested.blocks.length, 2);

  const endOnly = parseChordProBlocks("{end_of_abc}\n");
  assert.deepEqual(endOnly.warnings.map((warning) => warning.kind), ["abc-end-without-start"]);
  assert.equal(endOnly.blocks.length, 0);
});
