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

const { createStartupController } = await importRendererModule(
  resolve("src/renderer/app/startup/startup_controller.js"),
);

{
  const events = [];
  let root = "";
  const controller = createStartupController({
    api: {
      getRecentCandidates: async () => [
        { type: "tune", entry: { path: "/music/a.abc", id: "missing" } },
        { type: "file", entry: { path: "/music/a.abc" } },
        { type: "folder", entry: { path: "/music" } },
      ],
      getSettings: async () => ({}),
    },
    getLibraryRoot: () => root,
    loadLibraryFromFolder: async (path, options) => {
      events.push(["load-folder", path, options]);
      root = path;
    },
    openRecentTune: async () => {
      events.push(["open-tune"]);
      return { ok: false };
    },
    openRecentFile: async () => {
      events.push(["open-file"]);
      return { ok: true };
    },
    markRecentOpenStarted: () => events.push(["recent-started"]),
    renderStatus: () => events.push(["render-status"]),
  });

  assert.equal(await controller.start(), true);
  assert.deepEqual(events, [
    ["load-folder", "/music", { selectInitialTune: false }],
    ["recent-started"],
    ["open-tune"],
    ["open-file"],
    ["recent-started"],
    ["render-status"],
  ]);
}

{
  const events = [];
  let root = "";
  const controller = createStartupController({
    api: {
      getRecentCandidates: async () => [
        { type: "tune", entry: { path: "/home/music/current/various.abc" } },
        { type: "file", entry: { path: "/home/music/current/various.abc" } },
        { type: "folder", entry: { path: "/media/old-library" } },
        { type: "folder", entry: { path: "/home/music" } },
        { type: "folder", entry: { path: "/home/music/current" } },
      ],
      getSettings: async () => ({}),
    },
    getLibraryRoot: () => root,
    loadLibraryFromFolder: async (path) => {
      events.push(["load-folder", path]);
      root = path;
    },
    openRecentTune: async () => {
      events.push(["open-tune"]);
      return { ok: true };
    },
  });

  assert.equal(await controller.start(), true);
  assert.deepEqual(events, [
    ["load-folder", "/home/music/current"],
    ["open-tune"],
  ]);
}

{
  const events = [];
  const controller = createStartupController({
    api: {
      getRecentCandidates: async () => [
        { type: "tune", entry: { path: "/music-archive/a.abc" } },
        { type: "folder", entry: { path: "/music" } },
      ],
      getSettings: async () => ({}),
    },
    loadLibraryFromFolder: async (path) => events.push(path),
    openRecentTune: async () => ({ ok: true }),
  });

  assert.equal(await controller.start(), true);
  assert.deepEqual(events, ["/music"], "folder matching must respect path boundaries");
}

{
  let legacyCalls = 0;
  let readyCalls = 0;
  const controller = createStartupController({
    api: {
      getRecentCandidates: async () => [],
      getLastRecent: async () => {
        legacyCalls += 1;
        return null;
      },
    },
    markUiReady: () => { readyCalls += 1; },
  });

  assert.equal(await controller.start(), false);
  assert.equal(legacyCalls, 1);
  assert.equal(readyCalls, 1);
}

{
  const frames = [];
  const events = [];
  const controller = createStartupController({
    requestAnimationFrameRef: (callback) => frames.push(callback),
    applyInitialLayout: () => events.push("layout"),
    centerRenderPane: () => events.push("center"),
  });

  controller.scheduleLayoutReset();
  controller.scheduleLayoutReset();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.deepEqual(events, ["layout"]);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.deepEqual(events, ["layout", "center"]);
  controller.scheduleLayoutReset();
  assert.equal(frames.length, 0);
}

console.log("startup harness: all tests passed");
