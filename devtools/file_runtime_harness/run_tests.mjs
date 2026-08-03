#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("src/renderer/io/file_runtime.js"), "utf8");
const encoded = Buffer.from(source, "utf8").toString("base64");
const { createFileContentCache } = await import(`data:text/javascript;base64,${encoded}`);

const cache = createFileContentCache({ maxEntries: 2, normalizePath: (p) => String(p).toLowerCase() });
let reads = 0;
const read = async (path) => {
  reads += 1;
  return { ok: true, data: path === "A" ? "alpha" : String(path).repeat(2) };
};

assert.equal((await cache.getCached("A", read)).data, "alpha");
assert.equal((await cache.getCached("a", read)).data, "alpha");
assert.equal(reads, 1);
assert.equal((await cache.getCached("B", read)).data, "BB");
assert.equal((await cache.getCached("C", read)).data, "CC");
assert.equal((await cache.getCached("A", read)).data, "alpha");

const stats = cache.getStats();
assert.equal(stats.hits, 1);
assert.equal(stats.misses, 4);
assert.equal(stats.reads, 4);
assert.equal(stats.evictions, 2);
assert.equal(stats.entries, 2);
assert.ok(stats.readMs >= 0);
assert.equal(stats.bytesRead, "alpha".length + 2 + 2 + "alpha".length);

cache.resetStats();
assert.deepEqual(cache.getStats(), { hits: 0, misses: 0, evictions: 0, reads: 0, readMs: 0, bytesRead: 0, entries: 2, maxEntries: 2 });
console.log("file runtime harness: all tests passed");
