#!/usr/bin/env node
import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";

const result = await build({
  entryPoints: [resolve("src/renderer/app/document/single_tune_document_model.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const encoded = Buffer.from(result.outputFiles[0].text, "utf8").toString("base64");
const { createSingleTuneDocument } = await import(`data:text/javascript;base64,${encoded}`);

const initial = {
  header: "H\n",
  before: "before\n",
  active: "X:1\nK:C\nC|\n",
  after: "after\n",
};
const document = createSingleTuneDocument(initial);

assert.equal(document.isDirty(), false);
assert.equal(document.compose(), "H\nbefore\nX:1\nK:C\nC|\nafter\n");

document.setActiveTune("X:1\nK:C\nD|\n");
assert.equal(document.isDirty(), true);
assert.equal(document.compose(), "H\nbefore\nX:1\nK:C\nD|\nafter\n");

document.setActiveTune(initial.active);
assert.equal(document.isDirty(), false, "reverting Active Tune must clear dirty state");

document.setHeader("H changed\n");
assert.equal(document.isDirty(), true);
assert.deepEqual(document.discard(), initial, "Don't Save must discard all four parts");
assert.equal(document.isDirty(), false);

document.setParts({ ...initial, before: "new before\n", after: "new after\n" });
assert.equal(document.isDirty(), true);
const saved = document.getParts();
document.markSaved(saved);
assert.equal(document.isDirty(), false);
assert.equal(document.compose(), "H\nnew before\nX:1\nK:C\nC|\nnew after\n");

console.log("single tune document harness: all tests passed");
