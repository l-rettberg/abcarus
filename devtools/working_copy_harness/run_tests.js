const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");

const {
  openWorkingCopyFromPath,
  closeWorkingCopy,
  commitWorkingCopyToDisk,
  applyFullText,
} = require("../../src/main/workingCopyStore");

async function withTempDir(fn) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "abcarus-wc-"));
  try {
    await fn(dir);
  } finally {
    try { await closeWorkingCopy(); } catch {}
    try { await fs.promises.rm(dir, { recursive: true, force: true }); } catch {}
  }
}

async function testConflictDoesNotOverwriteByDefault() {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "conflict.abc");
    const original = "X:1\nT:Original\nK:C\nC\n";
    const workingCopyText = "X:1\nT:Working Copy\nK:C\nD\n";
    const externalText = "X:1\nT:External Change\nK:C\nE\n";

    await fs.promises.writeFile(filePath, original, "utf8");
    await openWorkingCopyFromPath(filePath);
    applyFullText(workingCopyText);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await fs.promises.writeFile(filePath, externalText, "utf8");

    const blocked = await commitWorkingCopyToDisk({ force: false });
    assert.strictEqual(blocked.ok, false, "conflicted commit must fail closed");
    assert.strictEqual(blocked.conflict, true, "conflicted commit must report conflict=true");
    assert.strictEqual(
      await fs.promises.readFile(filePath, "utf8"),
      externalText,
      "conflicted commit must not overwrite the on-disk file"
    );

    const forced = await commitWorkingCopyToDisk({ force: true });
    assert.strictEqual(forced.ok, true, "forced commit should still be possible after explicit overwrite");
    assert.strictEqual(
      await fs.promises.readFile(filePath, "utf8"),
      workingCopyText,
      "forced commit should write the working copy text"
    );
  });
}

async function main() {
  await testConflictDoesNotOverwriteByDefault();
  console.log("% PASS working copy conflict guard");
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
