#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function importRendererModule(filePath) {
  const source = await readFile(filePath, "utf8");
  const encoded = Buffer.from(source, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const { createWorkingCopyConflictController } = await importRendererModule(
  resolve("src/renderer/app/document/working_copy_conflict_controller.js")
);

async function testRawSaveCopyAsSwitchesAllFileContext() {
  const fromPath = "/tmp/source.abc";
  const targetPath = "/tmp/source_Copy.abc";
  const text = "%%abc-charset utf-8\nX:1\nT:Copy\nK:C\nC|\n";
  const calls = [];
  let snapshot = { path: fromPath, text, version: 7 };

  const controller = createWorkingCopyConflictController({
    api: {
      showSaveDialog: async () => targetPath,
      openWorkingCopy: async (path) => {
        calls.push(["openWorkingCopy", path]);
        return { ok: true };
      },
      writeWorkingCopyToPathAndSwitch: async (path, context) => {
        calls.push(["writeWorkingCopyToPathAndSwitch", path, context]);
        snapshot = { path, text, version: snapshot.version + 1 };
        return { ok: true };
      },
    },
    state: {
      getRawMode: () => true,
    },
    actions: {
      attachTuneUidsToLibraryFile: (path, snap) => calls.push(["attachTuneUidsToLibraryFile", path, snap.path]),
      refreshLibraryFile: async (path) => {
        calls.push(["refreshLibraryFile", path]);
        return { path, basename: "source_Copy.abc", headerEndOffset: 18 };
      },
      refreshWorkingCopySnapshot: async () => snapshot,
      recordNavFilePath: (path) => calls.push(["recordNavFilePath", path]),
      safeBasename: (path) => String(path || "").split("/").pop() || "",
      safeDirname: () => "/tmp",
      switchWorkingCopyFileContext: (path, options) => calls.push(["switchWorkingCopyFileContext", path, options]),
      setDirtyIndicator: (next) => calls.push(["setDirtyIndicator", Boolean(next)]),
      setEditorValueClean: (body) => calls.push(["setEditorValueClean", body]),
      setFileContentInCache: (path, body) => calls.push(["setFileContentInCache", path, body]),
      setFileNameMeta: (name) => calls.push(["setFileNameMeta", name]),
      setHeaderClean: () => calls.push(["setHeaderClean"]),
      setHeaderEditorValueClean: (header) => calls.push(["setHeaderEditorValueClean", header]),
      setRawModeHeaderEndOffset: (offset) => calls.push(["setRawModeHeaderEndOffset", offset]),
      updateHeaderStateUI: () => calls.push(["updateHeaderStateUI"]),
      patchCurrentDocument: (patch) => calls.push(["patchCurrentDocument", patch]),
      markDiskConflictPath: (path, flag) => calls.push(["markDiskConflictPath", path, Boolean(flag)]),
      splitFileIntoHeaderAndBody: (src) => ({
        headerText: String(src || "").slice(0, 18),
        bodyText: String(src || "").slice(18),
      }),
      withFileLock: async (_path, fn) => fn(),
    },
    utils: {
      pathsEqual: (a, b) => String(a || "") === String(b || ""),
    },
  });

  const result = await controller.saveWorkingCopyCopyAsAndSwitch(fromPath);

  assert.equal(result.ok, true);
  assert.equal(result.targetPath, targetPath);
  assert.deepEqual(
    calls.find((entry) => entry[0] === "writeWorkingCopyToPathAndSwitch"),
    [
      "writeWorkingCopyToPathAndSwitch",
      targetPath,
      { expectedPath: fromPath, expectedVersion: 7 },
    ],
    "Raw Save Copy As must bind the write to the source working-copy snapshot"
  );
  assert.deepEqual(
    calls.find((entry) => entry[0] === "switchWorkingCopyFileContext"),
    ["switchWorkingCopyFileContext", targetPath, { rawMode: true, source: "save_copy_as" }],
    "Raw Save Copy As must update active file, raw file path, and save context through one transition"
  );
  const docPatch = calls.find((entry) => entry[0] === "patchCurrentDocument");
  assert.equal(docPatch && docPatch[1] && docPatch[1].path, targetPath, "Raw Save Copy As must point the current document at the copied file");
  assert.equal(docPatch && docPatch[1] && docPatch[1].dirty, false, "Raw Save Copy As must leave the copied file clean");
}

try {
  await testRawSaveCopyAsSwitchesAllFileContext();
  console.log("[working_copy_conflict_harness] OK");
} catch (err) {
  console.log("[working_copy_conflict_harness] FAIL");
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
}
