#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function importRendererModule(filePath) {
  const source = await readFile(filePath, "utf8");
  const encoded = Buffer.from(source, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const { createSaveFlowController } = await importRendererModule(
  resolve("src/renderer/app/document/save_flow_controller.js")
);

function makeController({
  chordPro = false,
  flushTuneResult = { ok: true },
  flushFullResult = { ok: true },
  headerDirty = false,
  headerResult = { ok: true },
  destination = undefined,
  writeResult = { ok: true },
} = {}) {
  const calls = [];
  const sourcePath = "/tmp/source.abc";
  const destinationPath = "/tmp/destination.abc";
  const snapshot = {
    path: sourcePath,
    text: "X:1\nT:Source\nK:C\nC |]\n",
    version: 4,
    dirty: true,
  };
  const api = {
    fileExists: async () => false,
    applyWorkingCopyHeaderText: async () => headerResult,
    writeWorkingCopyToPathAndSwitch: async (path, context) => {
      calls.push(["writeWorkingCopyToPathAndSwitch", path, context]);
      return writeResult;
    },
  };
  const controller = createSaveFlowController({
    api,
    SAVE_INTENT: {},
    state: {
      getActiveFilePath: () => sourcePath,
      getActiveTuneId: () => "source-id",
      getActiveTuneMeta: () => ({ path: sourcePath, xNumber: "1", title: "Source", startOffset: 0 }),
      getActiveTuneUid: () => "source-uid",
      getCurrentDocument: () => ({ path: sourcePath, content: snapshot.text, dirty: true }),
    getCurrentDocumentPath: () => sourcePath,
      getHeaderDirty: () => headerDirty,
      getHeaderEditorValue: () => "T: Source\n",
      getIsNewTuneDraft: () => false,
      getRawMode: () => false,
      getWorkingCopySnapshot: () => snapshot,
      getWorkingCopyOpenError: () => "",
      isChordProEnabled: () => chordPro,
      isChordProFullView: () => true,
    },
    actions: {
      ensureWorkingCopyOpenForPath: async () => ({ ok: true }),
      flushWorkingCopyTuneSync: async () => flushTuneResult,
      flushWorkingCopyFullSync: async () => flushFullResult,
      fileExists: api.fileExists,
      confirmOverwrite: async () => "replace",
      getDefaultSaveDir: () => "/tmp",
      getSuggestedBaseName: () => "source",
      getEditorValue: () => snapshot.text,
      getChordProFullText: () => snapshot.text,
      getLibraryIndex: () => null,
      isWorkingCopyOpenForFile: () => true,
      loadLibraryFileIntoEditor: async () => ({ ok: true }),
      normalizeLibraryPath: (value) => String(value || ""),
      pathsEqual: (a, b) => String(a || "") === String(b || ""),
      refreshWorkingCopySnapshot: async () => snapshot,
      setDirtyIndicator: (value) => calls.push(["setDirtyIndicator", value]),
      showSaveDialog: async () => {
        calls.push(["showSaveDialog"]);
        return destination === undefined ? destinationPath : destination;
      },
      showSaveError: async (message) => calls.push(["showSaveError", message]),
      updateWindowTitle: () => calls.push(["updateWindowTitle"]),
      updateHeaderStateUI: () => calls.push(["updateHeaderStateUI"]),
      markHeaderClean: () => calls.push(["markHeaderClean"]),
      resetTransposePreviewState: () => {},
      refreshLibraryFile: async () => null,
      setFileContentInCache: () => {},
      setFileNameMeta: () => {},
      setActiveFilePath: () => calls.push(["setActiveFilePath"]),
      patchCurrentDocument: () => calls.push(["patchCurrentDocument"]),
      updateFileHeaderPanel: () => {},
      scheduleRenderLibraryTree: () => {},
      updateLibraryStatus: () => {},
      withFileLock: async (_path, fn) => fn(),
    },
  });
  return { controller, calls, snapshot, sourcePath, destinationPath };
}

async function testDirectTuneSaveWritesExpectedData() {
  const baseline = "X:1\nT:Source\nK:C\nC |]\n";
  const edited = "X:1\nT:Edited\nK:C\nD |]\n";
  const writes = [];
  const { calls, sourcePath } = makeController();
  const direct = createSaveFlowController({
    state: {
      getActiveTuneMeta: () => ({ path: sourcePath, xNumber: "1", startOffset: 0, endOffset: baseline.length }),
      getFileContentFromCache: () => baseline,
      getHeaderDirty: () => false,
    },
    actions: {
      getEditorValue: () => edited,
      readFile: async () => ({ ok: true, data: baseline }),
      writeFile: async (path, data, options) => {
        writes.push([path, data, options]);
        return { ok: true };
      },
      patchCurrentDocument: () => calls.push(["patchCurrentDocument"]),
      setFileContentInCache: () => {},
      refreshLibraryFile: async () => null,
      reconcileActiveTuneAfterSave: () => {},
      setDirtyIndicator: () => {},
      setActiveFilePath: () => {},
      withFileLock: async (_path, fn) => fn(),
    },
  });
  assert.equal(await direct.performSimpleTuneSave(sourcePath), true);
  assert.deepEqual(writes, [[sourcePath, edited, { expectedData: baseline }]]);
}

async function testDirectTuneSaveRejectsExternalChange() {
  const baseline = "X:1\nT:Source\nK:C\nC |]\n";
  const direct = createSaveFlowController({
    state: {
      getActiveTuneMeta: () => ({ path: "/tmp/source.abc", xNumber: "1", startOffset: 0, endOffset: baseline.length }),
      getFileContentFromCache: () => baseline,
    },
    actions: {
      getEditorValue: () => baseline,
      readFile: async () => ({ ok: true, data: `${baseline}X:2\n` }),
      writeFile: async () => { throw new Error("write must not be reached"); },
      showSaveError: async (message) => { assert.match(message, /changed on disk/i); },
      markDiskConflictPath: (path, value) => { assert.equal(path, "/tmp/source.abc"); assert.equal(value, true); },
      withFileLock: async (_path, fn) => fn(),
    },
  });
  assert.equal(await direct.performSimpleTuneSave("/tmp/source.abc"), false);
}

async function testDirectSaveAsUsesCleanSourceAndDestinationGuard() {
  const sourcePath = "/tmp/source.abc";
  const destinationPath = "/tmp/copy.abc";
  const sourceText = "X:1\nT:Source\nK:C\nC |]\n";
  const editedText = "X:1\nT:Saved\nK:C\nD |]\n";
  const writes = [];
  let diskSourceText = sourceText;
  let currentDocument = { path: sourcePath, content: editedText, dirty: true };
  const controller = createSaveFlowController({
    state: {
      getActiveFilePath: () => sourcePath,
      getCurrentDocument: () => currentDocument,
      getCurrentDocumentPath: () => sourcePath,
      getActiveTuneMeta: () => ({ path: sourcePath, xNumber: "1", startOffset: 0, endOffset: sourceText.length }),
      getFileContentFromCache: () => sourceText,
      getHeaderDirty: () => false,
    },
    actions: {
      getActiveFilePath: () => sourcePath,
      getEditorValue: () => editedText,
      readFile: async (path) => ({ ok: true, data: path === sourcePath ? diskSourceText : "old destination" }),
      writeFile: async (path, data, options) => {
        writes.push([path, data, options]);
        if (path === sourcePath) diskSourceText = data;
        return { ok: true };
      },
      fileExists: async (path) => path === destinationPath,
      confirmOverwrite: async () => "replace",
      getSuggestedBaseName: () => "copy",
      getDefaultSaveDir: () => "/tmp",
      showSaveDialog: async () => destinationPath,
      patchCurrentDocument: (patch) => { currentDocument = { ...currentDocument, ...patch }; },
      setFileContentInCache: () => {},
      refreshLibraryFile: async () => null,
      loadLibraryFileIntoEditor: async () => ({ ok: true }),
      setDirtyIndicator: () => {},
      setActiveFilePath: () => {},
      setFileNameMeta: () => {},
      updateFileHeaderPanel: () => {},
      updateWindowTitle: () => {},
      resetTransposePreviewState: () => {},
      withFileLock: async (_path, fn) => fn(),
    },
  });
  assert.equal(await controller.performSaveAsFlow(), true);
  assert.deepEqual(writes, [
    [sourcePath, editedText, { expectedData: sourceText }],
    [destinationPath, editedText, { expectedData: "old destination" }],
  ]);
}

async function testTuneSyncFailureStopsBeforeDialog() {
  const { controller, calls } = makeController({ flushTuneResult: { ok: false, error: "tune sync failed" } });
  const result = await controller.performSaveAsFlow();
  assert.equal(result, false);
  assert.equal(calls.some(([kind]) => kind === "showSaveDialog"), false);
  assert.match(calls.find(([kind]) => kind === "showSaveError")?.[1] || "", /tune sync failed/);
}

async function testHeaderFailureStopsBeforeDialog() {
  const { controller, calls } = makeController({ headerDirty: true, headerResult: { ok: false, error: "header sync failed" } });
  const result = await controller.performSaveAsFlow();
  assert.equal(result, false);
  assert.match(calls.find(([kind]) => kind === "showSaveError")?.[1] || "", /header sync failed/);
}

async function testChordProFailureStopsBeforeDialog() {
  const { controller, calls } = makeController({ chordPro: true, flushFullResult: { ok: false, error: "full sync failed" } });
  const result = await controller.performSaveAsFlow();
  assert.equal(result, false);
  assert.match(calls.find(([kind]) => kind === "showSaveError")?.[1] || "", /full sync failed/);
}

async function testCancelLeavesSourceUntouched() {
  const { controller, calls, snapshot, sourcePath } = makeController({ destination: null });
  const result = await controller.performSaveAsFlow();
  assert.equal(result, false);
  assert.equal(calls.some(([kind]) => kind === "writeWorkingCopyToPathAndSwitch"), false);
  assert.equal(calls.some(([kind]) => kind === "setActiveFilePath"), false);
  assert.equal(calls.some(([kind]) => kind === "patchCurrentDocument"), false);
  assert.deepEqual(
    snapshot,
    {
      path: sourcePath,
      text: "X:1\nT:Source\nK:C\nC |]\n",
      version: 4,
      dirty: true,
    },
    "Save As cancel must preserve the complete source working-copy state"
  );
}

async function testDestinationFailureLeavesSourceUntouched() {
  const { controller, calls, snapshot, sourcePath } = makeController({ writeResult: { ok: false, error: "destination write failed" } });
  const result = await controller.performSaveAsFlow();
  assert.equal(result, false);
  assert.match(calls.find(([kind]) => kind === "showSaveError")?.[1] || "", /destination write failed/);
  assert.equal(calls.some(([kind]) => kind === "setActiveFilePath"), false);
  assert.equal(calls.some(([kind]) => kind === "patchCurrentDocument"), false);
  assert.deepEqual(
    snapshot,
    {
      path: sourcePath,
      text: "X:1\nT:Source\nK:C\nC |]\n",
      version: 4,
      dirty: true,
    },
    "Destination write failure must preserve the complete source working-copy state"
  );
}

await testTuneSyncFailureStopsBeforeDialog();
await testHeaderFailureStopsBeforeDialog();
await testChordProFailureStopsBeforeDialog();
await testCancelLeavesSourceUntouched();
await testDestinationFailureLeavesSourceUntouched();
await testDirectTuneSaveWritesExpectedData();
await testDirectTuneSaveRejectsExternalChange();
await testDirectSaveAsUsesCleanSourceAndDestinationGuard();
console.log("save flow harness: all tests passed");
