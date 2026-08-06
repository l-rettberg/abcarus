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

const { createPlaybackDomain } = await importBundledModule(
  "src/renderer/playback/playback_domain.js",
);
const { createPlaybackTransportState } = await importBundledModule(
  "src/renderer/playback/playback_transport_state.js",
);
const { createPlaybackTransportController } = await importBundledModule(
  "src/renderer/playback/playback_transport_controller.js",
);

const endState = createPlaybackTransportState();
endState.activePlaybackRange = { startOffset: 0, endOffset: null, origin: "transport", loop: false };
endState.isPlaying = true;
const completed = endState.consumePlaybackEnd();
assert.equal(completed.shouldLoop, false);
assert.equal(endState.restartOnNextPlay, true);
assert.equal(endState.consumeRestartOnNextPlay(), true);
assert.equal(endState.restartOnNextPlay, false);
endState.isPlaying = true;
endState.activePlaybackRange = { startOffset: 0, endOffset: null, origin: "transport", loop: true };
endState.consumePlaybackEnd();
assert.equal(endState.restartOnNextPlay, false);

const startCalls = [];
const controllerTransport = createPlaybackTransportState();
controllerTransport.restartOnNextPlay = true;
const controller = createPlaybackTransportController({
  transport: controllerTransport,
  getEditorView: () => ({ state: { doc: { length: 10 }, selection: { main: { anchor: 9, head: 9 } } } }),
  getFocusModeEnabled: () => false,
  startPlaybackAtIndex: async (index) => startCalls.push(index),
  startPlaybackFromRange: async () => {},
  pausePlayback: () => {},
  playSelectionOnce: async () => false,
  updatePlayButton: () => {},
  clearNoteSelection: () => {},
  resetPlaybackUiState: () => {},
  setSoundfontCaption: () => {},
  showToast: () => {},
});
await controller.transportPlay();
assert.deepEqual(startCalls, [0]);
assert.equal(controllerTransport.restartOnNextPlay, false);

const trace = [];
const transport = {
  isPlaying: false,
  isPaused: false,
  waitingForFirstNote: false,
  playbackIndexOffset: 12,
  playbackLoopFromMeasure: 4,
  playbackLoopToMeasure: 8,
  playbackState: {
    byTime: [],
    byIstart: [],
    measureStarts: [],
  },
  appendTrace: (event) => trace.push(event),
};
let focusEnabled = true;
const focusCalls = [];
const focusController = {
  computePlaybackPlan: () => ({ ok: true, start: 4 }),
  normalizeLoopBounds: (from, to) => ({ from, to }),
  normalizeLoopBoundsForPlayback: () => true,
  maybeResetLoopForTune: (...args) => focusCalls.push(args),
  setEnabled: (...args) => focusCalls.push(["setEnabled", ...args]),
  toggle: () => focusCalls.push(["toggle"]),
};
const uiCalls = [];
const domain = createPlaybackDomain({
  transport,
  selectionRuntime: {},
  getEditorLength: () => 100,
  getFocusModeEnabled: () => focusEnabled,
  getFocusModeController: () => focusController,
  getPlaybackUiController: () => ({
    handlePlaybackGuardStop: (message) => uiCalls.push(message),
    isPlaybackBusy: () => Boolean(
      transport.isPlaying || transport.isPaused || transport.waitingForFirstNote
    ),
  }),
});

assert.equal(domain.isBusy(), false);
assert.equal(domain.isFollowEnabled(), true);
domain.setFollowEnabled(false);
assert.equal(domain.isFollowEnabled(), false);
assert.deepEqual(domain.computeFocusPlan(), { ok: true, start: 4 });
assert.deepEqual(domain.normalizeFocusLoopBounds(2, 7), { from: 2, to: 7 });
assert.equal(domain.normalizeFocusLoopBoundsForPlayback(), true);
domain.resetFocusLoopForTune("tune-1", { updateUi: false });
assert.deepEqual(focusCalls, [["tune-1", { updateUi: false }]]);
domain.setFocusEnabled(true);
domain.toggleFocus();
domain.stopFromGuard("guard");
assert.deepEqual(focusCalls.slice(1), [["setEnabled", true], ["toggle"]]);
assert.deepEqual(uiCalls, ["guard"]);
assert.match(domain.getFollowPipelineVersion(), /^follow-/);
transport.waitingForFirstNote = true;
assert.equal(domain.isBusy(), true);
transport.waitingForFirstNote = false;

assert.throws(
  () => domain.getPayload(),
  /Playback controller is not attached: payload/,
);

const calls = [];
domain.attach({
  abSelection: {
    getSelectionSettings: () => ({ suppressRepeats: false, allowMidiDrums: true }),
    getSelectionRange: () => ({ startOffset: 2, endOffset: 7 }),
    withTempPlaybackFlags: (flags, action) => {
      calls.push(["flags", flags]);
      return action();
    },
  },
  payload: {
    getPlaybackPayload: () => ({ text: "X:1\nK:C\n", offset: 12 }),
    getPlaybackSourceKey: () => "source-key",
  },
  transport: {
    setPlaybackRange: (range) => calls.push(["range", range]),
    stopPlaybackTransport: () => calls.push("stop"),
  },
});

assert.deepEqual(domain.getScopedSettingsForOrigin("focus"), {
  suppressRepeats: true,
  allowMidiDrums: true,
});
focusEnabled = false;
assert.deepEqual(domain.getScopedSettingsForOrigin("focus"), {
  suppressRepeats: false,
  allowMidiDrums: true,
});
assert.deepEqual(domain.withScopedOrigin({ loop: true }, "selection"), {
  loop: true,
  origin: "selection",
});
assert.equal(domain.toDerivedOffset(8), 20);
assert.equal(domain.toEditorOffset(20), 8);
assert.equal(domain.toDerivedOffset("bad"), null);
assert.equal(domain.getSourceKey(), "source-key");
assert.equal(domain.getPayload().offset, 12);
assert.deepEqual(domain.getSelectionRange(), { startOffset: 2, endOffset: 7 });
domain.setRange({ startOffset: 1, endOffset: 3 });
domain.stopTransport();
domain.appendTrace({ index: 5 });
assert.deepEqual(trace, [{ index: 5 }]);
assert.deepEqual(calls, [
  ["range", { startOffset: 1, endOffset: 3 }],
  "stop",
]);

const rendererSource = await readFile("src/renderer/renderer.js", "utf8");
assert.doesNotMatch(rendererSource, /function\s+getPlaybackPayload\s*\(/);
assert.doesNotMatch(rendererSource, /function\s+startPlaybackFromRange\s*\(/);
assert.doesNotMatch(rendererSource, /function\s+setPlaybackRange\s*\(/);
assert.doesNotMatch(rendererSource, /function\s+getScopedPlaybackSettingsForOrigin\s*\(/);
assert.doesNotMatch(rendererSource, /buildPlaybackStateModel|snapIstartToPlayableModel/);
assert.doesNotMatch(
  rendererSource,
  /playbackTransport\.[A-Za-z_$][A-Za-z0-9_$]*\s*=/,
);
assert.doesNotMatch(
  rendererSource,
  /from\s+["']\.\/playback\/(?:ab_loop_runtime|ab_marker_extension|ab_selection_playback_controller|drum_preview_controller|focus_mode_controller|follow_highlight_settings|playback_autoscroll_controller|playback_follow_controller|playback_payload_controller|playback_player_controller|playback_prepare_controller|playback_start_controller|playback_transport_controller|playback_transport_state|selection_playback_runtime|soundfont_controller)\.js["']/,
);
assert.doesNotMatch(
  rendererSource,
  /\b(?:playbackTransport|selectionPlaybackRuntime|abLoopRuntime|soundfontController|focusModeController|playbackUiController)\b/,
);
assert.match(rendererSource, /createPlaybackDomain\s*\(/);
assert.match(rendererSource, /playbackDomain\.initialize\s*\(/);

console.log("playback domain harness: all tests passed");
