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
    applyHeaderText: async () => headerResult,
    writeFileCopyAndSwitch: async (path, context) => {
      calls.push(["writeFileCopyAndSwitch", path, context]);
      return writeResult;
    },
  };
  const controller = createSaveFlowController({
    api,
    SAVE_INTENT: {},
    state: {
      getActiveFilePath: () => sourcePath,
      getActiveTuneId: () => "source-id",
      getActiveTuneMeta: () => ({ path: sourcePath, xNumber: "1", title: "Source", startOffset: 0, documentParts: {} }),
      getActiveTuneUid: () => "source-uid",
      getCurrentDocument: () => ({ path: sourcePath, content: snapshot.text, dirty: true }),
    getCurrentDocumentPath: () => sourcePath,
      getHeaderDirty: () => headerDirty,
      getHeaderEditorValue: () => "T: Source\n",
      getIsNewTuneDraft: () => false,
      getRawMode: () => false,
      isChordProEnabled: () => chordPro,
      isChordProFullView: () => true,
    },
    actions: {
      fileExists: api.fileExists,
      confirmOverwrite: async () => "replace",
      getDefaultSaveDir: () => "/tmp",
      getSuggestedBaseName: () => "source",
      getEditorValue: () => snapshot.text,
      getChordProFullText: () => snapshot.text,
      getLibraryIndex: () => null,
      loadLibraryFileIntoEditor: async () => ({ ok: true }),
      normalizeLibraryPath: (value) => String(value || ""),
      pathsEqual: (a, b) => String(a || "") === String(b || ""),
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
      getActiveTuneMeta: () => ({ path: sourcePath, xNumber: "1", documentParts: {
        header: "", before: "", active: baseline, after: "",
      } }),
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
      refreshLibraryFile: async () => null,
      reconcileActiveTuneAfterSave: () => {},
      setDirtyIndicator: () => {},
      setActiveFilePath: () => {},
      addRecentFolder: (entry) => calls.push(["addRecentFolder", entry]),
      safeDirname: () => "/tmp",
      withFileLock: async (_path, fn) => fn(),
    },
  });
  assert.equal(await direct.performSimpleTuneSave(sourcePath), true);
  assert.deepEqual(writes, [[sourcePath, edited, {}]]);
}

async function testDirectTuneSaveOverwritesExternalChangeFromParts() {
  const baseline = "X:1\nT:Source\nK:C\nC |]\n";
  const direct = createSaveFlowController({
    state: {
      getActiveTuneMeta: () => ({ path: "/tmp/source.abc", xNumber: "1", documentParts: {
        header: "", before: "", active: baseline, after: "",
      } }),
    },
    actions: {
      getEditorValue: () => baseline,
      readFile: async () => ({ ok: true, data: `${baseline}X:2\n` }),
      writeFile: async (path, data, options) => {
        assert.equal(path, "/tmp/source.abc");
        assert.deepEqual(options, {});
        assert.equal(data, baseline);
        return { ok: true };
      },
      withFileLock: async (_path, fn) => fn(),
    },
  });
  assert.equal(await direct.performSimpleTuneSave("/tmp/source.abc"), true);
}

async function testDirectTuneSaveReconstructsMissingParts() {
  const filePath = "/tmp/source.abc";
  const diskText = "%%MIDI program 1\nX:1\nT:Source\nK:C\nC |]\nX:2\nT:Other\nK:G\nG |]\n";
  const firstTuneEnd = diskText.indexOf("X:2");
  const writes = [];
  const controller = createSaveFlowController({
    state: {
      getActiveTuneMeta: () => ({
        path: filePath,
        xNumber: "1",
        startOffset: diskText.indexOf("X:1"),
        endOffset: firstTuneEnd,
        documentParts: { stale: true },
      }),
    },
    actions: {
      getEditorValue: () => "X:1\nT:Edited\nK:C\nD |]\n",
      readFile: async () => ({ ok: true, data: diskText }),
      splitFileIntoHeaderAndBody: (text) => ({
        headerText: "%%MIDI program 1\n",
        bodyText: text.slice("%%MIDI program 1\n".length),
      }),
      writeFile: async (path, text, options) => {
        writes.push([path, text, options]);
        return { ok: true };
      },
      refreshLibraryFile: async () => null,
      reconcileActiveTuneAfterSave: () => {},
      setActiveTuneMeta: () => {},
      patchCurrentDocument: () => {},
      setDirtyIndicator: () => {},
      setActiveFilePath: () => {},
      resetTransposePreviewState: () => {},
      updateFileHeaderPanel: () => {},
      updateLibraryStatus: () => {},
      scheduleRenderLibraryTree: () => {},
      withFileLock: async (_path, fn) => fn(),
    },
  });
  assert.equal(await controller.performSimpleTuneSave(filePath), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], filePath);
  assert.equal(writes[0][1], "%%MIDI program 1\nX:1\nT:Edited\nK:C\nD |]\nX:2\nT:Other\nK:G\nG |]\n");
}

async function testFailedPrimarySaveCreatesEmergencyCopy() {
  const filePath = "/missing/tunes.abc";
  const text = "X:1\nT:Recovered\nK:C\nC|\n";
  const writes = [];
  const stateCalls = [];
  let errorMessage = "";
  const controller = createSaveFlowController({
    api: {
      getRecoveryDir: async () => "/app/userData/recovery",
      pathJoin: (...parts) => parts.join("/"),
      mkdirp: async () => ({ ok: true }),
    },
    state: {
      getActiveTuneMeta: () => ({ path: filePath, xNumber: "1", documentParts: {
        header: "", before: "", active: text, after: "",
      } }),
      getCurrentDocument: () => ({ path: filePath, content: text, dirty: true }),
    },
    actions: {
      getEditorValue: () => text,
      readFile: async () => ({ ok: false, error: "ENOENT: missing directory" }),
      writeFile: async (path, data, options) => {
        writes.push({ path, data, options });
        return path === filePath ? { ok: false, error: "ENOENT: missing directory" } : { ok: true };
      },
      safeBasename: () => "tunes.abc",
      patchCurrentDocument: () => stateCalls.push("patchCurrentDocument"),
      setActiveFilePath: () => stateCalls.push("setActiveFilePath"),
      setDirtyIndicator: (value) => stateCalls.push(["setDirtyIndicator", value]),
      showSaveError: async (message) => { errorMessage = String(message); },
      withFileLock: async (_path, fn) => fn(),
    },
  });
  assert.equal(await controller.performSimpleTuneSave(filePath), false);
  assert.equal(writes.length, 2, "recovery must run only after the primary write fails");
  assert.equal(writes[0].path, filePath);
  assert.match(writes[1].path, /userData\/recovery\/tunes\.recovery-.*\.abc$/);
  assert.match(errorMessage, /Emergency copy saved/);
  assert.match(errorMessage, /remain unsaved/);
  assert.deepEqual(stateCalls, [], "failed save must keep active path and dirty state untouched");
}

async function testDirectSaveAsUsesCleanSourceAndDestinationGuard() {
  const sourcePath = "/tmp/source.abc";
  const destinationPath = "/tmp/copy.abc";
  const sourceText = "X:1\nT:Source\nK:C\nC |]\n";
  const editedText = "X:1\nT:Saved\nK:C\nD |]\n";
  const writes = [];
  const calls = [];
  let diskSourceText = sourceText;
  let currentDocument = { path: sourcePath, content: editedText, dirty: true };
  const controller = createSaveFlowController({
    state: {
      getActiveFilePath: () => sourcePath,
      getCurrentDocument: () => currentDocument,
      getCurrentDocumentPath: () => sourcePath,
      getActiveTuneMeta: () => ({ path: sourcePath, xNumber: "1", documentParts: {
        header: "", before: "", active: sourceText, after: "",
      } }),
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
      refreshLibraryFile: async () => null,
      loadLibraryFileIntoEditor: async () => ({ ok: true }),
      setDirtyIndicator: () => {},
      setActiveFilePath: () => {},
      addRecentFolder: (entry) => calls.push(["addRecentFolder", entry]),
      safeDirname: () => "/tmp",
      setFileNameMeta: () => {},
      updateFileHeaderPanel: () => {},
      updateWindowTitle: () => {},
      resetTransposePreviewState: () => {},
      withFileLock: async (_path, fn) => fn(),
    },
  });
  assert.equal(await controller.performSaveAsFlow(), true);
  assert.deepEqual(writes, [
    [sourcePath, editedText, {}],
    [destinationPath, editedText, {}],
  ]);
  assert.deepEqual(calls.find(([kind]) => kind === "addRecentFolder"), ["addRecentFolder", { path: "/tmp", label: "/tmp" }]);
}

async function testHeaderSaveWritesDirectlyWithDiskBaseline() {
  const path = "/tmp/header.abc";
  const baseline = "%%MIDI program 1\n\nX:1\nT:Song\nK:C\nC|\n";
  const writes = [];
  const controller = createSaveFlowController({
    state: {
      getActiveFilePath: () => path,
      getActiveTuneMeta: () => ({ path, xNumber: "1" }),
      getActiveTuneId: () => `${path}::1`,
    },
    actions: {
      readFile: async () => ({ ok: true, data: baseline }),
      writeFile: async (target, text, options) => {
        writes.push([target, text, options]);
        return { ok: true };
      },
      refreshLibraryFile: async () => ({ path, basename: "header.abc" }),
      markDiskConflictPath: () => {},
      updateHeaderStateUI: () => {},
      markHeaderClean: () => {},
      getActiveTuneMeta: () => ({ path }),
      withFileLock: async (_path, fn) => fn(),
    },
  });
  assert.deepEqual(
    await controller.saveFileHeaderText(path, "%%MIDI program 2"),
    { ok: true, action: "saved" },
  );
  assert.deepEqual(writes, [[path, "%%MIDI program 2\nX:1\nT:Song\nK:C\nC|\n", {}]]);
}

async function testChordProSaveAsWritesDirectly() {
  const sourcePath = "/tmp/source.cho";
  const destinationPath = "/tmp/copy.cho";
  const content = "{title: Song}\n{start_of_abc}\nX:1\nT:Song\nK:C\nC|\n{end_of_abc}\n";
  const writes = [];
  const controller = createSaveFlowController({
    state: {
      getActiveFilePath: () => sourcePath,
      getCurrentDocument: () => ({ path: sourcePath, content, dirty: true }),
      getCurrentDocumentPath: () => sourcePath,
      isChordProEnabled: () => true,
      isChordProFullView: () => true,
    },
    actions: {
      createNewFileAtPath: async (path, text) => {
        writes.push([path, text]);
        return true;
      },
      fileExists: async () => false,
      getDefaultSaveDir: () => "/tmp",
      getEditorValue: () => content,
      getChordProFullText: () => content,
      getSuggestedBaseName: () => "copy",
      showSaveDialog: async () => destinationPath,
      setActiveFilePath: () => {},
      setFileNameMeta: () => {},
      patchCurrentDocument: () => {},
      resetTransposePreviewState: () => {},
      updateWindowTitle: () => {},
    },
  });
  assert.equal(await controller.performSaveAsFlow(), true);
  assert.deepEqual(writes, [[destinationPath, content]]);
}

async function testCancelLeavesSourceUntouched() {
  const { controller, calls, snapshot, sourcePath } = makeController({ destination: null });
  const result = await controller.performSaveAsFlow();
  assert.equal(result, false);
  assert.equal(calls.some(([kind]) => kind === "writeFileCopyAndSwitch"), false);
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
    "Save As cancel must preserve the complete source baseline"
  );
}

await testChordProSaveAsWritesDirectly();
await testCancelLeavesSourceUntouched();
await testDirectTuneSaveWritesExpectedData();
await testDirectTuneSaveOverwritesExternalChangeFromParts();
await testDirectTuneSaveReconstructsMissingParts();
await testFailedPrimarySaveCreatesEmergencyCopy();
await testDirectSaveAsUsesCleanSourceAndDestinationGuard();
await testHeaderSaveWritesDirectlyWithDiskBaseline();
console.log("save flow harness: all tests passed");
