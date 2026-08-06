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

const { createLibraryLifecycleController } = await importRendererModule(
  resolve("src/renderer/library/library_lifecycle_controller.js"),
);

{
  const sibling = {
    path: "/music/b.abc",
    basename: "b.abc",
    tunes: [{ id: "b" }],
  };
  let libraryIndex = {
    root: "/music",
    files: [
      { path: "/music/a.abc", basename: "a.abc", tunes: [] },
      sibling,
    ],
    indexMode: "full",
  };
  const parsedFile = {
    path: "/music/a.abc",
    basename: "a.abc",
    tunes: [{ id: "a" }],
  };
  const controller = createLibraryLifecycleController({
    api: {
      parseLibraryFile: async () => ({
        root: "/music",
        files: [parsedFile],
      }),
    },
    state: {
      getLibraryIndex: () => libraryIndex,
      setLibraryIndex: (next) => { libraryIndex = next; },
    },
    actions: {
      pathsEqual: (left, right) => left === right,
      safeBasename: (value) => String(value || "").split("/").pop(),
      safeDirname: (value) => String(value || "").replace(/\/[^/]*$/, ""),
    },
  });

  assert.equal(await controller.loadSingleLibraryFile("/music/a.abc"), parsedFile);
  assert.equal(libraryIndex.root, "/music");
  assert.equal(libraryIndex.indexMode, "full");
  assert.equal(libraryIndex.files.length, 2);
  assert.equal(libraryIndex.files[0], parsedFile);
  assert.equal(libraryIndex.files[1], sibling);
}

{
  let libraryIndex = {
    root: "/old",
    files: [{ path: "/old/a.abc", tunes: [] }],
    indexMode: "full",
  };
  const controller = createLibraryLifecycleController({
    api: {
      parseLibraryFile: async () => ({
        root: "/new",
        files: [{ path: "/new/a.abc", basename: "a.abc", tunes: [{ id: "new" }] }],
      }),
    },
    state: {
      getLibraryIndex: () => libraryIndex,
      setLibraryIndex: (next) => { libraryIndex = next; },
    },
    actions: {
      pathsEqual: (left, right) => left === right,
      safeBasename: (value) => String(value || "").split("/").pop(),
      safeDirname: (value) => String(value || "").replace(/\/[^/]*$/, ""),
    },
  });

  await controller.loadSingleLibraryFile("/new/a.abc");
  assert.equal(libraryIndex.root, "/new");
  assert.equal(libraryIndex.indexMode, "single");
  assert.equal(libraryIndex.files.length, 1);
}

{
  let libraryIndex = {
    root: "/music",
    files: [{
      path: "/music/a.abc",
      basename: "a.abc",
      tunes: [{ id: "/music/a.abc::1", tuneUid: "a-1", startOffset: 0, endOffset: 18, xNumber: "1", title: "A" }],
    }],
  };
  let activeFilePath = "";
  let renders = 0;
  const controller = createLibraryLifecycleController({
    state: {
      getLibraryIndex: () => libraryIndex,
      getRawMode: () => false,
    },
    actions: {
      pathsEqual: (left, right) => left === right,
      readFile: async () => ({ ok: true, data: "X:1\nT:A\nK:C\nC D E |\n" }),
      setActiveFilePath: (value) => { activeFilePath = value || ""; },
      setActiveTuneMeta: () => {},
      setActiveTuneId: () => {},
      setActiveTuneUid: () => {},
      setActiveTuneIndex: () => {},
      setActiveTuneText: (text, metadata) => { activeFilePath = metadata.path; },
      scheduleRenderLibraryTree: () => { renders += 1; },
      splitFileIntoHeaderAndBody: (text) => ({ headerText: "", bodyText: text }),
      safeBasename: (value) => String(value || "").split("/").pop(),
      ensureSafeToAbandonCurrentDoc: async () => true,
      markActiveTuneButton: () => {},
      resetPlaybackState: () => {},
      setDirtyIndicator: () => {},
      setPlaybackRange: () => {},
    },
  });
  const result = await controller.selectTune("a-1", { skipConfirm: true });
  assert.equal(result.ok, true);
  assert.equal(activeFilePath, "/music/a.abc");
  assert.equal(renders, 1, "selecting a tune must refresh Library ordering");
}

console.log("library lifecycle harness: all tests passed");
