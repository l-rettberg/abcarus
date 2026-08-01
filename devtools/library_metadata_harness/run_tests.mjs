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

const { createLibraryMetadataController } = await importRendererModule(
  resolve("src/renderer/library/library_metadata_controller.js"),
);

function deferred() {
  let resolvePromise;
  const promise = new Promise((resolveValue) => {
    resolvePromise = resolveValue;
  });
  return { promise, resolve: resolvePromise };
}

{
  let libraryIndex = {
    root: "/music",
    files: [{ path: "/music/a.abc", tunes: [] }],
  };
  const scan = deferred();
  let scanCalls = 0;
  let renders = 0;
  const controller = createLibraryMetadataController({
    api: {
      scanLibrary: async () => {
        scanCalls += 1;
        return scan.promise;
      },
    },
    state: {
      getLibraryIndex: () => libraryIndex,
      setLibraryIndex: (next) => { libraryIndex = next; },
    },
    actions: {
      pathsEqual: (left, right) => left === right,
      scheduleRenderLibraryTree: () => { renders += 1; },
    },
  });

  const background = controller.ensureFullLibraryIndex({ reason: "group by title" });
  const startup = controller.ensureFullLibraryIndex({ reason: "library" });
  assert.equal(scanCalls, 1, "concurrent startup consumers must share one full scan");
  assert.equal(libraryIndex.indexMode, undefined);

  scan.resolve({
    root: "/music",
    files: [
      { path: "/music/a.abc", tunes: [{ id: "a" }] },
      { path: "/music/b.abc", tunes: [{ id: "b" }] },
    ],
  });
  assert.equal(await background, true);
  assert.equal(await startup, true);
  assert.equal(libraryIndex.indexMode, "full");
  assert.equal(libraryIndex.files.length, 2);
  assert.equal(renders, 1);
}

{
  let libraryIndex = { root: "/old", files: [] };
  const oldScan = deferred();
  const newScan = deferred();
  const calls = [];
  const controller = createLibraryMetadataController({
    api: {
      scanLibrary: async (root) => {
        calls.push(root);
        return root === "/old" ? oldScan.promise : newScan.promise;
      },
    },
    state: {
      getLibraryIndex: () => libraryIndex,
      setLibraryIndex: (next) => { libraryIndex = next; },
    },
    actions: {
      pathsEqual: (left, right) => left === right,
    },
  });

  const obsolete = controller.ensureFullLibraryIndex({ reason: "old folder" });
  libraryIndex = { root: "/new", files: [{ path: "/new/new.abc", tunes: [] }] };
  const current = controller.ensureFullLibraryIndex({ reason: "new folder" });
  assert.deepEqual(calls, ["/old", "/new"]);

  oldScan.resolve({ root: "/old", files: [{ path: "/old/old.abc", tunes: [] }] });
  assert.equal(await obsolete, false);
  assert.equal(libraryIndex.root, "/new");

  newScan.resolve({
    root: "/new",
    files: [{ path: "/new/new.abc", tunes: [{ id: "new" }] }],
  });
  assert.equal(await current, true);
  assert.equal(libraryIndex.root, "/new");
  assert.equal(libraryIndex.indexMode, "full");
}

{
  let libraryIndex = { root: "/music", files: [{ path: "/music/a.abc", tunes: [] }] };
  const controller = createLibraryMetadataController({
    api: {
      scanLibrary: async () => ({
        root: "/music",
        files: [],
        cancelled: true,
      }),
    },
    state: {
      getLibraryIndex: () => libraryIndex,
      setLibraryIndex: (next) => { libraryIndex = next; },
    },
  });

  assert.equal(await controller.ensureFullLibraryIndex(), false);
  assert.equal(libraryIndex.indexMode, undefined);
  assert.equal(libraryIndex.files.length, 1);
}

console.log("library metadata harness: all tests passed");
