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

console.log("library lifecycle harness: all tests passed");
