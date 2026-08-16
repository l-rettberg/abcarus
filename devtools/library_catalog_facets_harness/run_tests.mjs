#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

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
const {
  addFacetToAllTunes,
  addFacetToTuneText,
} = await importRendererModule("src/renderer/library/catalog_metadata_transform.js");

const featureBundle = await build({
  entryPoints: ["src/renderer/library/catalog_metadata_feature.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const featureEncoded = Buffer.from(featureBundle.outputFiles[0].text, "utf8").toString("base64");
const { createCatalogMetadataFeature } = await import(`data:text/javascript;base64,${featureEncoded}`);

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

const tuneText = "X:1\r\nT:Example\r\nM:4/4\r\nK:C\r\nC D E F|\r\n";
const addedToTune = addFacetToTuneText(tuneText, "makam", "Hicaz");
assert.equal(addedToTune.changed, true);
assert.ok(addedToTune.text.includes("M:4/4\r\nG:[makam] Hicaz\r\nK:C"), "tag must be inserted before K and preserve CRLF");
assert.equal(addFacetToTuneText(addedToTune.text, "makam", "hicaz").changed, false, "exact tags are idempotent");
const secondMakam = addFacetToTuneText(addedToTune.text, "makam", "Uşşak");
assert.deepEqual(secondMakam.existingValues, ["Hicaz"], "another value is reported before being added");

const fileText = [
  "% file header",
  "X:1",
  "T:One",
  "K:C",
  "C|",
  "",
  "X:2",
  "T:Two",
  "G:[period] Contemporary",
  "K:D",
  "D|",
  "",
].join("\n");
const addedToFile = addFacetToAllTunes(fileText, "period", "Contemporary");
assert.equal(addedToFile.total, 2);
assert.equal(addedToFile.changed, 1);
assert.equal(addedToFile.existing, 1);
assert.equal((addedToFile.text.match(/G:\[period\] Contemporary/g) || []).length, 2);
assert.ok(addedToFile.text.startsWith("% file header\nX:1"), "file preamble must remain unchanged");

function fakeElement(value = "") {
  return {
    value,
    disabled: false,
    textContent: "",
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    addEventListener() {},
    focus() {},
  };
}

let written = null;
let selectedTuneId = "";
let appliedCurrentText = "";
const fileScope = fakeElement("file");
const feature = createCatalogMetadataFeature({
  elements: {
    modal: fakeElement(),
    applyButton: fakeElement(),
    scopeSelect: fileScope,
    facetSelect: fakeElement("period"),
    valueInput: fakeElement("Contemporary"),
    preview: fakeElement(),
  },
  state: {
    getActiveFileEntry: () => ({ path: "/music/a.abc" }),
    getActiveTuneMeta: () => ({ indexInFile: 2 }),
    getEditorText: () => "X:2\nT:Two\nK:D\nD|\n",
  },
  actions: {
    applyCurrentTuneText: (text) => { appliedCurrentText = text; },
    readFile: async () => ({ ok: true, data: fileText }),
    writeFile: async (_path, text, options) => {
      written = { text, options };
      return { ok: true };
    },
    requireCleanForFileOp: async () => true,
    withFileLock: async (_path, operation) => operation(),
    refreshLibraryFile: async () => ({ tunes: [{ id: "one" }, { id: "two" }] }),
    selectTune: async (id) => { selectedTuneId = id; },
    setStatus() {},
    showSaveError: async () => {},
    showToast() {},
  },
});
await feature.apply();
assert.ok(written && written.text.includes("G:[period] Contemporary"), "file scope must write transformed text");
assert.equal(written.options.expectedData, fileText, "file scope must guard its atomic write with the disk text read");
assert.equal(selectedTuneId, "two", "file scope must reload the same tune index after writing");
fileScope.value = "tune";
await feature.apply();
assert.ok(appliedCurrentText.includes("G:[period] Contemporary"), "current-tune scope must update the editor text");

console.log("library catalog facets harness: all tests passed");
