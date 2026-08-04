#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/renderer/library/sorting_filtering.js", "utf8");
const encoded = Buffer.from(source, "utf8").toString("base64");
const { sortLibraryFiles, sortGroupEntries } = await import(`data:text/javascript;base64,${encoded}`);

const files = [
  { path: "/music/old.abc", basename: "old.abc", updatedAtMs: 300, tunes: [] },
  { path: "/music/active.abc", basename: "active.abc", updatedAtMs: 100, tunes: [] },
  { path: "/music/new.abc", basename: "new.abc", updatedAtMs: 500, tunes: [] },
];
const options = {
  groupMode: "file",
  sortMode: "update_desc",
  activeFilePath: "/music/active.abc",
  pathsEqual: (left, right) => left === right,
};

assert.deepEqual(
  sortLibraryFiles(files, options).map((file) => file.path),
  ["/music/active.abc", "/music/new.abc", "/music/old.abc"],
  "active file must lead updated-desc sorting",
);
assert.deepEqual(
  sortLibraryFiles(files, { ...options, sortMode: "name_asc" }).map((file) => file.path),
  ["/music/active.abc", "/music/new.abc", "/music/old.abc"],
  "active file must lead name sorting",
);

const entries = sortGroupEntries(
  sortLibraryFiles(files, { ...options, sortMode: "name_desc" }).map((file) => ({
    ...file,
    id: file.path,
    label: file.basename,
    isFile: true,
    tuneCount: 0,
  })),
  { ...options, sortMode: "name_desc" },
);
assert.equal(entries[0].id, "/music/active.abc", "active file must lead file-group entries");
assert.deepEqual(
  entries.slice(1).map((entry) => entry.id),
  ["/music/old.abc", "/music/new.abc"],
  "non-active file order must retain the selected sort",
);

console.log("library sorting harness: all tests passed");
