const assert = require("assert").strict;
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  STATE_VERSION,
  composeStateDocument,
  loadStateDocument,
  saveStateDocument,
  splitStateDocument,
} = require("../../src/main/state_store");

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "abcarus-state-store-"));
  const filePath = path.join(dir, "state.json");
  try {
    const first = composeStateDocument({ lastFolder: "/music", settings: { renderZoom: 1 } }, { futureField: "keep" });
    await saveStateDocument({ fs, path, filePath, data: first });
    assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).stateVersion, STATE_VERSION);

    const second = composeStateDocument({ lastFolder: "/scores", settings: { renderZoom: 1.2 } }, { futureField: "keep" });
    await saveStateDocument({ fs, path, filePath, data: second });
    assert.equal(JSON.parse(fs.readFileSync(`${filePath}.bak`, "utf8")).lastFolder, "/music");

    fs.writeFileSync(filePath, "{ broken", "utf8");
    const recovered = await loadStateDocument({ fs, filePath });
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.source, "backup");
    assert.equal(recovered.data.lastFolder, "/music");
    await saveStateDocument({ fs, path, filePath, data: recovered.data, skipBackup: true });
    assert.equal(JSON.parse(fs.readFileSync(`${filePath}.bak`, "utf8")).lastFolder, "/music");

    const split = splitStateDocument({
      lastFolder: "/scores",
      globalHeaderMigrationVersion: 1,
      futureField: { enabled: true },
      stateVersion: 99,
    });
    assert.deepEqual(split.known, {
      lastFolder: "/scores",
      globalHeaderMigrationVersion: 1,
      stateVersion: 99,
    });
    assert.deepEqual(split.extras, { futureField: { enabled: true } });
    assert.deepEqual(composeStateDocument(split.known, split.extras), {
      futureField: { enabled: true },
      stateVersion: STATE_VERSION,
      lastFolder: "/scores",
      globalHeaderMigrationVersion: 1,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log("state store harness: all tests passed");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
