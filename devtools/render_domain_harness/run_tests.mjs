#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { build } from "esbuild";
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

const { createRenderRuntime } = await importBundledModule(
  "src/renderer/render/render_runtime.js",
);
const { createScoreInteractionController } = await importBundledModule(
  "src/renderer/render/score_interaction_controller.js",
);

{
  const errors = [];
  const runtime = createRenderRuntime({
    consoleRef: {
      error: (message) => errors.push(message),
    },
  });

  assert.equal(runtime.assertCleanAbcText("X:1\nK:C\n", "test"), true);
  assert.equal(runtime.assertCleanAbcText("[object Object]", "test"), false);
  assert.equal(errors.length, 1);
  assert.equal(runtime.normalizeAccThreeQuarterToneForAbc2svg("^3/4C _3/4D"), "^3/2C _3/2D");

  runtime.initializePayload({
    getEditorText: () => "X:1\nK:C\n",
    buildHeaderPrefix: () => ({ text: "", offset: 0 }),
  });
  assert.deepEqual(runtime.getRenderPayload(), { text: "X:1\nK:C\n", offset: 0 });

  const payload = {
    offset: 10,
    compatMap: {
      shifts: [{ srcPos: 15, outPos: 17, delta: 2 }],
    },
  };
  assert.equal(runtime.mapEditorOffsetToRenderIdx(5, payload), 17);
  assert.equal(runtime.mapRenderIdxToEditorOffset(17, payload), 5);
}

{
  const listeners = new Map();
  const note = {
    getBoundingClientRect: () => ({ top: 250, left: 350, width: 20, height: 10 }),
  };
  const output = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    querySelectorAll: (selector) => selector === "._120_" ? [note] : [],
  };
  const renderPane = {
    scrollTop: 10,
    scrollLeft: 20,
    clientHeight: 200,
    clientWidth: 300,
    getBoundingClientRect: () => ({ top: 50, left: 100 }),
  };
  const selections = [];
  const playbackRanges = [];
  const origins = [];
  const controller = createScoreInteractionController({
    outputElement: output,
    renderPane,
    getEditorView: () => ({
      state: {
        selection: { main: { anchor: 20 } },
      },
    }),
    mapEditorOffsetToRenderIdx: (value) => value + 100,
    mapRenderIdxToEditorOffset: (value) => value - 100,
    pickClosestNoteElement: (elements) => elements[0] || null,
    setEditorSelectionRange: (start, end) => selections.push([start, end]),
    setPendingPlaybackRangeOrigin: (origin) => origins.push(origin),
    getPlaybackRange: () => ({ loop: true }),
    setPlaybackRange: (range) => playbackRanges.push(range),
  });

  assert.equal(controller.centerCurrentAnchor(), true);
  assert.equal(renderPane.scrollTop, 115);
  assert.equal(renderPane.scrollLeft, 130);

  assert.equal(controller.wireOutputSelection(), true);
  assert.equal(controller.wireOutputSelection(), false);
  const target = {
    classList: { contains: (name) => name === "note-hl" },
    dataset: { start: "120", end: "125" },
  };
  assert.equal(controller.handleOutputClick({ target }), true);
  assert.deepEqual(origins, ["svg"]);
  assert.deepEqual(selections, [[20, 25]]);
  assert.deepEqual(playbackRanges, [{
    startOffset: 20,
    endOffset: 25,
    origin: "svg",
    loop: true,
  }]);
  assert.equal(typeof listeners.get("click"), "function");
}

console.log("render domain harness: all tests passed");
