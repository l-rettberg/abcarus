#!/usr/bin/env node
import assert from "node:assert/strict";
import { build } from "esbuild";

async function importBundled(filePath) {
  const bundled = await build({
    entryPoints: [filePath],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  const encoded = Buffer.from(bundled.outputFiles[0].text, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const { createMicrotonalDomain } = await importBundled(
  "src/renderer/microtonal/microtonal_domain.js",
);
const { createSettingsRuntimeController } = await importBundled(
  "src/renderer/app/ui/settings_runtime_controller.js",
);

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: (name) => values.add(name),
    contains: (name) => values.has(name),
    remove: (name) => values.delete(name),
  };
}

const panel = {
  classList: createClassList(["hidden"]),
  setAttribute() {},
};
let domLookups = 0;
const documentRef = {
  addEventListener() {},
  getElementById(id) {
    domLookups += 1;
    return id === "intonationExplorerPanel" ? panel : null;
  },
};
const toasts = [];
let settings = { supportMicrotonalNotation: false };

const domain = createMicrotonalDomain({
  api: {
    getMakamDnaUser: async () => ({ ok: false }),
  },
  documentRef,
  navigatorRef: null,
  ViewPlugin: {
    fromClass: () => ({ kind: "intonation-editor-extension" }),
  },
  state: {
    getActiveTuneIndex: () => 0,
    getActiveTuneMeta: () => null,
    getActiveTuneUid: () => "",
    getSettings: () => settings,
    isPayloadMode: () => false,
    isRawMode: () => false,
  },
  host: {
    findMeasureRangeAt: () => null,
    getEditorView: () => null,
    getOutputElement: () => null,
    refreshActiveTuneSnapshot: async () => null,
    resolveTuneEntryFromSnapshot: () => null,
    showToast: (message) => toasts.push(message),
  },
});

assert.ok(domain.editorExtension);
assert.equal(domLookups, 0, "microtonal UI must remain lazy before first open");
assert.equal(domain.isSupported({ supportMicrotonalNotation: true }), true);
assert.equal(domain.isSupported({ makamToolsEnabled: true }), true);
assert.equal(domain.isSupported({ studyToolsEnabled: true }), true);
assert.equal(domain.isSupported({}), false);

assert.equal(await domain.toggleExplorer(), false);
assert.equal(domLookups, 0, "disabled microtonal tools must not initialize their UI");
assert.match(toasts.at(-1), /Microtonal notation support is disabled/);

settings = { supportMicrotonalNotation: true };
assert.equal(await domain.toggleExplorer(), true);
assert.ok(domLookups > 0, "first enabled open must initialize the microtonal UI");
assert.equal(domain.isExplorerVisible(), true);
assert.equal(panel.classList.contains("hidden"), false);

domain.applySettings({ supportMicrotonalNotation: false });
assert.equal(domain.isExplorerVisible(), false);
assert.equal(panel.classList.contains("hidden"), true);

let settingsChanged = null;
const appliedSettings = [];
const settingsRuntime = createSettingsRuntimeController({
  api: {
    getSettings: async () => ({ supportMicrotonalNotation: true }),
    onSettingsChanged: (listener) => {
      settingsChanged = listener;
    },
  },
  state: {
    getLatestSettings: () => null,
    setLatestSettings: () => {},
  },
  actions: {
    applyMicrotonalSettings: (next) => appliedSettings.push(next),
  },
});
settingsRuntime.start();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(appliedSettings.length, 1, "initial Settings load must reach the microtonal domain");
assert.equal(typeof settingsChanged, "function");
settingsChanged({ supportMicrotonalNotation: false });
assert.equal(appliedSettings.length, 2, "Settings changes must reach the microtonal domain");

console.log("microtonal domain harness: all tests passed");
