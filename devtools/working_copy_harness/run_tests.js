const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");

const {
  openWorkingCopyFromPath,
  closeWorkingCopy,
  commitWorkingCopyToDisk,
  getWorkingCopySnapshot,
  reloadWorkingCopyFromDisk,
  applyFullText,
  applyTuneText,
} = require("../../src/main/workingCopyStore");

async function walkFiles(dir, out = []) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(p, out);
    else if (entry.isFile() && /\.(js|mjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}

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

async function testDirtyWorkingCopyCannotBeReplacedByOpen() {
  await withTempDir(async (dir) => {
    const firstPath = path.join(dir, "first.abc");
    const secondPath = path.join(dir, "second.abc");
    const firstText = "X:1\nT:First\nK:C\nC\n";
    const dirtyText = "X:1\nT:Dirty First\nK:C\nD\n";
    const secondText = "X:1\nT:Second\nK:C\nE\n";

    await fs.promises.writeFile(firstPath, firstText, "utf8");
    await fs.promises.writeFile(secondPath, secondText, "utf8");
    await openWorkingCopyFromPath(firstPath);
    applyFullText(dirtyText);

    await assert.rejects(
      () => openWorkingCopyFromPath(secondPath),
      /Refusing to replace a dirty working copy/
    );

    const snap = getWorkingCopySnapshot();
    assert.strictEqual(snap.path, firstPath, "dirty working copy path must remain unchanged");
    assert.strictEqual(snap.text, dirtyText, "dirty working copy text must remain intact");
    assert.strictEqual(snap.dirty, true, "dirty working copy must remain dirty");
  });
}

async function testDirtyWorkingCopyCannotBeReloadedByDefault() {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "reload.abc");
    const original = "X:1\nT:Original\nK:C\nC\n";
    const dirtyText = "X:1\nT:Dirty\nK:C\nD\n";
    const diskText = "X:1\nT:Disk\nK:C\nE\n";

    await fs.promises.writeFile(filePath, original, "utf8");
    await openWorkingCopyFromPath(filePath);
    applyFullText(dirtyText);
    await fs.promises.writeFile(filePath, diskText, "utf8");

    await assert.rejects(
      () => reloadWorkingCopyFromDisk(),
      /Refusing to reload a dirty working copy/
    );

    let snap = getWorkingCopySnapshot();
    assert.strictEqual(snap.text, dirtyText, "failed reload must preserve dirty text");
    assert.strictEqual(snap.dirty, true, "failed reload must preserve dirty flag");

    await reloadWorkingCopyFromDisk({ force: true });
    snap = getWorkingCopySnapshot();
    assert.strictEqual(snap.text, diskText, "forced reload should replace WC text from disk");
    assert.strictEqual(snap.dirty, false, "forced reload should clear dirty flag");
  });
}

async function testTuneApplyCannotOverwriteFirstTuneByStaleIndex() {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "identity.abc");
    const original = [
      "X:1",
      "T:First Valuable Tune",
      "K:C",
      "C |]",
      "",
      "X:217",
      "T:Edited Work Tune",
      "K:D",
      "D |]",
      "",
    ].join("\n");
    await fs.promises.writeFile(filePath, original, "utf8");
    await openWorkingCopyFromPath(filePath);

    const snap = getWorkingCopySnapshot();
    const firstUid = snap.tunes[0].tuneUid;
    const secondUid = snap.tunes[1].tuneUid;
    const editedSecond = "X:217\nT:Edited Work Tune\nK:D\nE F |]\n";

    assert.throws(
      () => applyTuneText({
        tuneIndex: 0,
        text: editedSecond,
        expected: { xNumber: "217", title: "Edited Work Tune" },
      }),
      /Missing stable tuneUid/,
      "index-only tune replacement must fail closed"
    );

    assert.throws(
      () => applyTuneText({
        tuneUid: firstUid,
        tuneIndex: 0,
        text: editedSecond,
        expected: { xNumber: "217", title: "Edited Work Tune" },
      }),
      /target tune identity changed|target tune text changed/,
      "wrong stable UID must not accept text for a different X number"
    );

    applyTuneText({
      tuneUid: secondUid,
      tuneIndex: 1,
      text: editedSecond,
      expected: { xNumber: "217", title: "Edited Work Tune" },
    });

    const after = getWorkingCopySnapshot().text;
    assert(after.includes("X:1\nT:First Valuable Tune"), "X:1 tune must remain intact");
    assert(after.includes("X:217\nT:Edited Work Tune\nK:D\nE F |]"), "edited X:217 tune must be updated");
  });
}

async function testForcedCommitsStayExplicitlyAuthorized() {
  const root = path.resolve(__dirname, "../..");
  const rendererFiles = await walkFiles(path.join(root, "src", "renderer"));
  const violations = [];
  const forcedPattern = /commitWorkingCopyToDisk\(\{\s*force:\s*true\s*\}\)/g;
  const forcedReloadPattern = /reloadWorkingCopyFromDisk\(\{\s*force:\s*true\s*\}\)/g;

  for (const filePath of rendererFiles) {
    const rel = path.relative(root, filePath).replace(/\\/g, "/");
    const text = await fs.promises.readFile(filePath, "utf8");
    let match;
    while ((match = forcedPattern.exec(text))) {
      const start = Math.max(0, match.index - 2500);
      const end = Math.min(text.length, match.index + 500);
      const context = text.slice(start, end);
      const allowedMissingFileRecreate = rel === "src/renderer/app/document/save_flow_controller.js"
        && context.includes('choice === "recreate"');
      const allowedUserConfirmedOverwrite = rel === "src/renderer/app/document/working_copy_conflict_controller.js"
        && context.includes('choice !== "overwrite"');
      if (!allowedMissingFileRecreate && !allowedUserConfirmedOverwrite) {
        violations.push(`${rel}:${text.slice(0, match.index).split(/\r\n|\n|\r/).length}`);
      }
    }
    while ((match = forcedReloadPattern.exec(text))) {
      const start = Math.max(0, match.index - 2500);
      const end = Math.min(text.length, match.index + 500);
      const context = text.slice(start, end);
      const allowedDiscardReload = rel === "src/renderer/renderer.js"
        && context.includes("function discardAndReloadWorkingCopyFromDisk");
      const allowedDiscardActive = rel === "src/renderer/renderer.js"
        && context.includes("function discardWorkingCopyChangesForActiveFile");
      const allowedDiscardActiveModule = rel === "src/renderer/app/document/working_copy_sync_controller.js"
        && context.includes("async function discardChangesForActiveFile");
      const allowedPostSimpleSaveAlign = rel === "src/renderer/renderer.js"
        && context.includes("function alignWorkingCopyWithDiskAfterSimpleSave");
      const allowedConflictReload = rel === "src/renderer/app/document/working_copy_conflict_controller.js"
        && context.includes("function discardAndReloadWorkingCopyFromDisk");
      const allowedRawCleanStateNormalize = rel === "src/renderer/tools/raw_mode/raw_mode_enter_guard.js"
        && context.includes("function normalizeCleanStateBeforeRaw");
      if (!allowedDiscardReload && !allowedDiscardActive && !allowedDiscardActiveModule && !allowedPostSimpleSaveAlign && !allowedConflictReload && !allowedRawCleanStateNormalize) {
        violations.push(`${rel}:${text.slice(0, match.index).split(/\r\n|\n|\r/).length}`);
      }
    }
  }

  assert.deepStrictEqual(
    violations,
    [],
    `Unauthorized forced working-copy commits:\n${violations.join("\n")}`
  );
}

async function main() {
  await testConflictDoesNotOverwriteByDefault();
  await testDirtyWorkingCopyCannotBeReplacedByOpen();
  await testDirtyWorkingCopyCannotBeReloadedByDefault();
  await testTuneApplyCannotOverwriteFirstTuneByStaleIndex();
  await testForcedCommitsStayExplicitlyAuthorized();
  console.log("% PASS working copy conflict guard");
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
