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
const { createLibraryLifecycleController } = await importRendererModule(
  resolve("src/renderer/library/library_lifecycle_controller.js")
);
const { createLibraryDocumentContext } = await importRendererModule(
  resolve("src/renderer/library/library_document_context.js")
);
const { createActiveTuneContextStore } = await importRendererModule(
  resolve("src/renderer/app/document/active_tune_context_store.js")
);
const { createSaveFlowController } = await importRendererModule(
  resolve("src/renderer/app/document/save_flow_controller.js")
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

function testLibraryDocumentContextUsesAtomicActiveContextClear() {
  const activeContext = createActiveTuneContextStore();
  activeContext.setActiveFilePath("/tmp/active.abc");
  activeContext.setActiveTuneId("legacy-id");
  activeContext.setActiveTuneUid("stable-uid");
  activeContext.setActiveTuneIndex(2);
  activeContext.setActiveTuneMeta({ path: "/tmp/active.abc", tuneUid: "stable-uid" });

  const context = createLibraryDocumentContext({
    activeTuneContext: activeContext,
    setActiveTuneText: () => {},
    setCurrentDocument: () => {},
  });

  context.showCleanFileDocument("/tmp/active.abc", "");

  assert.equal(activeContext.getActiveFilePath(), "/tmp/active.abc");
  assert.equal(activeContext.getActiveTuneId(), null);
  assert.equal(activeContext.getActiveTuneUid(), null);
  assert.equal(activeContext.getActiveTuneIndex(), null);
  assert.equal(activeContext.getActiveTuneMeta(), null);
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

function testLibraryReconcilesSavedTuneByStableIdentity() {
  let activeId = "/tmp/tunes.abc::10";
  let activeUid = "uid-second";
  let activeIndex = 1;
  let activeMeta = {
    path: "/tmp/tunes.abc",
    xNumber: "2",
    title: "Second",
  };
  let saveSession = null;
  const controller = createLibraryLifecycleController({
    state: {
      getActiveTuneId: () => activeId,
      getActiveTuneIndex: () => activeIndex,
      getActiveTuneMeta: () => activeMeta,
      getActiveTuneUid: () => activeUid,
    },
    actions: {
      buildTuneMetaLabel: (meta) => meta.title,
      markActiveTuneButton: () => {},
      safeBasename: (p) => String(p).split("/").pop(),
      setActiveTuneId: (value) => { activeId = value; },
      setActiveTuneIndex: (value) => { activeIndex = value; },
      setActiveTuneMeta: (value) => { activeMeta = value; },
      setActiveTuneUid: (value) => { activeUid = value; },
      setFileNameMeta: () => {},
      setSaveSession: (value) => { saveSession = value; },
      setTuneMetaText: () => {},
      stripFileExtension: (name) => String(name).replace(/\.[^.]+$/, ""),
    },
    constants: {
      SAVE_INTENT: { REPLACE_TUNE: "replace_tune" },
    },
  });
  const updatedFile = {
    path: "/tmp/tunes.abc",
    basename: "tunes.abc",
    tunes: [
      { id: "first", tuneUid: "uid-first", tuneIndex: 0, xNumber: "1", title: "First" },
      { id: "second-new-offset", tuneUid: "uid-second", tuneIndex: 1, xNumber: "2", title: "Second", startOffset: 22, endOffset: 50 },
    ],
  };

  assert.equal(controller.reconcileActiveTuneAfterSave(updatedFile.path, updatedFile), true);
  assert.equal(activeId, "second-new-offset");
  assert.equal(activeUid, "uid-second");
  assert.equal(activeIndex, 1);
  assert.equal(activeMeta.startOffset, 22);
  assert.equal(saveSession.targetTuneUid, "uid-second");
}

async function testSimpleTuneSaveIsOwnedBySaveController() {
  const filePath = "/tmp/tunes.abc";
  const sourceText = "X:2\nT:Second\nK:C\nD|\n";
  const editedText = "X:2\nT:Changed\nK:C\nE|\n";
  let writePayload = null;
  let reconciled = false;
  let patched = null;
  const controller = createSaveFlowController({
    state: {
      getActiveTuneMeta: () => ({
        path: filePath,
        xNumber: "2",
        startOffset: 0,
        endOffset: sourceText.length,
      }),
      getFileContentFromCache: () => sourceText,
      getHeaderEditorValue: () => "",
    },
    actions: {
      getEditorValue: () => editedText,
      readFile: async () => ({ ok: true, data: sourceText }),
      writeFile: async (path, data, options) => {
        writePayload = { path, data, options };
        return { ok: true };
      },
      markDiskConflictPath: () => {},
      patchCurrentDocument: (value) => { patched = value; },
      pathsEqual: (a, b) => a === b,
      reconcileActiveTuneAfterSave: () => { reconciled = true; },
      refreshLibraryFile: async () => ({ path: filePath, tunes: [] }),
      setActiveFilePath: () => {},
      setDirtyIndicator: () => {},
      setFileContentInCache: () => {},
      updateFileHeaderPanel: () => {},
      withFileLock: async (_path, fn) => fn(),
    },
  });

  assert.equal(await controller.performSimpleTuneSave(filePath), true);
  assert.deepEqual(writePayload, {
    path: filePath,
    data: editedText,
    options: {
      expectedData: sourceText,
    },
  });
  assert.deepEqual(patched, {
    path: filePath,
    content: editedText,
    dirty: false,
  });
  assert.equal(reconciled, true);
}

testBeginCleanFileDocumentClearsStaleSaveContext();
testBeginFullFileModeContextClearsTuneBeforeSaveSession();
testBeginRawFullFileContextPreservesTuneState();
testSetRawActiveTuneContextClearsStaleUidAndIndex();
testLibraryDocumentContextShowsCleanFileDocument();
testLibraryDocumentContextUsesAtomicActiveContextClear();
testDropActiveLibraryFileClearsSaveSession();
testDropInactiveLibraryFileDoesNotClearSaveSession();
testLibraryReconcilesSavedTuneByStableIdentity();
await testSimpleTuneSaveIsOwnedBySaveController();

console.log("[document_context_harness] OK");
