import { NotePreviewAudio } from "../../audio/note_preview_audio.mjs";
import {
  findCompletedNoteTokenBeforePosition,
  isRangeInsideInlineField,
  parseAbcNoteToken,
  parseHeadersNear,
} from "../../note_preview/abc_note_parse.mjs";
import { createMidiInputPopoverController } from "./midi_input_popover_controller.js";

const MIDI_PREVIEW_VOLUME_SYNC_KEYS = ["midiInputBeepVolume", "noteTypingPreviewVolume"];

const MIDI_MACRO_MAP = new Map([
  [24, " "],
  [26, "|"],
  [27, "/"],
  [28, "2"],
  [29, "3"],
  [30, "4"],
  [31, "(3"],
  [32, "|:"],
  [33, ":|"],
  [34, "||"],
  [35, "|]"],
]);

function clampNumber(value, min, max, fallback) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, raw));
}

function resolveDefaultElements(documentRef) {
  const doc = documentRef || (typeof document !== "undefined" ? document : null);
  const byId = (id) => (doc && typeof doc.getElementById === "function" ? doc.getElementById(id) : null);
  return {
    statusButton: byId("midiInputStatus"),
    popover: byId("midiInputPopover"),
    closeButton: byId("midiInputPopoverClose"),
    enabledControl: byId("midiInputEnabledCtl"),
    mutedControl: byId("midiInputMutedCtl"),
    keyAwareControl: byId("midiInputKeyAwareCtl"),
    gridControl: byId("midiInputGridCtl"),
    macroControl: byId("midiInputMacroCtl"),
    macroNote: byId("midiInputMacroNote"),
    stateHint: byId("midiInputStateHint"),
    enabledDependent: byId("midiInputEnabledDependent"),
    beepControl: byId("midiInputBeepCtl"),
    beepDurationWrap: byId("midiInputBeepDurationWrap"),
    notePreviewControl: byId("noteTypingPreviewCtl"),
    notePreviewDependent: byId("noteTypingPreviewDependent"),
    notePreviewTriggerControl: byId("noteTypingPreviewTriggerCtl"),
    previewSharedGroup: byId("midiPreviewSharedGroup"),
    volumeControl: byId("midiInputBeepVolumeCtl"),
    durationControl: byId("midiInputBeepDurationCtl"),
  };
}

function createMidiInputFeature({
  elements = null,
  documentRef = null,
  api,
  setButtonText,
  showToast = () => {},
  getActiveEditorView = () => null,
  insertTextAtCursor = () => false,
  deleteCharBeforeCursor = () => false,
  getDefaultLen = () => 1 / 8,
  gcdInt = (a, b) => {
    let x = Math.abs(Number(a) || 0);
    let y = Math.abs(Number(b) || 0);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  },
  isTypingPreviewBlocked = () => false,
  isMainEditorUpdate = () => true,
  refreshCursorStatus = () => {},
  hasCursorStatus = () => false,
  navigatorRef = () => (typeof navigator !== "undefined" ? navigator : null),
  windowRef = () => (typeof window !== "undefined" ? window : null),
} = {}) {
  const resolvedElements = elements || resolveDefaultElements(documentRef);
  let midiInputEnabled = false;
  let midiInputMuted = false;
  let midiAccess = null;
  let midiInitPromise = null;
  let midiDeviceCount = 0;
  let midiWarnedUnsupported = false;
  let midiInputKeyAware = false;
  let midiInputGrid = "1/16";
  let midiInputMacroEnabled = true;
  let midiInputBeepEnabled = false;
  let midiInputBeepVolume = 0.2;
  let midiInputBeepDurationMs = 140;
  const midiBeepAudio = new NotePreviewAudio();
  let noteTypingPreviewEnabled = false;
  let noteTypingPreviewVolume = 0.22;
  let noteTypingPreviewLengthMode = "typed";
  let noteTypingPreviewTrigger = "delimiter";
  let noteTypingPreviewEnvelope = "short";
  let noteTypingPreviewRetriggerDuration = true;
  let noteTypingPreviewSkipMicrotones = true;
  let noteTypingPreviewLastKey = "";
  const noteTypingPreviewAudio = new NotePreviewAudio();

  function supportsMidiInput() {
    const nav = navigatorRef();
    return Boolean(nav && typeof nav.requestMIDIAccess === "function");
  }

  const popoverController = createMidiInputPopoverController({
    statusButton: resolvedElements.statusButton,
    popover: resolvedElements.popover,
    closeButton: resolvedElements.closeButton,
    enabledControl: resolvedElements.enabledControl,
    mutedControl: resolvedElements.mutedControl,
    keyAwareControl: resolvedElements.keyAwareControl,
    gridControl: resolvedElements.gridControl,
    macroControl: resolvedElements.macroControl,
    macroNote: resolvedElements.macroNote,
    stateHint: resolvedElements.stateHint,
    enabledDependent: resolvedElements.enabledDependent,
    beepControl: resolvedElements.beepControl,
    beepDurationWrap: resolvedElements.beepDurationWrap,
    notePreviewControl: resolvedElements.notePreviewControl,
    notePreviewDependent: resolvedElements.notePreviewDependent,
    notePreviewTriggerControl: resolvedElements.notePreviewTriggerControl,
    previewSharedGroup: resolvedElements.previewSharedGroup,
    volumeControl: resolvedElements.volumeControl,
    durationControl: resolvedElements.durationControl,
    setButtonText,
    getState: () => ({
      supported: supportsMidiInput(),
      enabled: midiInputEnabled,
      muted: midiInputMuted,
      devices: midiDeviceCount,
      keyAware: midiInputKeyAware,
      grid: midiInputGrid,
      macro: midiInputMacroEnabled,
      beepEnabled: midiInputBeepEnabled,
      beepDurationMs: midiInputBeepDurationMs,
      notePreviewEnabled: noteTypingPreviewEnabled,
      notePreviewVolume: noteTypingPreviewVolume,
      notePreviewTrigger: noteTypingPreviewTrigger,
    }),
    onPatch: (patch) => applySettingsPatch(patch),
    onUnlockAudio: () => unlockAudioContext(),
  });

  function refreshCursorIfNeeded() {
    if (hasCursorStatus()) refreshCursorStatus();
  }

  function updateUi() {
    popoverController.render();
  }

  function getStatus() {
    return {
      enabled: midiInputEnabled,
      muted: midiInputMuted,
      ready: Boolean(midiAccess),
      devices: midiDeviceCount,
      supported: supportsMidiInput(),
      keyAware: midiInputKeyAware,
      grid: midiInputGrid,
      macro: midiInputMacroEnabled,
    };
  }

  async function unlockAudioContext() {
    return midiBeepAudio.unlock();
  }

  function playMidiBeep(noteNumber) {
    if (!midiInputBeepEnabled) return;
    midiBeepAudio.playMidiNote(noteNumber, {
      durationMs: midiInputBeepDurationMs,
      volume: midiInputBeepVolume,
      minDurationMs: 40,
      maxDurationMs: 400,
      profile: "short",
    }).catch(() => {});
  }

  function isTypingPreviewAllowedOnLine(lineText, tokenStartRel, tokenEndRel, options = {}) {
    const text = String(lineText || "");
    const allowAdjacentNoteLetters = Boolean(options && options.allowAdjacentNoteLetters);
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (/^%/.test(trimmed)) return false;
    if (/^%%/.test(trimmed)) return false;
    if (/^[A-Za-z]:/.test(trimmed)) return false;
    if (/^[Ww]:/.test(trimmed)) return false;
    if (isRangeInsideInlineField(text, tokenStartRel, tokenEndRel)) return false;

    const left = text.slice(0, Math.max(0, tokenEndRel));
    const quoteCount = (left.match(/"/g) || []).length;
    if ((quoteCount % 2) === 1) return false;

    const before = tokenStartRel > 0 ? text[tokenStartRel - 1] : "";
    if (before && /[A-Za-z]/.test(before)) {
      const adjacentNoteLetters = /[A-Ga-g]/.test(before) && /[A-Ga-g]/.test(text[tokenStartRel] || "");
      if (!(allowAdjacentNoteLetters && adjacentNoteLetters)) return false;
    }
    return true;
  }

  function handleTypingPreviewChange(update) {
    if (!noteTypingPreviewEnabled) return false;
    if (!update || !update.docChanged) return false;
    if (isTypingPreviewBlocked()) return false;
    if (!isMainEditorUpdate(update)) return false;
    if (!Array.isArray(update.transactions) || update.transactions.length !== 1) return false;
    const tr = update.transactions[0];
    if (!tr || tr.isUserEvent("delete") || tr.isUserEvent("input.paste")) return false;
    let changeCount = 0;
    let insertFrom = -1;
    let inserted = "";
    let hasDelete = false;
    tr.changes.iterChanges((fromA, toA, fromB, _toB, text) => {
      changeCount += 1;
      if (fromA !== toA) hasDelete = true;
      insertFrom = fromB;
      inserted += String(text || "");
    });
    if (hasDelete || changeCount !== 1 || inserted.length !== 1) return false;
    const mode = noteTypingPreviewTrigger === "note" ? "note" : "delimiter";
    let tokenInfo = null;
    if (mode === "delimiter") {
      if (!/[ \t|\n]/.test(inserted)) return false;
      tokenInfo = findCompletedNoteTokenBeforePosition(update.state.doc, insertFrom);
      if (tokenInfo) {
        const line = update.state.doc.lineAt(tokenInfo.from);
        const startRel = tokenInfo.from - line.from;
        const endRel = tokenInfo.to - line.from;
        if (!isTypingPreviewAllowedOnLine(line.text, startRel, endRel)) return false;
      }
    } else {
      const line = update.state.doc.lineAt(insertFrom + 1);
      const rel = insertFrom - line.from;
      const text = String(line.text || "");
      if (rel < 0 || rel >= text.length) return false;

      if (/[A-Ga-g]/.test(inserted)) {
        if (!/[A-Ga-g]/.test(text[rel])) return false;
        let start = rel;
        while (start > 0 && /[\^_=]/.test(text[start - 1])) start -= 1;
        tokenInfo = {
          token: text.slice(start, rel + 1),
          from: line.from + start,
          to: line.from + rel + 1,
        };
        if (!isTypingPreviewAllowedOnLine(text, start, rel + 1, { allowAdjacentNoteLetters: true })) return false;
      } else if (noteTypingPreviewRetriggerDuration && /[0-9/]/.test(inserted)) {
        let noteIdx = rel;
        while (noteIdx >= 0 && !/[A-Ga-g]/.test(text[noteIdx])) noteIdx -= 1;
        if (noteIdx < 0) return false;
        let start = noteIdx;
        while (start > 0 && /[\^_=]/.test(text[start - 1])) start -= 1;
        const token = text.slice(start, rel + 1);
        if (!/^[\^_=]*[A-Ga-g][',]*[0-9/]*$/.test(token)) return false;
        tokenInfo = {
          token,
          from: line.from + start,
          to: line.from + rel + 1,
        };
        if (!isTypingPreviewAllowedOnLine(text, start, rel + 1, { allowAdjacentNoteLetters: true })) return false;
      } else {
        return false;
      }
    }
    if (!tokenInfo || !tokenInfo.token) return false;
    const dedupeKey = `${mode}:${tokenInfo.from}:${tokenInfo.to}:${tokenInfo.token}`;
    if (dedupeKey === noteTypingPreviewLastKey) return false;
    const context = parseHeadersNear(update.state.doc, tokenInfo.from);
    const parsed = parseAbcNoteToken(tokenInfo.token, context, {
      lengthMode: noteTypingPreviewLengthMode,
      skipMicrotones: noteTypingPreviewSkipMicrotones,
    });
    if (!parsed || !Number.isFinite(parsed.midi) || !Number.isFinite(parsed.durationMs)) return false;
    noteTypingPreviewLastKey = dedupeKey;
    noteTypingPreviewAudio.playMidiNote(parsed.midi, {
      durationMs: parsed.durationMs,
      volume: noteTypingPreviewVolume,
      minDurationMs: 60,
      maxDurationMs: 2500,
      profile: noteTypingPreviewEnvelope,
    }).catch(() => {});
    return true;
  }

  function approxFraction(value, maxDen = 64) {
    if (!Number.isFinite(value) || value <= 0) return { num: 1, den: 1 };
    let best = { num: 1, den: 1, err: Math.abs(value - 1) };
    for (let den = 1; den <= maxDen; den += 1) {
      const num = Math.round(value * den);
      const err = Math.abs(value - (num / den));
      if (err < best.err) best = { num, den, err };
      if (err === 0) break;
    }
    const div = gcdInt(best.num, best.den);
    return { num: best.num / div, den: best.den / div };
  }

  function getGridLengthValue(grid) {
    const value = String(grid || "").trim();
    if (value === "1/8") return 1 / 8;
    if (value === "1/16") return 1 / 16;
    if (value === "1/32") return 1 / 32;
    return 0;
  }

  function getNoteLengthSuffixForGrid(view) {
    const gridLen = getGridLengthValue(midiInputGrid);
    if (!gridLen) return "";
    const text = view && view.state && view.state.doc ? view.state.doc.toString() : "";
    const defaultLen = getDefaultLen(text);
    if (!Number.isFinite(defaultLen) || defaultLen <= 0) return "";
    const ratio = gridLen / defaultLen;
    if (!Number.isFinite(ratio) || ratio <= 0) return "";
    const { num, den } = approxFraction(ratio, 64);
    if (num === den) return "";
    if (den === 1) return String(num);
    if (num === 1) {
      if ((den & (den - 1)) === 0) {
        const slashes = Math.round(Math.log2(den));
        return "/".repeat(Math.max(1, slashes));
      }
      return `/${den}`;
    }
    return `${num}/${den}`;
  }

  function parseKeySignature(text) {
    const match = String(text || "").match(/(?:^|\n)K:\s*([^\r\n]+)/i);
    if (!match) return { sharps: [], flats: [], preferSharps: true };
    const raw = String(match[1] || "").trim();
    const token = raw.split(/\s+/)[0] || raw;
    const m = token.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!m) return { sharps: [], flats: [], preferSharps: true };
    const letter = m[1].toUpperCase();
    const acc = m[2] || "";
    const tail = (m[3] || "").toLowerCase();
    const isMinor = tail.startsWith("m") && !tail.startsWith("maj");
    const key = `${letter}${acc}${isMinor ? "m" : ""}`;
    const majorSharps = ["C", "G", "D", "A", "E", "B", "F#", "C#"];
    const majorFlats = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
    const minorSharps = ["Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "A#m"];
    const minorFlats = ["Am", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm"];
    const sharpOrder = ["F", "C", "G", "D", "A", "E", "B"];
    const flatOrder = ["B", "E", "A", "D", "G", "C", "F"];
    let sharps = [];
    let flats = [];
    if (isMinor) {
      const idxSharp = minorSharps.indexOf(key);
      const idxFlat = minorFlats.indexOf(key);
      if (idxSharp > 0) sharps = sharpOrder.slice(0, idxSharp);
      if (idxFlat > 0) flats = flatOrder.slice(0, idxFlat);
    } else {
      const idxSharp = majorSharps.indexOf(key);
      const idxFlat = majorFlats.indexOf(key);
      if (idxSharp > 0) sharps = sharpOrder.slice(0, idxSharp);
      if (idxFlat > 0) flats = flatOrder.slice(0, idxFlat);
    }
    if (sharps.length && flats.length) {
      if (sharps.length >= flats.length) flats = [];
      else sharps = [];
    }
    const preferSharps = sharps.length > 0 || flats.length === 0;
    return { sharps, flats, preferSharps };
  }

  function midiNoteToAbc(noteNumber, { preferSharps = true } = {}) {
    const note = Number(noteNumber);
    if (!Number.isFinite(note)) return "";
    const pc = ((note % 12) + 12) % 12;
    const octave = Math.floor(note / 12) - 1;
    const sharpNames = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];
    const flatNames = ["C", "_D", "D", "_E", "E", "F", "_G", "G", "_A", "A", "_B", "B"];
    const name = (preferSharps ? sharpNames : flatNames)[pc];
    const accidental = name.length > 1 ? name[0] : "";
    const letter = name.length > 1 ? name.slice(1) : name;
    const base = octave >= 5 ? letter.toLowerCase() : letter.toUpperCase();
    const suffix = octave >= 5 ? "'".repeat(octave - 5) : ",".repeat(Math.max(0, 4 - octave));
    return `${accidental}${base}${suffix}`;
  }

  function midiNoteToAbcKeyAware(noteNumber, view) {
    const note = Number(noteNumber);
    if (!Number.isFinite(note)) return "";
    const text = view && view.state && view.state.doc ? view.state.doc.toString() : "";
    const sig = parseKeySignature(text);
    const noteText = midiNoteToAbc(note, { preferSharps: sig.preferSharps });
    if (!noteText) return "";
    const acc = noteText[0] === "^" || noteText[0] === "_" || noteText[0] === "=" ? noteText[0] : "";
    const core = acc ? noteText.slice(1) : noteText;
    const letter = core[0] ? core[0].toUpperCase() : "";
    if (!letter) return noteText;
    if (!acc) {
      if (sig.sharps.includes(letter) || sig.flats.includes(letter)) return `=${core}`;
      return noteText;
    }
    if (acc === "^" && sig.sharps.includes(letter)) return core;
    if (acc === "_" && sig.flats.includes(letter)) return core;
    return noteText;
  }

  function handleMidiMacro(noteNumber) {
    if (!midiInputMacroEnabled) return false;
    if (noteNumber === 25) return deleteCharBeforeCursor();
    const macro = MIDI_MACRO_MAP.get(noteNumber);
    if (!macro) return false;
    if (midiInputBeepEnabled) playMidiBeep(noteNumber);
    return insertTextAtCursor(macro);
  }

  function handleMidiMessage(event) {
    try {
      if (!midiInputEnabled || midiInputMuted) return;
      if (!event || !event.data || event.data.length < 3) return;
      const status = event.data[0] & 0xf0;
      if (status !== 0x90) return;
      const note = event.data[1];
      const velocity = event.data[2];
      if (!velocity) return;
      if (handleMidiMacro(note)) return;
      if (note < 36 || note > 96) return;
      const view = getActiveEditorView();
      if (!view) return;
      const abc = midiInputKeyAware ? midiNoteToAbcKeyAware(note, view) : midiNoteToAbc(note);
      if (!abc) return;
      const lengthSuffix = getNoteLengthSuffixForGrid(view);
      if (midiInputBeepEnabled) playMidiBeep(note);
      insertTextAtCursor(`${abc}${lengthSuffix}`);
    } catch {}
  }

  function refreshMidiInputs() {
    if (!midiAccess) return;
    let count = 0;
    try {
      for (const input of midiAccess.inputs.values()) {
        count += 1;
        input.onmidimessage = handleMidiMessage;
      }
    } catch {}
    midiDeviceCount = count;
    updateUi();
    refreshCursorIfNeeded();
  }

  function setEnabled(next, { notify = true } = {}) {
    const desired = Boolean(next);
    if (midiInputEnabled === desired) return;
    midiInputEnabled = desired;
    if (midiInputEnabled) init();
    if (notify) {
      try { showToast(midiInputEnabled ? "MIDI input enabled." : "MIDI input disabled.", 2000); } catch {}
    }
    updateUi();
    refreshCursorIfNeeded();
  }

  function setMuted(next, { notify = true } = {}) {
    const desired = Boolean(next);
    if (midiInputMuted === desired) return;
    midiInputMuted = desired;
    if (notify) {
      try { showToast(midiInputMuted ? "MIDI input muted." : "MIDI input unmuted.", 2000); } catch {}
    }
    updateUi();
    refreshCursorIfNeeded();
  }

  function setGrid(next) {
    const value = String(next || "").trim();
    midiInputGrid = (value === "1/8" || value === "1/16" || value === "1/32") ? value : "1/16";
  }

  function persistSettingsPatch(patch) {
    if (!api || typeof api.updateSettings !== "function") return;
    const persistedPatch = {};
    for (const [key, value] of Object.entries(patch)) persistedPatch[key] = value;
    if (
      Object.prototype.hasOwnProperty.call(persistedPatch, "midiInputBeepVolume")
      || Object.prototype.hasOwnProperty.call(persistedPatch, "noteTypingPreviewVolume")
    ) {
      const merged = Object.prototype.hasOwnProperty.call(persistedPatch, "noteTypingPreviewVolume")
        ? persistedPatch.noteTypingPreviewVolume
        : persistedPatch.midiInputBeepVolume;
      if (Number.isFinite(Number(merged))) {
        const normalized = clampNumber(merged, 0, 1, 0);
        for (const key of MIDI_PREVIEW_VOLUME_SYNC_KEYS) persistedPatch[key] = normalized;
      }
    }
    api.updateSettings(persistedPatch).catch(() => {});
  }

  function applySettingsPatch(patch, { notify = false, persist = true } = {}) {
    if (!patch || typeof patch !== "object") return;
    if (Object.prototype.hasOwnProperty.call(patch, "midiInputEnabled")) {
      setEnabled(Boolean(patch.midiInputEnabled), { notify });
    }
    if (Object.prototype.hasOwnProperty.call(patch, "midiInputMuted")) {
      setMuted(Boolean(patch.midiInputMuted), { notify });
    }
    if (Object.prototype.hasOwnProperty.call(patch, "midiInputKeyAware")) {
      midiInputKeyAware = Boolean(patch.midiInputKeyAware);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "midiInputGrid")) {
      setGrid(patch.midiInputGrid);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "midiInputMacroEnabled")) {
      midiInputMacroEnabled = Boolean(patch.midiInputMacroEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "midiInputBeepEnabled")) {
      midiInputBeepEnabled = Boolean(patch.midiInputBeepEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "midiInputBeepVolume")) {
      midiInputBeepVolume = clampNumber(patch.midiInputBeepVolume, 0, 1, midiInputBeepVolume);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "midiInputBeepDuration")) {
      midiInputBeepDurationMs = clampNumber(patch.midiInputBeepDuration, 40, 400, midiInputBeepDurationMs);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "noteTypingPreviewEnabled")) {
      noteTypingPreviewEnabled = Boolean(patch.noteTypingPreviewEnabled);
      if (!noteTypingPreviewEnabled) noteTypingPreviewLastKey = "";
    }
    if (Object.prototype.hasOwnProperty.call(patch, "noteTypingPreviewVolume")) {
      noteTypingPreviewVolume = clampNumber(patch.noteTypingPreviewVolume, 0, 1, noteTypingPreviewVolume);
    }
    if (
      Object.prototype.hasOwnProperty.call(patch, "midiInputBeepVolume")
      && !Object.prototype.hasOwnProperty.call(patch, "noteTypingPreviewVolume")
    ) {
      noteTypingPreviewVolume = midiInputBeepVolume;
      patch.noteTypingPreviewVolume = noteTypingPreviewVolume;
    }
    if (
      Object.prototype.hasOwnProperty.call(patch, "noteTypingPreviewVolume")
      && !Object.prototype.hasOwnProperty.call(patch, "midiInputBeepVolume")
    ) {
      midiInputBeepVolume = noteTypingPreviewVolume;
      patch.midiInputBeepVolume = midiInputBeepVolume;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "noteTypingPreviewLengthMode")) {
      noteTypingPreviewLengthMode = String(patch.noteTypingPreviewLengthMode || "") === "base" ? "base" : "typed";
    }
    if (Object.prototype.hasOwnProperty.call(patch, "noteTypingPreviewTrigger")) {
      noteTypingPreviewTrigger = String(patch.noteTypingPreviewTrigger || "") === "note" ? "note" : "delimiter";
    }
    if (Object.prototype.hasOwnProperty.call(patch, "noteTypingPreviewEnvelope")) {
      noteTypingPreviewEnvelope = String(patch.noteTypingPreviewEnvelope || "") === "medium" ? "medium" : "short";
    }
    if (Object.prototype.hasOwnProperty.call(patch, "noteTypingPreviewRetriggerDuration")) {
      noteTypingPreviewRetriggerDuration = patch.noteTypingPreviewRetriggerDuration !== false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "noteTypingPreviewSkipMicrotones")) {
      noteTypingPreviewSkipMicrotones = Boolean(patch.noteTypingPreviewSkipMicrotones);
    }
    updateUi();
    if (persist) persistSettingsPatch(patch);
  }

  function applyMidiSettings(settings) {
    if (!settings || typeof settings !== "object") return;
    midiInputKeyAware = Boolean(settings.midiInputKeyAware);
    midiInputMacroEnabled = settings.midiInputMacroEnabled !== false;
    midiInputBeepEnabled = Boolean(settings.midiInputBeepEnabled);
    midiInputBeepVolume = clampNumber(settings.midiInputBeepVolume, 0, 1, midiInputBeepVolume);
    midiInputBeepDurationMs = clampNumber(settings.midiInputBeepDuration, 40, 400, midiInputBeepDurationMs);
    setGrid(settings.midiInputGrid);
    setEnabled(Boolean(settings.midiInputEnabled), { notify: false });
    setMuted(Boolean(settings.midiInputMuted), { notify: false });
    updateUi();
  }

  function applyNoteTypingPreviewSettings(settings) {
    if (!settings || typeof settings !== "object") return;
    noteTypingPreviewEnabled = Boolean(settings.noteTypingPreviewEnabled);
    noteTypingPreviewVolume = clampNumber(settings.noteTypingPreviewVolume, 0, 1, noteTypingPreviewVolume);
    midiInputBeepVolume = noteTypingPreviewVolume;
    noteTypingPreviewLengthMode = String(settings.noteTypingPreviewLengthMode || "") === "base" ? "base" : "typed";
    noteTypingPreviewTrigger = String(settings.noteTypingPreviewTrigger || "") === "note" ? "note" : "delimiter";
    noteTypingPreviewEnvelope = String(settings.noteTypingPreviewEnvelope || "") === "medium" ? "medium" : "short";
    noteTypingPreviewRetriggerDuration = settings.noteTypingPreviewRetriggerDuration !== false;
    noteTypingPreviewSkipMicrotones = settings.noteTypingPreviewSkipMicrotones !== false;
    if (!noteTypingPreviewEnabled) noteTypingPreviewLastKey = "";
    updateUi();
  }

  function toggleInputSetting() {
    const next = !midiInputEnabled;
    setEnabled(next, { notify: true });
    persistSettingsPatch({ midiInputEnabled: next });
    if (next) popoverController.open();
    if (midiInputBeepEnabled) unlockAudioContext();
  }

  function toggleMuteSetting() {
    const next = !midiInputMuted;
    setMuted(next, { notify: true });
    persistSettingsPatch({ midiInputMuted: next });
    popoverController.open();
  }

  async function init() {
    if (midiAccess || midiInitPromise) return midiInitPromise;
    if (!supportsMidiInput()) {
      if (!midiWarnedUnsupported) {
        midiWarnedUnsupported = true;
        try { showToast("MIDI input not supported in this environment.", 2400); } catch {}
      }
      return null;
    }
    const nav = navigatorRef();
    midiInitPromise = nav.requestMIDIAccess({ sysex: false })
      .then((access) => {
        midiAccess = access;
        midiInitPromise = null;
        refreshMidiInputs();
        try {
          midiAccess.onstatechange = () => refreshMidiInputs();
        } catch {}
        refreshCursorIfNeeded();
        return midiAccess;
      })
      .catch(() => {
        midiInitPromise = null;
        try { showToast("MIDI input failed to initialize.", 2400); } catch {}
        return null;
      });
    return midiInitPromise;
  }

  function exposeDebugApi() {
    const win = windowRef();
    if (!win || win.__abcarusMidiInput) return;
    win.__abcarusMidiInput = {
      enable: async () => {
        setEnabled(true, { notify: false });
        await init();
        return getStatus();
      },
      disable: () => {
        setEnabled(false, { notify: false });
        return getStatus();
      },
      toggle: async () => {
        setEnabled(!midiInputEnabled, { notify: false });
        if (midiInputEnabled) await init();
        return getStatus();
      },
      mute: () => {
        setMuted(true, { notify: false });
        return getStatus();
      },
      unmute: () => {
        setMuted(false, { notify: false });
        return getStatus();
      },
      toggleMute: () => {
        setMuted(!midiInputMuted, { notify: false });
        return getStatus();
      },
      setKeyAware: (value) => {
        midiInputKeyAware = Boolean(value);
        return getStatus();
      },
      setGrid: (value) => {
        setGrid(value);
        return getStatus();
      },
      setMacros: (value) => {
        midiInputMacroEnabled = Boolean(value);
        return getStatus();
      },
      status: () => getStatus(),
    };
  }

  return {
    applyMidiSettings,
    applyNoteTypingPreviewSettings,
    applySettingsPatch,
    closePopover: () => popoverController.close(),
    exposeDebugApi,
    getStatus,
    handleTypingPreviewChange,
    init,
    openPopover: () => popoverController.open(),
    toggleInputSetting,
    toggleMuteSetting,
    togglePopover: () => popoverController.toggle(),
    unlockAudioContext,
    updateUi,
  };
}

export {
  createMidiInputFeature,
};
