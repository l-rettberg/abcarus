#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { extractTuneHeader, parseCatalogGroupValues } = require("../../src/main/library_metadata.js");

async function importRendererModule(filePath) {
  const source = await readFile(filePath, "utf8");
  const encoded = Buffer.from(source, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const { buildGroupEntries, getGroupValues } = await importRendererModule("src/renderer/library/group_entries.js");
const { applyLibraryTextFilter } = await importRendererModule("src/renderer/library/sorting_filtering.js");
const { createLibraryViewStore } = await importRendererModule("src/renderer/library/store.js");

const lines = [
  "X:1",
  "T:Example",
  "G:[makam] Hicaz",
  "G:[form] Longa",
  "G:[makam] Hicaz",
  "G:[cultural] Ottoman Armenian",
  "G:Legacy collection",
  "K:C",
  "",
  "C D E F|",
];
const header = extractTuneHeader(lines, 0, lines.length - 1);
assert.deepEqual(header.groups, [
  "[makam] Hicaz",
  "[form] Longa",
  "[cultural] Ottoman Armenian",
  "Legacy collection",
]);
assert.equal(header.group, "[makam] Hicaz", "legacy group remains the first G value");
assert.deepEqual(header.catalogFacets, {
  makam: ["Hicaz"],
  form: ["Longa"],
  cultural: ["Ottoman Armenian"],
});
assert.deepEqual(parseCatalogGroupValues(["[custom] Value", "unstructured"]), { custom: ["Value"] });
assert.deepEqual(parseCatalogGroupValues(["[constructor] ignored"]), {}, "unsafe object keys are not indexed");
assert.deepEqual(
  extractTuneHeader(["X:2", "T:No facets", "M:9/8", "K:D", ""], 0, 4).catalogFacets,
  {},
  "technical notation fields must not imply catalog metadata",
);

const tune = {
  id: "/music/a.abc::0",
  title: "Example",
  key: "C",
  groups: header.groups,
  catalogFacets: {
    ...header.catalogFacets,
    makam: ["Hicaz", "Uşşak"],
  },
};
assert.deepEqual(getGroupValues(tune, "makam"), ["Hicaz", "Uşşak"]);

const files = [{ path: "/music/a.abc", basename: "a.abc", updatedAtMs: 10, tunes: [tune] }];
const makamEntries = buildGroupEntries(files, "makam");
assert.deepEqual(makamEntries.map((entry) => entry.label), ["Makam: Hicaz", "Makam: Uşşak"]);
assert.ok(makamEntries.every((entry) => entry.tunes.length === 1));
assert.equal(buildGroupEntries(files, "period")[0].label, "Period: Unknown");

assert.equal(applyLibraryTextFilter(files, "ottoman").length, 1, "facet values must be searchable");
assert.equal(applyLibraryTextFilter(files, "uşşak").length, 1, "repeated facet values must be searchable");
assert.equal(applyLibraryTextFilter(files, "unrelated").length, 0);

globalThis.window = {};
const catalogRows = createLibraryViewStore({
  getIndex: () => ({ root: "/music", files }),
  safeBasename: (value) => String(value).split("/").pop(),
}).getModalRows();
assert.ok(catalogRows[0].searchText.includes("ottoman armenian"), "Catalog search must include facet values");

console.log("library catalog facets harness: all tests passed");
