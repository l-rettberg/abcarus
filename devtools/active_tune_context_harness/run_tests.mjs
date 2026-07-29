#!/usr/bin/env node
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: ["src/renderer/app/document/active_tune_context_store.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const encoded = Buffer.from(bundled.outputFiles[0].text, "utf8").toString("base64");
const { createActiveTuneContextStore } = await import(`data:text/javascript;base64,${encoded}`);

const context = createActiveTuneContextStore();
assert.deepEqual(context.snapshot(), {
  filePath: null,
  tuneId: null,
  tuneUid: null,
  tuneIndex: null,
  tuneMeta: null,
});

context.setActiveFilePath("/music/set.abc");
context.setActiveTuneId("/music/set.abc::12");
context.setActiveTuneIndex("3");
context.setActiveTuneUid("uid-3");
const meta = { path: "/music/set.abc", tuneUid: "", startOffset: 12, endOffset: 40 };
context.setActiveTuneMeta(meta);
assert.equal(context.getActiveTuneIndex(), 3);
assert.equal(context.getActiveTuneUid(), "uid-3");
assert.equal(meta.tuneUid, "uid-3", "metadata must track the canonical tune UID");

context.setActiveTuneUid("uid-4");
assert.equal(meta.tuneUid, "uid-4", "UID updates must propagate to active metadata");
assert.equal(context.setTuneMetaOffsets(20, 60), true);
assert.equal(meta.startOffset, 20);
assert.equal(meta.endOffset, 60);

context.setActiveTuneIndex(null);
assert.equal(context.getActiveTuneIndex(), null, "null tune indexes must not normalize to zero");
context.setActiveTuneIndex(3);
context.clearTune();
assert.equal(context.getActiveFilePath(), "/music/set.abc", "clearing a tune must preserve the active file");
assert.equal(context.getActiveTuneId(), null);
assert.equal(context.getActiveTuneUid(), null);
assert.equal(context.getActiveTuneIndex(), null);
assert.equal(context.getActiveTuneMeta(), null);

const restoredMeta = { tuneUid: "restored-uid" };
context.setActiveTuneMeta(restoredMeta);
assert.equal(context.getActiveTuneUid(), "restored-uid", "metadata may restore a missing UID");

context.clear({ nextFilePath: "/music/other.abc" });
assert.equal(context.getActiveFilePath(), "/music/other.abc");
assert.equal(context.getActiveTuneMeta(), null);

console.log("active tune context harness: all tests passed");
