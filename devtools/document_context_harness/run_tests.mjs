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

const { createDocumentLifecycleController } = await importRendererModule(
  resolve("src/renderer/app/document/document_lifecycle_controller.js")
);
const { createLibraryMetadataController } = await importRendererModule(
  resolve("src/renderer/library/library_metadata_controller.js")
);

function testBeginCleanFileDocumentClearsStaleSaveContext() {
  const calls = [];
  let currentDocument = null;
  let activeFilePath = "/tmp/old.abc";
  let dirtyIndicator = true;

  const controller = createDocumentLifecycleController({
    actions: {
      clearActiveTuneState: () => calls.push("clearActiveTuneState"),
      clearSaveSession: () => calls.push("clearSaveSession"),
      setActiveFilePath: (path) => { activeFilePath = path || ""; },
      setCurrentDocument: (doc) => { currentDocument = doc; },
      setDirtyIndicator: (next) => { dirtyIndicator = Boolean(next); },
      markHeaderClean: () => calls.push("markHeaderClean"),
      setTuneMetaText: (text) => calls.push(["setTuneMetaText", text]),
      setFileNameMeta: (text) => calls.push(["setFileNameMeta", text]),
      clearErrors: () => calls.push("clearErrors"),
      updateFileHeaderPanel: () => calls.push("updateFileHeaderPanel"),
      updateHeaderStateUi: () => calls.push("updateHeaderStateUi"),
    },
    constants: {
      untitledLabel: "Untitled",
    },
  });

  controller.beginCleanFileDocument({
    path: "/tmp/new.abc",
    content: "X:1\nT:New\nK:C\nC|\n",
    tuneLabel: "Untitled",
    fileLabel: "new",
  });

  assert.equal(activeFilePath, "/tmp/new.abc");
  assert.deepEqual(currentDocument, {
    path: "/tmp/new.abc",
    dirty: false,
    content: "X:1\nT:New\nK:C\nC|\n",
  });
  assert.equal(dirtyIndicator, false);
  assert.ok(calls.includes("clearActiveTuneState"), "active tune state must be reset before opening a clean file document");
  assert.ok(calls.includes("clearSaveSession"), "stale save session must be cleared before opening a clean file document");
  assert.ok(calls.includes("markHeaderClean"), "header state should be clean for a clean file document");
}

function testBeginFullFileModeContextClearsTuneBeforeSaveSession() {
  const calls = [];
  const controller = createDocumentLifecycleController({
    actions: {
      clearActiveTuneState: (path) => calls.push(["clearActiveTuneState", path]),
      clearSaveSession: () => calls.push(["clearSaveSession"]),
      setFullFileSaveSession: (path, source) => calls.push(["setFullFileSaveSession", path, source]),
    },
  });

  controller.beginFullFileModeContext("/tmp/song.pro", "chordpro_open");

  assert.deepEqual(calls, [
    ["clearActiveTuneState", "/tmp/song.pro"],
    ["clearSaveSession"],
    ["setFullFileSaveSession", "/tmp/song.pro", "chordpro_open"],
  ]);
}

function testDropActiveLibraryFileClearsSaveSession() {
  const activePath = "/tmp/library/active.abc";
  let libraryIndex = {
    root: "/tmp/library",
    files: [
      { path: activePath, basename: "active.abc", tunes: [] },
      { path: "/tmp/library/other.abc", basename: "other.abc", tunes: [] },
    ],
  };
  let activeFilePath = activePath;
  let activeTuneMeta = { path: activePath, tuneUid: "abc123" };
  let activeTuneId = "old-id";
  let activeTuneUid = "abc123";
  let activeTuneIndex = 0;
  let currentDocumentPath = activePath;
  let patchedDocument = null;
  let clearSaveCalls = 0;

  const controller = createLibraryMetadataController({
    state: {
      getLibraryIndex: () => libraryIndex,
      setLibraryIndex: (next) => { libraryIndex = next; },
      getActiveFilePath: () => activeFilePath,
      setActiveFilePath: (next) => { activeFilePath = next || ""; },
      getActiveTuneMeta: () => activeTuneMeta,
      setActiveTuneMeta: (next) => { activeTuneMeta = next; },
      getCurrentDocumentPath: () => currentDocumentPath,
      setActiveTuneId: (next) => { activeTuneId = next; },
      setActiveTuneUid: (next) => { activeTuneUid = next; },
      setActiveTuneIndex: (next) => { activeTuneIndex = next; },
    },
    actions: {
      clearSaveSession: () => { clearSaveCalls += 1; },
      invalidateLibraryView: () => {},
      patchCurrentDocument: (patch) => {
        patchedDocument = patch;
        currentDocumentPath = patch.path || "";
      },
      pathsEqual: (a, b) => String(a || "") === String(b || ""),
      setDirtyIndicator: () => {},
      updateLibraryStatus: () => {},
      scheduleRenderLibraryTree: () => {},
    },
  });

  const dropped = controller.dropLibraryFileEntry(activePath);

  assert.equal(dropped, true);
  assert.equal(libraryIndex.files.length, 1);
  assert.equal(activeFilePath, "");
  assert.equal(activeTuneMeta, null);
  assert.equal(activeTuneId, null);
  assert.equal(activeTuneUid, null);
  assert.equal(activeTuneIndex, null);
  assert.deepEqual(patchedDocument, { path: null, content: "", dirty: false });
  assert.equal(clearSaveCalls, 1, "dropping the active file must clear stale save session");
}

function testDropInactiveLibraryFileDoesNotClearSaveSession() {
  const activePath = "/tmp/library/active.abc";
  const inactivePath = "/tmp/library/inactive.abc";
  let libraryIndex = {
    root: "/tmp/library",
    files: [
      { path: activePath, basename: "active.abc", tunes: [] },
      { path: inactivePath, basename: "inactive.abc", tunes: [] },
    ],
  };
  let clearSaveCalls = 0;

  const controller = createLibraryMetadataController({
    state: {
      getLibraryIndex: () => libraryIndex,
      setLibraryIndex: (next) => { libraryIndex = next; },
      getActiveFilePath: () => activePath,
      getActiveTuneMeta: () => ({ path: activePath, tuneUid: "abc123" }),
      getCurrentDocumentPath: () => activePath,
    },
    actions: {
      clearSaveSession: () => { clearSaveCalls += 1; },
      invalidateLibraryView: () => {},
      patchCurrentDocument: () => {},
      pathsEqual: (a, b) => String(a || "") === String(b || ""),
      setDirtyIndicator: () => {},
      updateLibraryStatus: () => {},
      scheduleRenderLibraryTree: () => {},
    },
  });

  const dropped = controller.dropLibraryFileEntry(inactivePath);

  assert.equal(dropped, true);
  assert.equal(libraryIndex.files.length, 1);
  assert.equal(clearSaveCalls, 0, "dropping an inactive file should not disturb current save session");
}

testBeginCleanFileDocumentClearsStaleSaveContext();
testBeginFullFileModeContextClearsTuneBeforeSaveSession();
testDropActiveLibraryFileClearsSaveSession();
testDropInactiveLibraryFileDoesNotClearSaveSession();

console.log("[document_context_harness] OK");
