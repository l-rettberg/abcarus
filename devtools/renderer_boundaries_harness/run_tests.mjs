#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function importBundledModule(filePath) {
  const result = await build({
    entryPoints: [resolve(filePath)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  const source = result.outputFiles[0].text;
  const encoded = Buffer.from(source, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const rendererSource = await readFile("src/renderer/renderer.js", "utf8");
const rendererLines = rendererSource.split(/\r\n|\n|\r/).length;
assert.ok(
  rendererLines <= 5000,
  `renderer.js exceeds the 5000-line composition-root ceiling: ${rendererLines}`,
);

for (const required of [
  /createEditorRuntime\s*\(/,
  /createRenderRuntime\s*\(/,
  /createPlaybackDomain\s*\(/,
  /createLibraryUiDomain\s*\(/,
  /createDisclaimerController\s*\(/,
]) {
  assert.match(rendererSource, required);
}

for (const forbidden of [
  /\blet\s+editorView\b/,
  /\blet\s+suppressDirty\b/,
  /\bcreateMainEditorFeature\s*\(/,
  /function\s+getPlaybackPayload\s*\(/,
  /function\s+startPlaybackFromRange\s*\(/,
  /function\s+getScopedPlaybackSettingsForOrigin\s*\(/,
  /playbackTransport\.[A-Za-z_$][A-Za-z0-9_$]*\s*=/,
  /from\s+["']\.\/playback\/playback_state_model\.js["']/,
  /function\s+findHeaderEndOffset\s*\(/,
  /function\s+splitFileIntoHeaderAndBody\s*\(/,
  /function\s+getTextIndexFromLoc\s*\(/,
  /function\s+ensureToolPanelDefaultLeftPosition\s*\(/,
  /function\s+showDisclaimerIfNeeded\s*\(/,
  /\blet\s+isNewTuneDraft\b/,
  /\blet\s+libraryIndex\b/,
  /\blet\s+isLibraryVisible\b/,
  /\blet\s+latestSettingsSnapshot\b/,
  /\blet\s+suppressRecentEntries\b/,
  /\blet\s+followPlayback\b/,
  /ViewPlugin\.fromClass\s*\(\s*class\s*\{[\s\S]*?getMarkerVersion/,
  /\bFOLLOW_PIPELINE_VERSION\b/,
  /function\s+computeFocusPlaybackPlanFromCurrentState\s*\(/,
  /function\s+normalizeFocusLoopBoundsForPlayback\s*\(/,
  /function\s+setFocusModeEnabled\s*\(/,
  /function\s+toggleFocusMode\s*\(/,
  /function\s+stopPlaybackFromGuard\s*\(/,
  /function\s+setSoundfont(?:Status|Caption)\s*\(/,
  /function\s+persistLoopSettingsPatch\s*\(/,
  /\brecordNavFilePath\b/,
  /\bnavFileHistory\b/,
]) {
  assert.doesNotMatch(rendererSource, forbidden);
}

const { createLibraryRuntimeStore } = await importBundledModule(
  "src/renderer/library/library_runtime_store.js",
);
const libraryRuntime = createLibraryRuntimeStore();
assert.equal(libraryRuntime.getIndex(), null);
assert.equal(libraryRuntime.isVisible(), true);
libraryRuntime.setIndex({ root: "/music", files: [{ path: "/music/a.abc" }] });
libraryRuntime.setVisible(false);
libraryRuntime.setRecentEntriesSuppressed(true);
assert.equal(libraryRuntime.getRoot(), "/music");
assert.equal(libraryRuntime.getFiles().length, 1);
assert.equal(libraryRuntime.isVisible(), false);
assert.equal(libraryRuntime.areRecentEntriesSuppressed(), true);

const { createSettingsSnapshotStore } = await importBundledModule(
  "src/renderer/app/ui/settings_snapshot_store.js",
);
const settingsUpdates = [];
const settingsSnapshot = createSettingsSnapshotStore({
  api: { updateSettings: async (patch) => settingsUpdates.push(patch) },
});
assert.equal(settingsSnapshot.get(), null);
settingsSnapshot.set({ followPlayback: true });
settingsSnapshot.patch({ payloadModeEnabled: false });
assert.deepEqual(settingsSnapshot.get(), {
  followPlayback: true,
  payloadModeEnabled: false,
});
await settingsSnapshot.persistPatch({ playbackLoopEnabled: true });
assert.deepEqual(settingsUpdates, [{ playbackLoopEnabled: true }]);

const headerModel = await importBundledModule(
  "src/renderer/app/document/file_header_model.js",
);
assert.equal(headerModel.findHeaderEndOffset("%%abc\n\nX:1\nK:C\n"), 7);
assert.deepEqual(
  headerModel.splitFileIntoHeaderAndBody("%%abc\n\nX:1\nK:C\n"),
  { headerText: "%%abc\n\n", bodyText: "X:1\nK:C\n" },
);
assert.equal(headerModel.countLinesForPrefix("a\nb\n"), 2);
assert.equal(headerModel.countLinesForPrefix(" \n "), 0);

const errorsModel = await importBundledModule(
  "src/renderer/editor/errors_model.js",
);
assert.equal(errorsModel.isMeasureCheckEnabledForText("M:4/4\nK:C\n"), true);
assert.equal(errorsModel.isMeasureCheckEnabledForText("M:none\nK:C\n"), false);
assert.equal(
  errorsModel.getClampedTextIndexFromLoc("abc\ndef", { line: 9, col: 9 }),
  7,
);

const { createDisclaimerController } = await importBundledModule(
  "src/renderer/app/ui/disclaimer_controller.js",
);
const classes = new Set();
const listeners = new Map();
const updates = [];
const modal = {
  classList: {
    add: (name) => classes.add(name),
    remove: (name) => classes.delete(name),
  },
  setAttribute: () => {},
  addEventListener: (type, handler) => listeners.set(type, handler),
};
const confirmButton = {
  addEventListener: (type, handler) => listeners.set(`confirm:${type}`, handler),
};
const disclaimer = createDisclaimerController({
  modal,
  confirmButton,
  api: { updateSettings: async (patch) => updates.push(patch) },
});
disclaimer.wire();
assert.equal(disclaimer.showIfNeeded({ disclaimerSeen: false }), true);
assert.equal(disclaimer.showIfNeeded({ disclaimerSeen: false }), false);
assert.equal(classes.has("open"), true);
await disclaimer.dismiss();
assert.equal(classes.has("open"), false);
assert.deepEqual(updates, [{ disclaimerSeen: true }]);

console.log(`renderer boundaries harness: all tests passed (${rendererLines} lines)`);
