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
const { createLibraryDocumentContext } = await importRendererModule(
  resolve("src/renderer/library/library_document_context.js")
);
const { createWorkingCopySyncController } = await importRendererModule(
  resolve("src/renderer/app/document/working_copy_sync_controller.js")
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

function testBeginRawFullFileContextPreservesTuneState() {
  const calls = [];
  const controller = createDocumentLifecycleController({
    actions: {
      clearActiveTuneState: () => calls.push(["clearActiveTuneState"]),
      clearSaveSession: () => calls.push(["clearSaveSession"]),
      setActiveFilePath: (path) => calls.push(["setActiveFilePath", path]),
      setFullFileSaveSession: (path, source) => calls.push(["setFullFileSaveSession", path, source]),
    },
  });

  controller.beginRawFullFileContext("/tmp/raw.abc", "raw_mode");

  assert.deepEqual(calls, [
    ["setActiveFilePath", "/tmp/raw.abc"],
    ["clearSaveSession"],
    ["setFullFileSaveSession", "/tmp/raw.abc", "raw_mode"],
  ]);
}

function testSetRawActiveTuneContextClearsStaleUidAndIndex() {
  const calls = [];
  const meta = { path: "/tmp/raw.abc", xNumber: "2" };
  const controller = createDocumentLifecycleController({
    actions: {
      setActiveTuneId: (value) => calls.push(["setActiveTuneId", value]),
      setActiveTuneUid: (value) => calls.push(["setActiveTuneUid", value]),
      setActiveTuneIndex: (value) => calls.push(["setActiveTuneIndex", value]),
      setActiveTuneMeta: (value) => calls.push(["setActiveTuneMeta", value]),
    },
  });

  controller.setRawActiveTuneContext("/tmp/raw.abc::2", meta);

  assert.deepEqual(calls, [
    ["setActiveTuneId", "/tmp/raw.abc::2"],
    ["setActiveTuneUid", null],
    ["setActiveTuneIndex", null],
    ["setActiveTuneMeta", meta],
  ]);
}

function testLibraryDocumentContextShowsCleanFileDocument() {
  const calls = [];
  const context = createLibraryDocumentContext({
    clearSaveSession: () => calls.push(["clearSaveSession"]),
    markActiveTuneButton: (id) => calls.push(["markActiveTuneButton", id]),
    markCurrentDocumentClean: () => calls.push(["markCurrentDocumentClean"]),
    setActiveTuneId: (id) => calls.push(["setActiveTuneId", id]),
    setActiveTuneUid: (uid) => calls.push(["setActiveTuneUid", uid]),
    setActiveTuneIndex: (index) => calls.push(["setActiveTuneIndex", index]),
    setActiveTuneMeta: (meta) => calls.push(["setActiveTuneMeta", meta]),
    setActiveTuneText: (text, meta, options) => calls.push(["setActiveTuneText", text, meta, options]),
    setCurrentDocument: (doc) => calls.push(["setCurrentDocument", doc]),
    setDirtyIndicator: (dirty) => calls.push(["setDirtyIndicator", dirty]),
  });

  context.showCleanFileDocument("/tmp/empty.abc", "");

  assert.deepEqual(calls, [
    ["setActiveTuneText", "", null, { suppressRecent: true }],
    ["setCurrentDocument", { path: "/tmp/empty.abc", dirty: false, content: "" }],
    ["setActiveTuneId", null],
    ["setActiveTuneUid", null],
    ["setActiveTuneIndex", null],
    ["setActiveTuneMeta", null],
    ["clearSaveSession"],
    ["markCurrentDocumentClean"],
    ["setDirtyIndicator", false],
    ["markActiveTuneButton", null],
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

function testWorkingCopyUidRecoveryRequiresTuneIdentity() {
  const text = "X:1\nT:First\nK:C\nC|\n\nX:2\nT:Second\nK:G\nG|\n";
  const secondStart = text.indexOf("X:2");
  let activeUid = "";
  let activeIndex = 1;
  let activeOffsets = null;
  const snapshot = {
    path: "/tmp/tunes.abc",
    text,
    version: 0,
    tunes: [
      { tuneUid: "uid-first", start: 0, end: secondStart },
      { tuneUid: "uid-second", start: secondStart, end: text.length },
    ],
  };
  const controller = createWorkingCopySyncController({
    state: {
      getActiveTuneIndex: () => activeIndex,
      getActiveTuneMeta: () => ({
        path: snapshot.path,
        xNumber: "2",
        title: "Second",
        startOffset: secondStart,
      }),
      getActiveTuneUid: () => activeUid,
      getWorkingCopySnapshot: () => snapshot,
    },
    actions: {
      pathsEqual: (a, b) => a === b,
      setActiveTuneIndex: (value) => { activeIndex = value; },
      setActiveTuneMetaOffsets: (start, end) => { activeOffsets = [start, end]; },
      setActiveTuneUid: (value) => { activeUid = value; },
    },
  });

  assert.equal(controller.tryResolveActiveTuneUidFromSnapshot(), true);
  assert.equal(activeUid, "uid-second");
  assert.equal(activeIndex, 1);
  assert.deepEqual(activeOffsets, [secondStart, text.length]);
}

function testWorkingCopyUidRecoveryRejectsStaleFirstTuneIndex() {
  const text = "X:1\nT:Replacement\nK:C\nC|\n\nX:2\nT:Second\nK:G\nG|\n";
  const secondStart = text.indexOf("X:2");
  let activeUid = "";
  const controller = createWorkingCopySyncController({
    state: {
      getActiveTuneIndex: () => 0,
      getActiveTuneMeta: () => ({
        path: "/tmp/tunes.abc",
        xNumber: "9",
        title: "Missing Original",
        startOffset: 0,
      }),
      getActiveTuneUid: () => activeUid,
      getWorkingCopySnapshot: () => ({
        path: "/tmp/tunes.abc",
        text,
        version: 0,
        tunes: [
          { tuneUid: "uid-replacement", start: 0, end: secondStart },
          { tuneUid: "uid-second", start: secondStart, end: text.length },
        ],
      }),
    },
    actions: {
      pathsEqual: (a, b) => a === b,
      setActiveTuneUid: (value) => { activeUid = value; },
    },
  });

  assert.equal(controller.tryResolveActiveTuneUidFromSnapshot(), false);
  assert.equal(activeUid, "", "a stale first-tune position must not acquire the replacement tune UID");
}

testBeginCleanFileDocumentClearsStaleSaveContext();
testBeginFullFileModeContextClearsTuneBeforeSaveSession();
testBeginRawFullFileContextPreservesTuneState();
testSetRawActiveTuneContextClearsStaleUidAndIndex();
testLibraryDocumentContextShowsCleanFileDocument();
testDropActiveLibraryFileClearsSaveSession();
testDropInactiveLibraryFileDoesNotClearSaveSession();
testWorkingCopyUidRecoveryRequiresTuneIdentity();
testWorkingCopyUidRecoveryRejectsStaleFirstTuneIndex();

console.log("[document_context_harness] OK");
