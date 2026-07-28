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
  deleteTune,
  insertTuneAfter,
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
    try {
      const snapshot = getWorkingCopySnapshot();
      if (snapshot) {
        await closeWorkingCopy({
          expectedPath: snapshot.path,
          expectedVersion: snapshot.version,
          force: true,
        });
      }
    } catch {}
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
    let snapshot = getWorkingCopySnapshot();
    applyFullText(workingCopyText, { expectedPath: filePath, expectedVersion: snapshot.version });

    await new Promise((resolve) => setTimeout(resolve, 20));
    await fs.promises.writeFile(filePath, externalText, "utf8");

    snapshot = getWorkingCopySnapshot();
    const blocked = await commitWorkingCopyToDisk({
      force: false,
      expectedPath: filePath,
      expectedVersion: snapshot.version,
    });
    assert.strictEqual(blocked.ok, false, "conflicted commit must fail closed");
    assert.strictEqual(blocked.conflict, true, "conflicted commit must report conflict=true");
    assert.strictEqual(
      await fs.promises.readFile(filePath, "utf8"),
      externalText,
      "conflicted commit must not overwrite the on-disk file"
    );

    const forced = await commitWorkingCopyToDisk({
      force: true,
      expectedPath: filePath,
      expectedVersion: snapshot.version,
    });
    assert.strictEqual(forced.ok, true, "forced commit should still be possible after explicit overwrite");
    assert.strictEqual(
      await fs.promises.readFile(filePath, "utf8"),
      workingCopyText,
      "forced commit should write the working copy text"
    );
  });
}

async function testContentHashDetectsSameSizeExternalChange() {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "same-size-conflict.abc");
    const original = "X:1\nT:Same Size\nK:C\nC\n";
    const edited = "X:1\nT:Same Size\nK:C\nD\n";
    const external = "X:1\nT:Same Size\nK:C\nE\n";
    await fs.promises.writeFile(filePath, original, "utf8");
    await openWorkingCopyFromPath(filePath);
    const originalStat = await fs.promises.stat(filePath);
    let snapshot = getWorkingCopySnapshot();
    applyFullText(edited, {
      expectedPath: filePath,
      expectedVersion: snapshot.version,
    });

    await fs.promises.writeFile(filePath, external, "utf8");
    await fs.promises.utimes(filePath, originalStat.atime, originalStat.mtime);
    snapshot = getWorkingCopySnapshot();
    const result = await commitWorkingCopyToDisk({
      expectedPath: filePath,
      expectedVersion: snapshot.version,
    });
    assert.strictEqual(result.ok, false, "same-size external replacement must fail closed");
    assert.strictEqual(result.conflict, true, "content hash must report the replacement as a conflict");
    assert.strictEqual(await fs.promises.readFile(filePath, "utf8"), external);
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
    const snapshot = getWorkingCopySnapshot();
    applyFullText(dirtyText, { expectedPath: firstPath, expectedVersion: snapshot.version });

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
    const initialSnapshot = getWorkingCopySnapshot();
    applyFullText(dirtyText, { expectedPath: filePath, expectedVersion: initialSnapshot.version });
    await fs.promises.writeFile(filePath, diskText, "utf8");

    await assert.rejects(
      () => reloadWorkingCopyFromDisk({ expectedPath: filePath }),
      /Refusing to reload a dirty working copy/
    );

    let snap = getWorkingCopySnapshot();
    assert.strictEqual(snap.text, dirtyText, "failed reload must preserve dirty text");
    assert.strictEqual(snap.dirty, true, "failed reload must preserve dirty flag");

    await reloadWorkingCopyFromDisk({
      force: true,
      expectedPath: filePath,
      expectedVersion: getWorkingCopySnapshot().version,
    });
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
        expectedPath: filePath,
        expectedVersion: snap.version,
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
        expectedPath: filePath,
        expectedVersion: snap.version,
        text: editedSecond,
        expected: { xNumber: "217", title: "Edited Work Tune" },
      }),
      /target tune identity changed|target tune text changed/,
      "wrong stable UID must not accept text for a different X number"
    );

    applyTuneText({
      tuneUid: secondUid,
      tuneIndex: 1,
      expectedPath: filePath,
      expectedVersion: snap.version,
      text: editedSecond,
      expected: { xNumber: "217", title: "Edited Work Tune" },
    });

    const after = getWorkingCopySnapshot().text;
    assert(after.includes("X:1\nT:First Valuable Tune"), "X:1 tune must remain intact");
    assert(after.includes("X:217\nT:Edited Work Tune\nK:D\nE F |]"), "edited X:217 tune must be updated");
  });
}

async function testStructuralMutationsRequireStableContext() {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "structural.abc");
    const otherPath = path.join(dir, "other.abc");
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
    await fs.promises.writeFile(otherPath, "X:1\nT:Other\nK:C\nC |]\n", "utf8");
    await openWorkingCopyFromPath(filePath);

    const snapshot = getWorkingCopySnapshot();
    const firstUid = snapshot.tunes[0].tuneUid;
    const secondUid = snapshot.tunes[1].tuneUid;

    assert.throws(
      () => deleteTune({
        tuneIndex: 0,
        expectedPath: filePath,
        expectedVersion: snapshot.version,
      }),
      /Missing stable tuneUid/,
      "index-only delete must fail closed"
    );
    assert.throws(
      () => deleteTune({
        tuneUid: secondUid,
        tuneIndex: 0,
        expectedPath: otherPath,
        expectedVersion: snapshot.version,
        expected: { xNumber: "217" },
      }),
      /working copy path changed/,
      "delete must not run against another working-copy path"
    );
    assert.throws(
      () => insertTuneAfter({
        afterTuneIndex: 0,
        text: "X:2\nT:Inserted\nK:C\nC |]\n",
        expectedPath: filePath,
        expectedVersion: snapshot.version,
      }),
      /without stable tuneUid/,
      "index-only insert must fail closed"
    );

    insertTuneAfter({
      afterTuneUid: secondUid,
      text: "X:218\nT:Inserted\nK:C\nC |]\n",
      expectedPath: filePath,
      expectedVersion: snapshot.version,
    });
    const afterInsert = getWorkingCopySnapshot();
    assert(afterInsert.text.includes("X:1\nT:First Valuable Tune"), "insert must preserve the first tune");

    assert.throws(
      () => deleteTune({
        tuneUid: firstUid,
        expectedPath: filePath,
        expectedVersion: snapshot.version,
        expected: { xNumber: "1" },
      }),
      /working copy changed/,
      "stale-version delete must fail closed"
    );
  });
}

async function testCommitRequiresMatchingPathAndVersion() {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "commit-context.abc");
    const otherPath = path.join(dir, "other.abc");
    const original = "X:1\nT:Original\nK:C\nC |]\n";
    await fs.promises.writeFile(filePath, original, "utf8");
    await openWorkingCopyFromPath(filePath);
    const snapshot = getWorkingCopySnapshot();
    applyFullText("X:1\nT:Edited\nK:C\nD |]\n", {
      expectedPath: filePath,
      expectedVersion: snapshot.version,
    });
    const dirtySnapshot = getWorkingCopySnapshot();

    await assert.rejects(
      () => commitWorkingCopyToDisk({
        force: false,
        expectedPath: otherPath,
        expectedVersion: dirtySnapshot.version,
      }),
      /working copy path changed/
    );
    await assert.rejects(
      () => commitWorkingCopyToDisk({
        force: false,
        expectedPath: filePath,
        expectedVersion: snapshot.version,
      }),
      /working copy changed/
    );
    assert.strictEqual(
      await fs.promises.readFile(filePath, "utf8"),
      original,
      "rejected commits must not alter disk"
    );
  });
}

async function testReloadDoesNotTransferUidByPosition() {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "reload-identity.abc");
    const original = [
      "X:1",
      "T:Original First",
      "K:C",
      "C |]",
      "",
      "X:2",
      "T:Stable Second",
      "K:D",
      "D |]",
      "",
    ].join("\n");
    await fs.promises.writeFile(filePath, original, "utf8");
    await openWorkingCopyFromPath(filePath);
    const before = getWorkingCopySnapshot();
    const firstUid = before.tunes[0].tuneUid;
    const secondUid = before.tunes[1].tuneUid;

    const changed = original.replace("T:Original First", "T:Different First");
    await fs.promises.writeFile(filePath, changed, "utf8");
    await reloadWorkingCopyFromDisk({
      force: true,
      expectedPath: filePath,
      expectedVersion: before.version,
    });
    const after = getWorkingCopySnapshot();

    assert.notStrictEqual(
      after.tunes[0].tuneUid,
      firstUid,
      "a different first tune must not inherit the old first tune UID by position"
    );
    assert.strictEqual(
      after.tunes[1].tuneUid,
      secondUid,
      "an unchanged tune should retain its UID across reload"
    );
  });
}

async function testCloseRequiresMatchingContextAndExplicitDiscard() {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "close-context.abc");
    await fs.promises.writeFile(filePath, "X:1\nT:Close Context\nK:C\nC\n", "utf8");
    await openWorkingCopyFromPath(filePath);
    let snapshot = getWorkingCopySnapshot();

    await assert.rejects(
      () => closeWorkingCopy({
        expectedPath: path.join(dir, "other.abc"),
        expectedVersion: snapshot.version,
        force: true,
      }),
      /path changed/i,
      "close must reject a stale working-copy path"
    );

    applyFullText("X:1\nT:Dirty Close Context\nK:C\nD\n", {
      expectedPath: filePath,
      expectedVersion: snapshot.version,
    });
    snapshot = getWorkingCopySnapshot();
    await assert.rejects(
      () => closeWorkingCopy({
        expectedPath: filePath,
        expectedVersion: snapshot.version,
      }),
      /dirty working copy/i,
      "close must not silently discard dirty text"
    );
    await closeWorkingCopy({
      expectedPath: filePath,
      expectedVersion: snapshot.version,
      force: true,
    });
    assert.strictEqual(getWorkingCopySnapshot(), null, "explicit context-bound discard should close");
  });
}

async function testIpcPreservesWorkingCopyContext() {
  const root = path.resolve(__dirname, "../..");
  const ipc = await fs.promises.readFile(path.join(root, "src/main/ipc.js"), "utf8");
  const commitStart = ipc.indexOf('ipcMain.handle("workingcopy:commit"');
  const commitEnd = ipc.indexOf('ipcMain.handle("workingcopy:write-to-path"', commitStart);
  const closeStart = ipc.indexOf('ipcMain.handle("workingcopy:close"');
  const closeEnd = ipc.indexOf('ipcMain.handle("workingcopy:reload"', closeStart);
  assert(commitStart >= 0 && commitEnd > commitStart, "working-copy commit IPC handler must exist");
  assert(closeStart >= 0 && closeEnd > closeStart, "working-copy close IPC handler must exist");
  const commitBody = ipc.slice(commitStart, commitEnd);
  const closeBody = ipc.slice(closeStart, closeEnd);
  assert(commitBody.includes("expectedPath:"), "commit IPC must preserve expectedPath");
  assert(commitBody.includes("expectedVersion:"), "commit IPC must preserve expectedVersion");
  assert(closeBody.includes("closeWorkingCopy(payload || {})"), "close IPC must preserve context");
}

async function testForcedCommitsStayExplicitlyAuthorized() {
  const root = path.resolve(__dirname, "../..");
  const rendererFiles = await walkFiles(path.join(root, "src", "renderer"));
  const violations = [];
  const forcedPattern = /commitWorkingCopyToDisk\(\{[\s\S]{0,300}?force:\s*true/g;
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

function extractCallAt(text, openParenIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = openParenIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(openParenIndex, i + 1);
    }
  }
  return "";
}

async function testRendererWorkingCopyMutationsAreContextBound() {
  const root = path.resolve(__dirname, "../..");
  const rendererFiles = await walkFiles(path.join(root, "src", "renderer"));
  const methods = [
    "commitWorkingCopyToDisk",
    "writeWorkingCopyToPath",
    "writeWorkingCopyToPathAndSwitch",
    "applyWorkingCopyHeaderText",
    "applyWorkingCopyFullText",
    "insertWorkingCopyTuneAfter",
    "renumberWorkingCopyXStartingAt1",
    "deleteWorkingCopyTune",
    "applyWorkingCopyTuneText",
    "reloadWorkingCopyFromDisk",
  ];
  const violations = [];

  for (const filePath of rendererFiles) {
    const rel = path.relative(root, filePath).replace(/\\/g, "/");
    const source = await fs.promises.readFile(filePath, "utf8");
    for (const method of methods) {
      const needle = `.${method}(`;
      let from = 0;
      while (from < source.length) {
        const at = source.indexOf(needle, from);
        if (at < 0) break;
        const openParen = at + needle.length - 1;
        const call = extractCallAt(source, openParen);
        if (!call || !call.includes("expectedPath")) {
          const line = source.slice(0, at).split(/\r\n|\n|\r/).length;
          violations.push(`${rel}:${line} ${method}`);
        }
        from = openParen + Math.max(1, call.length);
      }
    }
  }

  assert.deepStrictEqual(
    violations,
    [],
    `Working-copy mutations without expectedPath:\n${violations.join("\n")}`
  );
}

async function main() {
  await testConflictDoesNotOverwriteByDefault();
  await testContentHashDetectsSameSizeExternalChange();
  await testDirtyWorkingCopyCannotBeReplacedByOpen();
  await testDirtyWorkingCopyCannotBeReloadedByDefault();
  await testTuneApplyCannotOverwriteFirstTuneByStaleIndex();
  await testStructuralMutationsRequireStableContext();
  await testCommitRequiresMatchingPathAndVersion();
  await testReloadDoesNotTransferUidByPosition();
  await testCloseRequiresMatchingContextAndExplicitDiscard();
  await testIpcPreservesWorkingCopyContext();
  await testForcedCommitsStayExplicitlyAuthorized();
  await testRendererWorkingCopyMutationsAreContextBound();
  console.log("% PASS working copy conflict guard");
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
