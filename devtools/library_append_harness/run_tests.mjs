import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";

async function loadModule(entryPoint, exportName) {
  const result = await build({
    entryPoints: [resolve(entryPoint)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  const encoded = Buffer.from(result.outputFiles[0].text, "utf8").toString("base64");
  const module = await import(`data:text/javascript;base64,${encoded}`);
  return module[exportName];
}

const createAppendCurrentTuneAction = await loadModule(
  "src/renderer/library/append_current_tune_action.js",
  "createAppendCurrentTuneAction",
);
const createAppendTuneToActiveFileAction = await loadModule(
  "src/renderer/library/append_tune_action.js",
  "createAppendTuneToActiveFileAction",
);

const files = new Map([
  ["/tmp/target.abc", "X:1\nT:Target\nK:C\nC D|\n"],
]);
const writes = [];
let appendAllowed = true;

const readFile = async (path) => ({ ok: files.has(path), data: files.get(path), error: "missing" });
const writeFile = async (path, data, options = {}) => {
  assert.equal(options.expectedData, files.get(path), "append must use the read baseline");
  files.set(path, data);
  writes.push({ path, data, options });
  return { ok: true };
};
const getNextXNumber = (text) => {
  const numbers = [...String(text).matchAll(/^X:\s*(\d+)/gm)].map((match) => Number(match[1]));
  return numbers.length ? Math.max(...numbers) + 1 : 1;
};
const ensureXNumberInAbc = (text, nextX) => String(text).replace(/^X:\s*\d*\s*$/m, `X:${nextX}`);

const current = createAppendCurrentTuneAction({
  state: { getActiveFilePath: () => "/tmp/target.abc" },
  actions: {
    getNextXNumber,
    ensureXNumberInAbc,
    readFile,
    writeFile,
    withFileLock: async (_path, fn) => fn(),
    setFileContentInCache: () => {},
    refreshLibraryFile: async () => ({ tunes: [{ id: "target:1" }, { id: "target:2" }] }),
    selectTune: async () => {},
  },
});

assert.equal(await current.appendTextToFileNow("/tmp/target.abc", "X:99\nT:Added\nK:C\nG A|\n"), true);
assert.match(files.get("/tmp/target.abc"), /^X:2\nT:Added/m);
assert.equal(writes.at(-1).options.expectedData, "X:1\nT:Target\nK:C\nC D|\n");

const menuAction = createAppendTuneToActiveFileAction({
  getActiveTuneMeta: () => ({ path: "/tmp/target.abc" }),
  findTuneById: () => ({ file: { path: "/tmp/source.abc" }, tune: { title: "Source", xNumber: 7 } }),
  getTuneText: async () => "X:7\nT:Source\nK:C\nE F|\n",
  readFile,
  writeFile,
  getNextXNumber,
  ensureXNumberInAbc,
  confirmAppendToFile: async () => "append",
  requireCleanForFileOp: async () => appendAllowed,
  refreshLibraryFile: async () => ({ tunes: [{ id: "target:1" }, { id: "target:2" }, { id: "target:3" }] }),
  selectTune: async () => {},
});

await menuAction.run("source:7");
assert.match(files.get("/tmp/target.abc"), /^X:3\nT:Source/m);
assert.equal(writes.at(-1).options.expectedData.includes("X:2"), true);

const writesBeforeBlockedAppend = writes.length;
const contentBeforeBlockedAppend = files.get("/tmp/target.abc");
appendAllowed = false;
await menuAction.run("source:7");
assert.equal(writes.length, writesBeforeBlockedAppend, "append must not write while the active document is dirty");
assert.equal(files.get("/tmp/target.abc"), contentBeforeBlockedAppend, "blocked append must preserve the target file");

console.log("library append harness: all tests passed");
