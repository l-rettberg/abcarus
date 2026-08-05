#!/usr/bin/env node
import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";

const result = await build({
  entryPoints: [resolve("src/renderer/library/paste_move_tune_action.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const encoded = Buffer.from(result.outputFiles[0].text, "utf8").toString("base64");
const { createPasteMoveTuneAction } = await import(`data:text/javascript;base64,${encoded}`);

const sourcePath = "/music/source.abc";
const targetPath = "/music/target.abc";
const source = "X:1\nT:Source\nK:C\nC D|\n\nX:2\nT:Keep\nK:C\nE F|\n";
const target = "X:9\nT:Target\nK:C\nG A|\n";
const files = new Map([[sourcePath, source], [targetPath, target]]);
const sourceStart = source.indexOf("X:2");
const sourceEnd = source.length;
const writes = [];
const refreshes = [];
const conflicts = [];
const errors = [];
let failSourceWrite = false;
let activeDirty = false;
let activePath = "";
let clipboard = {
  text: source.slice(sourceStart, sourceEnd),
  sourcePath,
  tuneId: "source-tune-2",
  mode: "move",
};

const action = createPasteMoveTuneAction({
  state: {
    getActiveFilePath: () => activePath,
    getActiveTuneId: () => "unrelated-tune",
    getActiveTuneMeta: () => null,
    getClipboardTune: () => clipboard,
    getHeaderDirty: () => false,
    getIsNewTuneDraft: () => false,
    hasGlobalUnsavedChanges: () => activeDirty,
    isCurrentDocumentDirty: () => activeDirty,
  },
  actions: {
    clearClipboardTune: () => { clipboard = null; },
    confirmAppendToFile: async () => "append",
    ensureXNumberInAbc: (text, number) => String(text).replace(/^X:\s*\d+/m, `X:${number}`),
    findTuneById: () => ({
      file: { path: sourcePath },
      tune: { startOffset: sourceStart, endOffset: sourceEnd },
    }),
    getActiveEditFilePath: () => "",
    getNextXNumber: (text) => {
      const values = Array.from(String(text).matchAll(/^X:\s*(\d+)/gm), (m) => Number(m[1]));
      return Math.max(0, ...values) + 1;
    },
    getTuneText: async () => source.slice(sourceStart, sourceEnd),
    pathsEqual: (left, right) => left === right,
    readFile: async (filePath) => ({ ok: true, data: files.get(filePath) }),
    markDiskConflictPath: (path, hasConflict) => conflicts.push([path, hasConflict]),
    refreshLibraryFile: async (path, options) => { refreshes.push([path, options]); return null; },
    removeTuneFromContent: (text, start, end) => String(text).slice(0, start) + String(text).slice(end),
    renumberXInTextKeepingFirst: (text) => ({ ok: true, abcText: text }),
    requireCleanForFileOp: async () => true,
    setActiveFilePath: (path) => { activePath = path; },
    setClipboardTune: (next) => { clipboard = next; },
    setStatus: () => {},
    selectTune: async () => ({ ok: true }),
    showSaveError: async (message) => { errors.push(String(message)); },
    withFileLocks: async (_paths, operation) => operation(),
    writeFile: async (filePath, data, options = {}) => {
      writes.push({ filePath, data, expectedData: options.expectedData });
      if (filePath === sourcePath && failSourceWrite) {
        failSourceWrite = false;
        return { ok: false, conflict: true, error: "File changed on disk." };
      }
      if (files.get(filePath) !== options.expectedData) return { ok: false, conflict: true, error: "File changed on disk." };
      files.set(filePath, String(data));
      return { ok: true };
    },
  },
});

await action.pasteClipboardToFile(targetPath);

assert.equal(writes.length, 2, "move must write target and source directly");
assert.equal(writes[0].filePath, targetPath);
assert.equal(writes[1].filePath, sourcePath);
assert.equal(writes[0].expectedData, target);
assert.equal(writes[1].expectedData, source);
assert.match(files.get(targetPath), /^X:9[\s\S]*X:10/m);
assert.doesNotMatch(files.get(sourcePath), /T:Keep/);
assert.equal(clipboard, null, "clipboard must clear only after both writes succeed");

files.set(sourcePath, source);
files.set(targetPath, target);
writes.length = 0;
refreshes.length = 0;
conflicts.length = 0;
errors.length = 0;
clipboard = {
  text: source.slice(sourceStart, sourceEnd),
  sourcePath,
  tuneId: "source-tune-2",
  mode: "move",
};
failSourceWrite = true;
await action.pasteClipboardToFile(targetPath);
assert.equal(files.get(targetPath), target, "successful target write must be rolled back when source write fails");
assert.equal(files.get(sourcePath), source, "source must remain unchanged after failed move");
assert.deepEqual(refreshes, [
  [targetPath, { force: true }],
  [sourcePath, { force: true }],
], "Library must refresh both files after rollback");
assert.deepEqual(conflicts, [
  [sourcePath, true],
  [targetPath, false],
], "only the externally conflicting source remains marked");
assert.match(errors.join("\n"), /File changed on disk/i);
assert.equal(clipboard.mode, "move", "failed move must keep clipboard state for retry");

files.set(sourcePath, source);
files.set(targetPath, target);
writes.length = 0;
errors.length = 0;
clipboard = {
  text: source.slice(sourceStart, sourceEnd),
  sourcePath,
  tuneId: "source-tune-2",
  mode: "move",
};
activeDirty = true;
await action.pasteClipboardToFile(targetPath);
assert.equal(writes.length, 0, "dirty active tune must block structural move");
assert.match(errors.join("\n"), /unsaved changes/i);

console.log("library move harness: all tests passed");
