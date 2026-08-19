#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: ["src/renderer/app/commands/app_commands_domain.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const encoded = Buffer.from(bundled.outputFiles[0].text, "utf8").toString("base64");
const { createAppCommandsDomain } = await import(`data:text/javascript;base64,${encoded}`);

function createButton() {
  let clickHandler = null;
  return {
    addEventListener(type, handler) {
      if (type === "click") clickHandler = handler;
    },
    click() {
      assert.equal(typeof clickHandler, "function");
      clickHandler({ shiftKey: false });
    },
  };
}

const newTuneButton = createButton();
const documentRef = {
  activeElement: null,
  addEventListener() {},
};
let newTuneCalls = 0;
let libraryMetadataCalls = 0;

const domain = createAppCommandsDomain({
  documentRef,
  elements: { newTuneButton },
  state: {
    isPayloadMode: () => false,
    isRawModeActive: () => false,
  },
  actions: {
    fileNewTune: async () => { newTuneCalls += 1; },
    openLibraryMetadata: () => { libraryMetadataCalls += 1; },
  },
});

domain.wire();
newTuneButton.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(newTuneCalls, 1, "New Tune toolbar button must dispatch the canonical fileNewTune action");
await domain.dispatch("libraryMetadata");
assert.equal(libraryMetadataCalls, 1, "Tools -> Library Metadata must dispatch its feature action");

console.log("app commands harness: all tests passed");
