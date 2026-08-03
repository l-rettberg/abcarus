#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("src/renderer/io/file_runtime.js"), "utf8");
const encoded = Buffer.from(source, "utf8").toString("base64");
const { createFileOperationLocks } = await import(`data:text/javascript;base64,${encoded}`);

const locks = createFileOperationLocks({ normalizePath: (p) => String(p).toLowerCase() });
const events = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const first = locks.withFileLock("A", async () => {
  events.push("first:start");
  await wait(10);
  events.push("first:end");
  return "first";
});
const second = locks.withFileLock("a", async () => {
  events.push("second:start");
  events.push("second:end");
  return "second";
});

assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
assert.deepEqual(events, ["first:start", "first:end", "second:start", "second:end"]);

const pair = [];
await locks.withFileLocks(["B", "a"], async () => {
  pair.push("inside");
  return true;
});
assert.deepEqual(pair, ["inside"]);
console.log("file runtime harness: all tests passed");
