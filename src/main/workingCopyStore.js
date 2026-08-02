const crypto = require("crypto");
const fs = require("fs");
const { EventEmitter } = require("events");
const { statFingerprint } = require("./fsFingerprint");
const { segmentTunes } = require("../common/abc/tuneSegmenter");
const { decodeAbcTextFromBuffer, encodeAbcTextToBuffer } = require("./abcCharset");

const emitter = new EventEmitter();

let state = null;
let persistenceInFlight = false;

function makeTuneUid() {
  try {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {}
  return `tune_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function firstNonEmptyLine(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  for (const line of lines) {
    if (String(line || "").trim()) return String(line || "");
  }
  return "";
}

function beginsWithXLine(text) {
  const first = firstNonEmptyLine(text);
  return /^\s*X:/.test(first);
}

function parseXNumberFromText(text) {
  const first = firstNonEmptyLine(text);
  const match = first.match(/^\s*X:\s*(\d+)/);
  return match && match[1] ? String(match[1]) : "";
}

function parseXNumberFromLabel(label) {
  const match = String(label || "").match(/^\s*X:\s*(\d+)/);
  return match && match[1] ? String(match[1]) : "";
}

function parseFirstTitle(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  for (const line of lines) {
    const raw = String(line || "");
    if (/^\s*X:/.test(raw)) continue;
    const match = raw.match(/^T:\s*(.*)$/);
    if (match) return String(match[1] || "").trim();
    const trimmed = raw.trim();
    if (trimmed && !/^[A-Za-z]:/.test(raw) && !/^%/.test(raw)) break;
  }
  return "";
}

function assertTuneIdentity({ tune, oldSlice, nextTuneText, expected } = {}) {
  const exp = expected && typeof expected === "object" ? expected : {};
  const expectedX = String(exp.xNumber || "").trim();
  const expectedTitle = String(exp.title || "").trim();
  const targetX = parseXNumberFromLabel(tune && tune.xLabel);
  const oldX = parseXNumberFromText(oldSlice);
  const nextX = parseXNumberFromText(nextTuneText);

  if (expectedX) {
    if (targetX && targetX !== expectedX) {
      throw new Error(`Refusing to save: target tune identity changed (expected X:${expectedX}, found X:${targetX}).`);
    }
    if (oldX && oldX !== expectedX) {
      throw new Error(`Refusing to save: target tune text changed (expected X:${expectedX}, found X:${oldX}).`);
    }
    if (nextX && nextX !== expectedX) {
      throw new Error(`Refusing to save: editor tune identity does not match target (expected X:${expectedX}, got X:${nextX}).`);
    }
  }

  if (expectedTitle) {
    const oldTitle = parseFirstTitle(oldSlice);
    if (oldTitle && oldTitle !== expectedTitle) {
      throw new Error("Refusing to save: target tune title changed.");
    }
  }
}

function freezeSnapshot(obj) {
  try {
    return Object.freeze(obj);
  } catch {
    return obj;
  }
}

function isMissingFileError(err) {
  const code = err && err.code ? String(err.code) : "";
  return code === "ENOENT";
}

function contentHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function fingerprintWithContent(stat, buffer) {
  return {
    ...(stat || {}),
    sha256: contentHash(buffer),
  };
}

function getWorkingCopySnapshot() {
  if (!state) return null;
  return freezeSnapshot({
    path: state.path,
    text: state.text,
    encoding: state.encoding || "utf8",
    version: state.version,
    dirty: state.dirty,
    diskFingerprintOnOpen: state.diskFingerprintOnOpen ? { ...state.diskFingerprintOnOpen } : null,
    preambleSlice: state.preambleSlice ? { ...state.preambleSlice } : null,
    tunes: (state.tunes || []).map((t) => ({
      tuneIndex: t.tuneIndex,
      tuneUid: t.tuneUid,
      start: t.start,
      end: t.end,
      xLabel: t.xLabel || "",
    })),
  });
}

function getWorkingCopyMetaSnapshot() {
  if (!state) return null;
  return freezeSnapshot({
    path: state.path,
    version: state.version,
    dirty: state.dirty,
    diskFingerprintOnOpen: state.diskFingerprintOnOpen ? { ...state.diskFingerprintOnOpen } : null,
    tuneCount: state.tunes ? state.tunes.length : 0,
  });
}

function assertWorkingCopyContext({ expectedPath, expectedVersion } = {}, operation = "operation") {
  if (!state || !state.path) throw new Error("No working copy open.");
  const expected = String(expectedPath || "");
  if (!expected) throw new Error(`Refusing to ${operation}: expected working copy path is missing.`);
  if (String(state.path) !== expected) {
    throw new Error(`Refusing to ${operation}: working copy path changed.`);
  }
  if (expectedVersion != null) {
    const version = Number(expectedVersion);
    if (!Number.isFinite(version)) {
      throw new Error(`Refusing to ${operation}: expected working copy version is invalid.`);
    }
    if (Number(state.version) !== version) {
      throw new Error(`Refusing to ${operation}: working copy changed.`);
    }
  }
  return state;
}

async function atomicWriteFileWithRetry(filePath, data, { attempts = 5 } = {}) {
  const absPath = String(filePath || "");
  if (!absPath) throw new Error("Missing file path.");
  const tmpPath = `${absPath}.${process.pid}.${Date.now()}.tmp`;
  const backupPath = `${absPath}.${process.pid}.${Date.now()}.bak`;
  // `data` may be a string or a Buffer.
  await fs.promises.writeFile(tmpPath, data);
  let lastErr = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      try {
        await fs.promises.rename(tmpPath, absPath);
        return;
      } catch (e) {
        let backedUp = false;
        try {
          await fs.promises.rename(absPath, backupPath);
          backedUp = true;
        } catch (backupErr) {
          if (!isMissingFileError(backupErr)) throw backupErr;
        }
        try {
          await fs.promises.rename(tmpPath, absPath);
          if (backedUp) {
            try { await fs.promises.unlink(backupPath); } catch {}
          }
          return;
        } catch (replaceErr) {
          if (backedUp) {
            try { await fs.promises.rename(backupPath, absPath); } catch {}
          }
          throw replaceErr;
        }
      }
    } catch (e) {
      lastErr = e;
      const code = e && e.code ? String(e.code) : "";
      if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") break;
      await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
  }
  try { await fs.promises.unlink(tmpPath); } catch {}
  throw lastErr || new Error("Unable to write file.");
}

function buffersEqual(a, b) {
  if (!a || !b) return false;
  try {
    const ba = Buffer.isBuffer(a) ? a : Buffer.from(a);
    const bb = Buffer.isBuffer(b) ? b : Buffer.from(b);
    return ba.length === bb.length && ba.equals(bb);
  } catch {
    return false;
  }
}

async function verifyFileOnDiskMatchesBuffer(filePath, expectedBuffer) {
  const p = String(filePath || "");
  if (!p) throw new Error("Missing file path.");
  const expected = Buffer.isBuffer(expectedBuffer) ? expectedBuffer : Buffer.from(expectedBuffer || "");
  let actual;
  try {
    actual = await fs.promises.readFile(p);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    throw new Error(`Save verification failed: unable to read file back (${msg}).`);
  }
  if (!buffersEqual(actual, expected)) {
    throw new Error(
      `Save verification failed: on-disk content does not match what was written (expected ${expected.length} bytes, got ${actual.length} bytes).`
    );
  }
}

function notifyChanged() {
  try {
    emitter.emit("changed", getWorkingCopyMetaSnapshot());
  } catch {}
}

async function openWorkingCopyFromPath(filePath) {
  const p = String(filePath || "");
  if (!p) throw new Error("Missing file path.");
  if (state && state.path === p) return getWorkingCopyMetaSnapshot();
  if (persistenceInFlight) throw new Error("Refusing to switch working copy while a save is in progress.");
  if (state && state.dirty && state.path && state.path !== p) {
    // A completed save can leave a stale dirty marker after a race with a
    // debounced renderer sync. Reconcile it only when the actual text is
    // unchanged; never discard content that differs from the file on disk.
    try {
      const currentPath = String(state.path);
      const rawCurrent = await fs.promises.readFile(currentPath);
      const decodedCurrent = decodeAbcTextFromBuffer(rawCurrent);
      if (String(decodedCurrent.text || "") === String(state.text || "")) {
        state.dirty = false;
        state.encoding = decodedCurrent.encoding || state.encoding || "utf8";
        state.diskFingerprintOnOpen = fingerprintWithContent(
          await statFingerprint(currentPath),
          rawCurrent
        );
        notifyChanged();
      }
    } catch {}
    if (state.dirty) {
      throw new Error("Refusing to replace a dirty working copy. Save, discard, or reload it first.");
    }
  }

  const raw = await fs.promises.readFile(p);
  const decoded = decodeAbcTextFromBuffer(raw);
  const text = decoded.text;
  const fp = fingerprintWithContent(await statFingerprint(p), raw);
  const seg = segmentTunes(text);
  const tunes = [];
  for (let i = 0; i < seg.tunes.length; i += 1) {
    const t = seg.tunes[i];
    const xLabelRaw = t && t.rawXLine ? String(t.rawXLine).trim() : "";
    tunes.push({
      tuneIndex: i,
      tuneUid: makeTuneUid(),
      start: Number(t.start) || 0,
      end: Number(t.end) || 0,
      xLabel: xLabelRaw,
    });
  }

  state = {
    path: p,
    text,
    encoding: decoded.encoding || "utf8",
    version: 0,
    dirty: false,
    diskFingerprintOnOpen: fp,
    preambleSlice: seg.preambleSlice,
    tunes,
    tuneUidToIndex: new Map(tunes.map((t) => [t.tuneUid, t.tuneIndex])),
  };

  notifyChanged();
  return getWorkingCopyMetaSnapshot();
}

async function closeWorkingCopy({ expectedPath, expectedVersion, force = false } = {}) {
  if (persistenceInFlight) throw new Error("Refusing to close working copy while a save is in progress.");
  if (!state) return true;
  const closingState = assertWorkingCopyContext(
    { expectedPath, expectedVersion },
    "close working copy"
  );
  if (closingState.dirty && !force) {
    throw new Error("Refusing to close a dirty working copy without explicit discard.");
  }
  state = null;
  notifyChanged();
  return true;
}

async function reloadWorkingCopyFromDisk({ force = false, expectedPath, expectedVersion } = {}) {
  if (persistenceInFlight) throw new Error("Refusing to reload working copy while a save is in progress.");
  assertWorkingCopyContext({ expectedPath, expectedVersion }, "reload working copy");
  if (state.dirty && !force) {
    throw new Error("Refusing to reload a dirty working copy. Save or explicitly discard it first.");
  }
  const p = String(state.path || "");
  const raw = await fs.promises.readFile(p);
  const decoded = decodeAbcTextFromBuffer(raw);
  const text = decoded.text;
  const fp = fingerprintWithContent(await statFingerprint(p), raw);
  const seg = segmentTunes(text);

  const prevTunes = state.tunes || [];
  const prevText = String(state.text || "");
  const prevIdentity = prevTunes.map((t, index) => {
    const start = Number(t && t.start);
    const end = Number(t && t.end);
    const slice = Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start
      ? prevText.slice(start, end)
      : "";
    return {
      index,
      tuneUid: t && t.tuneUid ? String(t.tuneUid) : "",
      slice,
      xNumber: parseXNumberFromText(slice),
      title: parseFirstTitle(slice),
    };
  });
  const usedPrevIndexes = new Set();
  const nextTunes = [];
  for (let i = 0; i < seg.tunes.length; i += 1) {
    const t = seg.tunes[i];
    const start = Number(t && t.start) || 0;
    const end = Number(t && t.end) || 0;
    const slice = text.slice(start, end);
    const nextX = parseXNumberFromText(slice);
    const nextTitle = parseFirstTitle(slice);
    let matched = prevIdentity.find((entry) => (
      !usedPrevIndexes.has(entry.index)
      && entry.tuneUid
      && entry.slice === slice
    )) || null;
    if (!matched && nextX) {
      const identityMatches = prevIdentity.filter((entry) => (
        !usedPrevIndexes.has(entry.index)
        && entry.tuneUid
        && entry.xNumber === nextX
        && entry.title === nextTitle
      ));
      if (identityMatches.length === 1) matched = identityMatches[0];
    }
    if (matched) usedPrevIndexes.add(matched.index);
    const tuneUid = matched ? matched.tuneUid : makeTuneUid();
    const xLabelRaw = t && t.rawXLine ? String(t.rawXLine).trim() : "";
    nextTunes.push({
      tuneIndex: i,
      tuneUid,
      start,
      end,
      xLabel: xLabelRaw,
    });
  }

  state.text = text;
  state.encoding = decoded.encoding || state.encoding || "utf8";
  state.version += 1;
  state.dirty = false;
  state.diskFingerprintOnOpen = fp;
  state.preambleSlice = seg.preambleSlice;
  state.tunes = nextTunes;
  state.tuneUidToIndex = new Map(nextTunes.map((t) => [t.tuneUid, t.tuneIndex]));
  try {
    state.lastMutationMeta = { kind: "reloadFromDisk" };
  } catch {}

  notifyChanged();
  return getWorkingCopyMetaSnapshot();
}

async function commitWorkingCopyToDisk({ force = false, expectedPath, expectedVersion } = {}) {
  if (persistenceInFlight) throw new Error("Working copy save is already in progress.");
  const commitState = assertWorkingCopyContext(
    { expectedPath, expectedVersion },
    "save working copy"
  );
  const commitVersion = Number(commitState.version);
  const p = String(commitState.path || "");
  const fpOnOpen = commitState.diskFingerprintOnOpen || null;
  persistenceInFlight = true;

  try {
    let fpNow = null;
    let missingOnDisk = false;
    try {
      const rawNow = await fs.promises.readFile(p);
      fpNow = fingerprintWithContent(await statFingerprint(p), rawNow);
    } catch (err) {
      if (isMissingFileError(err)) missingOnDisk = true;
      else throw err;
    }
    if (missingOnDisk && !force) {
      return { ok: false, missingOnDisk: true, diskFingerprintOnOpen: fpOnOpen };
    }

    const hasConflict = Boolean(
      fpOnOpen
      && fpNow
      && (
        String(fpOnOpen.sha256 || "") !== String(fpNow.sha256 || "")
        || Number(fpOnOpen.mtimeMs) !== Number(fpNow.mtimeMs)
        || Number(fpOnOpen.size) !== Number(fpNow.size)
      )
    );
    if (hasConflict && !force) {
      return {
        ok: false,
        conflict: true,
        diskFingerprintOnOpen: fpOnOpen,
        diskFingerprintNow: fpNow,
      };
    }
    const overwroteExternalChanges = Boolean(hasConflict && force);

    if (state !== commitState || Number(state.version) !== commitVersion) {
      throw new Error("Refusing to save working copy: working copy changed before write.");
    }

    const text = String(commitState.text || "");
    let encoded = null;
    try {
      encoded = encodeAbcTextToBuffer(text);
      commitState.encoding = encoded.encoding || commitState.encoding || "utf8";
      await atomicWriteFileWithRetry(p, encoded.buffer);
      await verifyFileOnDiskMatchesBuffer(p, encoded.buffer);
    } catch (err) {
      try { commitState.dirty = true; } catch {}
      if (isMissingFileError(err) && !force) {
        return { ok: false, missingOnDisk: true, diskFingerprintOnOpen: fpOnOpen };
      }
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
    const fpAfter = fingerprintWithContent(await statFingerprint(p), encoded.buffer);
    if (state !== commitState || Number(state.version) !== commitVersion) {
      throw new Error("Working copy changed during save; saved data was not marked clean.");
    }
    commitState.diskFingerprintOnOpen = fpAfter;
    commitState.dirty = false;
    try {
      commitState.lastMutationMeta = { kind: "commitToDisk", forced: Boolean(force), overwroteExternalChanges };
    } catch {}
    notifyChanged();
    return { ok: true, diskFingerprint: fpAfter, overwroteExternalChanges };
  } finally {
    persistenceInFlight = false;
  }
}

async function writeWorkingCopyToPath(targetPath, context = {}) {
  if (persistenceInFlight) throw new Error("Working copy save is already in progress.");
  const sourceState = assertWorkingCopyContext(context, "write working copy to path");
  const p = String(targetPath || "");
  if (!p) throw new Error("Missing file path.");
  const text = String(sourceState.text || "");
  persistenceInFlight = true;
  try {
    const encoded = encodeAbcTextToBuffer(text);
    await atomicWriteFileWithRetry(p, encoded.buffer);
    await verifyFileOnDiskMatchesBuffer(p, encoded.buffer);
    return true;
  } finally {
    persistenceInFlight = false;
  }
}

async function writeWorkingCopyToPathAndSwitch(targetPath, context = {}) {
  if (persistenceInFlight) throw new Error("Working copy save is already in progress.");
  const sourceState = assertWorkingCopyContext(context, "save working copy as");
  const p = String(targetPath || "");
  if (!p) throw new Error("Missing file path.");
  const text = String(sourceState.text || "");
  persistenceInFlight = true;
  try {
    const encoded = encodeAbcTextToBuffer(text);
    sourceState.encoding = encoded.encoding || sourceState.encoding || "utf8";
    await atomicWriteFileWithRetry(p, encoded.buffer);
    await verifyFileOnDiskMatchesBuffer(p, encoded.buffer);
    const fp = fingerprintWithContent(await statFingerprint(p), encoded.buffer);
    if (state !== sourceState) throw new Error("Refusing to switch path: working copy changed.");
    sourceState.path = p;
    sourceState.diskFingerprintOnOpen = fp;
    sourceState.dirty = false;
    sourceState.version += 1;
    try {
      sourceState.lastMutationMeta = { kind: "writeToPathAndSwitch" };
    } catch {}
    notifyChanged();
    return getWorkingCopyMetaSnapshot();
  } finally {
    persistenceInFlight = false;
  }
}

function onWorkingCopyChanged(listener) {
  emitter.on("changed", listener);
  return () => emitter.off("changed", listener);
}

function mutateWorkingCopy(mutatorFn, meta, context) {
  if (persistenceInFlight) throw new Error("Refusing to change working copy while a save is in progress.");
  assertWorkingCopyContext(context, (meta && meta.kind) ? String(meta.kind) : "change working copy");
  if (typeof mutatorFn !== "function") throw new Error("mutatorFn must be a function.");

  const prevVersion = state.version;
  const prevTunes = state.tunes || [];
  const draft = {
    path: state.path,
    text: state.text,
    diskFingerprintOnOpen: state.diskFingerprintOnOpen,
  };

  let result;
  try {
    result = mutatorFn(draft);
  } catch (e) {
    throw e;
  }

  const nextText = (result && typeof result.text === "string") ? result.text : draft.text;
  if (typeof nextText !== "string") throw new Error("mutateWorkingCopy: text must be a string.");

  state.text = nextText;
  state.version = prevVersion + 1;
  state.dirty = true;

  const seg = segmentTunes(state.text);
  state.preambleSlice = seg.preambleSlice;

  // Preserve tuneUid mapping when it is safe to do so:
  // - Same tune count: preserve by index (stable segmentation).
  // - Delete one tune (count-1) and we know the deleted index: shift mapping accordingly.
  // - Insert one tune (count+1) and we know the insertion index: shift mapping accordingly.
  // Otherwise: regenerate tuneUids (safest).
  const nextTunes = [];
  const metaKind = meta && meta.kind ? String(meta.kind) : "";
  const forceRegenerateTuneUids = Boolean(meta && meta.regenerateTuneUids);
  const deletedIndex = (metaKind === "deleteTune" && meta && Number.isFinite(Number(meta.resolvedIndex)))
    ? Number(meta.resolvedIndex)
    : null;
  const insertIndex = (metaKind === "insertTune" && meta && Number.isFinite(Number(meta.insertIndex)))
    ? Number(meta.insertIndex)
    : null;
  const canPreserveByIndex = !forceRegenerateTuneUids && prevTunes.length === seg.tunes.length;
  const canPreserveDeleteShift = (
    !forceRegenerateTuneUids
    && deletedIndex != null
    && deletedIndex >= 0
    && deletedIndex < prevTunes.length
    && prevTunes.length === seg.tunes.length + 1
  );
  const canPreserveInsertShift = (
    !forceRegenerateTuneUids
    && insertIndex != null
    && insertIndex >= 0
    && insertIndex <= prevTunes.length
    && prevTunes.length + 1 === seg.tunes.length
  );
  for (let i = 0; i < seg.tunes.length; i += 1) {
    const t = seg.tunes[i];
    let tuneUid = null;
    if (canPreserveDeleteShift) {
      const srcIdx = i < deletedIndex ? i : i + 1;
      const prev = prevTunes[srcIdx];
      tuneUid = prev && prev.tuneUid ? prev.tuneUid : null;
    } else if (canPreserveInsertShift) {
      if (i === insertIndex) {
        tuneUid = null;
      } else {
        const srcIdx = i < insertIndex ? i : i - 1;
        const prev = prevTunes[srcIdx];
        tuneUid = prev && prev.tuneUid ? prev.tuneUid : null;
      }
    } else if (canPreserveByIndex) {
      const prev = prevTunes[i];
      tuneUid = prev && prev.tuneUid ? prev.tuneUid : null;
    }
    if (!tuneUid) tuneUid = makeTuneUid();
    const xLabelRaw = t && t.rawXLine ? String(t.rawXLine).trim() : "";
    nextTunes.push({
      tuneIndex: i,
      tuneUid,
      start: Number(t.start) || 0,
      end: Number(t.end) || 0,
      xLabel: xLabelRaw,
    });
  }
  state.tunes = nextTunes;
  state.tuneUidToIndex = new Map(nextTunes.map((t) => [t.tuneUid, t.tuneIndex]));

  if (state.version !== prevVersion + 1) {
    throw new Error("mutateWorkingCopy: version invariant violated.");
  }

  try {
    state.lastMutationMeta = meta ? { ...meta } : null;
  } catch {}

  notifyChanged();
  return getWorkingCopyMetaSnapshot();
}

function applyHeaderText(headerText, context = {}) {
  const nextHeader = String(headerText == null ? "" : headerText);
  return mutateWorkingCopy((draft) => {
    const fullText = String(draft.text || "");
    // Do not use `\s*` here: it can consume newlines and shift the boundary into blank lines.
    const match = fullText.match(/^[\t ]*X:/m);
    const headerEnd = match && Number.isFinite(match.index) ? match.index : fullText.length;
    const suffix = fullText.slice(headerEnd);

    let header = nextHeader;
    if (header && !/[\r\n]$/.test(header) && /^[\t ]*X:/.test(suffix)) header += "\n";
    draft.text = `${header}${suffix}`;
    return { text: draft.text };
  }, { kind: "applyHeaderText" }, context);
}

function renumberXStartingAt1(context = {}) {
  return mutateWorkingCopy((draft) => {
    const text = String(draft.text || "");
    const newline = text.includes("\r\n") ? "\r\n" : "\n";
    const lines = text.split(/\r\n|\n|\r/);
    let foundAny = false;
    let n = 0;
    const out = [];

    for (const line of lines) {
      const match = String(line || "").match(/^(\s*X:\s*)(.*)$/);
      if (!match) {
        out.push(line);
        continue;
      }
      foundAny = true;
      n += 1;
      const prefix = match[1] || "X:";
      out.push(`${prefix}${n}`);
    }

    if (!foundAny) throw new Error("No X: headers found in file.");
    draft.text = out.join(newline);
    return { text: draft.text };
  }, { kind: "renumberXStartingAt1", regenerateTuneUids: true }, context);
}

function deleteTune({ tuneUid, tuneIndex, expectedPath, expectedVersion, expected } = {}) {
  const uid = tuneUid != null ? String(tuneUid) : "";
  const idx = Number.isFinite(Number(tuneIndex)) ? Number(tuneIndex) : null;
  if (!uid) throw new Error("Missing stable tuneUid.");

  const tunes = state && Array.isArray(state.tunes) ? state.tunes : [];
  const found = state && state.tuneUidToIndex ? state.tuneUidToIndex.get(uid) : null;
  const resolvedIndex = Number.isFinite(Number(found)) ? Number(found) : null;

  return mutateWorkingCopy((draft) => {
    if (resolvedIndex == null || resolvedIndex < 0 || resolvedIndex >= tunes.length) {
      throw new Error("Tune not found.");
    }
    const tune = tunes[resolvedIndex];
    const start = Number(tune && tune.start);
    const end = Number(tune && tune.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
      throw new Error("Tune slice is invalid.");
    }
    const fullText = String(draft.text || "");
    if (end > fullText.length) throw new Error("Tune slice is out of bounds.");
    const oldSlice = fullText.slice(start, end);
    assertTuneIdentity({ tune, oldSlice, nextTuneText: oldSlice, expected });

    let before = fullText.slice(0, start);
    let after = fullText.slice(end);
    if (/\r?\n$/.test(before) && /^\r?\n/.test(after)) {
      after = after.replace(/^\r?\n/, "");
    }
    draft.text = `${before}${after}`;
    return { text: draft.text };
  }, { kind: "deleteTune", tuneUid: uid, tuneIndex: idx, resolvedIndex }, {
    expectedPath,
    expectedVersion,
  });
}

function applyTuneText({ tuneUid, tuneIndex, text, expected, expectedPath, expectedVersion } = {}) {
  const uid = tuneUid != null ? String(tuneUid) : "";
  const idx = Number.isFinite(Number(tuneIndex)) ? Number(tuneIndex) : null;
  const nextTuneText = (text != null) ? String(text) : "";
  if (!uid) throw new Error("Missing stable tuneUid.");

  return mutateWorkingCopy((draft) => {
    const tunes = state && Array.isArray(state.tunes) ? state.tunes : [];
    let resolvedIndex = null;
    const byUid = state && state.tuneUidToIndex && uid ? state.tuneUidToIndex.get(uid) : null;
    if (Number.isFinite(Number(byUid))) resolvedIndex = Number(byUid);
    if (resolvedIndex == null) throw new Error("Tune not found by stable tuneUid.");
    if (resolvedIndex == null || resolvedIndex < 0 || resolvedIndex >= tunes.length) {
      throw new Error("Tune not found.");
    }
    const tune = tunes[resolvedIndex];
    const start = Number(tune && tune.start);
    const end = Number(tune && tune.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
      throw new Error("Tune slice is invalid.");
    }
    const fullText = String(draft.text || "");
    if (end > fullText.length) throw new Error("Tune slice is out of bounds.");
    const oldSlice = fullText.slice(start, end);
    if (beginsWithXLine(oldSlice) && !beginsWithXLine(nextTuneText)) {
      throw new Error("Refusing to save: tune must start with an X: header.");
    }
    assertTuneIdentity({ tune, oldSlice, nextTuneText, expected });
    draft.text = `${fullText.slice(0, start)}${nextTuneText}${fullText.slice(end)}`;
    return { text: draft.text };
  }, { kind: "applyTuneText", tuneUid: uid || null, tuneIndex: idx }, {
    expectedPath,
    expectedVersion,
  });
}

function applyFullText(text, context = {}) {
  const next = String(text == null ? "" : text);
  return mutateWorkingCopy((draft) => {
    draft.text = next;
    return { text: draft.text };
  }, { kind: "applyFullText", regenerateTuneUids: true }, context);
}

function insertTuneAfter({
  afterTuneUid,
  afterTuneIndex,
  append = false,
  text,
  expectedPath,
  expectedVersion,
} = {}) {
  assertWorkingCopyContext({ expectedPath, expectedVersion }, "insert tune");
  const tunes = state && Array.isArray(state.tunes) ? state.tunes : [];
  const uid = String(afterTuneUid || "");
  let afterIdx = null;
  if (append) {
    afterIdx = tunes.length - 1;
  } else if (uid) {
    const found = state && state.tuneUidToIndex ? state.tuneUidToIndex.get(uid) : null;
    afterIdx = Number.isFinite(Number(found)) ? Number(found) : null;
    if (afterIdx == null) throw new Error("Tune not found by stable tuneUid.");
  } else if (Number.isFinite(Number(afterTuneIndex))) {
    throw new Error("Refusing to insert tune by index without stable tuneUid.");
  }
  const insertIdx = afterIdx == null ? tunes.length : Math.max(0, Math.min(tunes.length, afterIdx + 1));
  const tuneText = String(text == null ? "" : text);
  if (!tuneText.trim()) throw new Error("Missing tune text.");

  const newline = state.text && String(state.text).includes("\r\n") ? "\r\n" : "\n";
  const insertOffset = (() => {
    if (insertIdx <= 0) {
      const preEnd = state.preambleSlice && Number.isFinite(Number(state.preambleSlice.end))
        ? Number(state.preambleSlice.end)
        : 0;
      return Math.max(0, Math.min(String(state.text || "").length, preEnd));
    }
    const prevTune = tunes[insertIdx - 1];
    const end = prevTune && Number.isFinite(Number(prevTune.end)) ? Number(prevTune.end) : String(state.text || "").length;
    return Math.max(0, Math.min(String(state.text || "").length, end));
  })();

  return mutateWorkingCopy((draft) => {
    const fullText = String(draft.text || "");
    let before = fullText.slice(0, insertOffset);
    let after = fullText.slice(insertOffset);
    let prepared = String(tuneText || "");
    if (prepared && !/\r?\n$/.test(prepared)) prepared += newline;
    if (before && !/\r?\n$/.test(before)) before += newline;
    if (/^\r?\n/.test(prepared) && /\r?\n$/.test(before)) prepared = prepared.replace(/^\r?\n/, "");
    if (/^\r?\n/.test(after) && /\r?\n$/.test(prepared)) after = after.replace(/^\r?\n/, "");
    draft.text = `${before}${prepared}${after}`;
    return { text: draft.text };
  }, { kind: "insertTune", insertIndex: insertIdx }, {
    expectedPath,
    expectedVersion,
  });
}

module.exports = {
  openWorkingCopyFromPath,
  closeWorkingCopy,
  reloadWorkingCopyFromDisk,
  commitWorkingCopyToDisk,
  writeWorkingCopyToPath,
  writeWorkingCopyToPathAndSwitch,
  getWorkingCopySnapshot,
  getWorkingCopyMetaSnapshot,
  onWorkingCopyChanged,
  mutateWorkingCopy,
  applyHeaderText,
  applyFullText,
  insertTuneAfter,
  renumberXStartingAt1,
  deleteTune,
  applyTuneText,
};
