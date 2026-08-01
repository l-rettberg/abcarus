#!/usr/bin/env node
import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";

const result = await build({
  entryPoints: [resolve("src/renderer/library/new_file_action.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const encoded = Buffer.from(result.outputFiles[0].text, "utf8").toString("base64");
const { createNewFileAction } = await import(`data:text/javascript;base64,${encoded}`);

const paths = ["/music/new.abc", "/music/template.abc"];
const writes = [];
const action = createNewFileAction({
  api: {
    openWorkingCopy: async () => ({ ok: true }),
  },
  actions: {
    ensureSafeToAbandonCurrentDoc: async () => true,
    ensureXNumberInAbc: (text, number) => String(text).replace(/^X:\s*\d+/m, `X:${number}`),
    fileExists: async () => false,
    getDefaultSaveDir: () => "/music",
    getSuggestedBaseName: () => "NewTune",
    loadLibraryFileIntoEditor: async () => ({ ok: true }),
    mkdirp: async () => {},
    refreshLibraryFile: async () => null,
    refreshWorkingCopySnapshot: async () => null,
    safeBasename: (path) => String(path).split("/").pop(),
    safeDirname: () => "/music",
    showSaveDialog: async () => paths.shift(),
    withFileLock: async (_path, operation) => operation(),
    writeFile: async (path, content) => {
      writes.push({ path, content });
      return { ok: true };
    },
  },
});

await action.fileNew();
await action.fileNewFromTemplate();

assert.equal(writes.length, 2);
assert.deepEqual(writes[0], {
  path: "/music/new.abc",
  content: "X:1\nT:Untitled\nK:none\n",
});
assert.equal(writes[1].path, "/music/template.abc");
assert.equal((writes[1].content.match(/^X:/gm) || []).length, 1);
assert.match(writes[1].content, /^X:1\n/);
assert.match(writes[1].content, /T:Humoresque Dance/);

console.log("new file action harness: all tests passed");
