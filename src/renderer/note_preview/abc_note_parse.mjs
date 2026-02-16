const DEFAULT_BASE_LENGTH = 1 / 8;
const DEFAULT_QPM = 120;

const MAJOR_KEY_ALTER = new Map([
  ["C", 0],
  ["G", 1],
  ["D", 2],
  ["A", 3],
  ["E", 4],
  ["B", 5],
  ["F#", 6],
  ["C#", 7],
  ["F", -1],
  ["Bb", -2],
  ["Eb", -3],
  ["Ab", -4],
  ["Db", -5],
  ["Gb", -6],
  ["Cb", -7],
]);

const MINOR_KEY_ALTER = new Map([
  ["A", 0],
  ["E", 1],
  ["B", 2],
  ["F#", 3],
  ["C#", 4],
  ["G#", 5],
  ["D#", 6],
  ["A#", 7],
  ["D", -1],
  ["G", -2],
  ["C", -3],
  ["F", -4],
  ["Bb", -5],
  ["Eb", -6],
  ["Ab", -7],
]);

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
const NOTE_TOKEN_CHARS = /^[\^_=A-Ga-g',0-9/]+$/;
const NOTE_BASE_MIDI = {
  C: 60,
  D: 62,
  E: 64,
  F: 65,
  G: 67,
  A: 69,
  B: 71,
};
const INLINE_FIELD_RE = /\[\s*[A-Za-z][A-Za-z0-9_-]*\s*:[^\]]*\]/g;

function parseFraction(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

function parseTempoQpm(body) {
  const text = String(body || "").trim();
  if (!text) return DEFAULT_QPM;
  const eq = text.match(/=\s*([0-9]+(?:\.[0-9]+)?)/);
  if (eq) {
    const val = Number(eq[1]);
    if (Number.isFinite(val) && val > 0) return val;
  }
  const firstNum = text.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (firstNum) {
    const val = Number(firstNum[1]);
    if (Number.isFinite(val) && val > 0) return val;
  }
  return DEFAULT_QPM;
}

function keyAccidentalMap(keyBody) {
  const body = String(keyBody || "").trim();
  const map = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 };
  if (!body) return map;
  const token = (body.split(/\s+/)[0] || "").replace(/♭/g, "b").replace(/♯/g, "#");
  const m = token.match(/^([A-Ga-g])([#b]?)(m?)/);
  if (!m) return map;
  const tonic = m[1].toUpperCase() + (m[2] || "");
  const isMinor = (m[3] || "") === "m";
  const alter = (isMinor ? MINOR_KEY_ALTER : MAJOR_KEY_ALTER).get(tonic);
  if (!Number.isFinite(alter) || alter === 0) return map;
  if (alter > 0) {
    for (let i = 0; i < alter; i += 1) map[SHARP_ORDER[i]] = 1;
  } else {
    for (let i = 0; i < Math.abs(alter); i += 1) map[FLAT_ORDER[i]] = -1;
  }
  return map;
}

function parseLengthMultiplier(suffix) {
  const raw = String(suffix || "");
  if (!raw) return 1;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (/^\/+$/.test(raw)) return 1 / Math.pow(2, raw.length);
  let m = raw.match(/^(\d+)\/$/);
  if (m) return Number(m[1]) / 2;
  m = raw.match(/^\/(\d+)$/);
  if (m) return 1 / Number(m[1]);
  m = raw.match(/^(\d+)\/(\d+)$/);
  if (m) {
    const num = Number(m[1]);
    const den = Number(m[2]);
    if (den === 0) return null;
    return num / den;
  }
  return null;
}

function parseAccidental(prefix, { skipMicrotones = true } = {}) {
  const raw = String(prefix || "");
  if (!raw) return { semitone: null, ok: true };
  if (!/^[\^_=]+$/.test(raw)) return { semitone: null, ok: !skipMicrotones };
  const hasNatural = raw.includes("=");
  const sharps = (raw.match(/\^/g) || []).length;
  const flats = (raw.match(/_/g) || []).length;
  if (hasNatural && (sharps || flats)) return { semitone: null, ok: false };
  if (sharps && flats) return { semitone: null, ok: false };
  if (hasNatural) return { semitone: 0, ok: true };
  if (sharps) return { semitone: sharps, ok: true };
  if (flats) return { semitone: -flats, ok: true };
  return { semitone: null, ok: true };
}

function isNoteToken(text) {
  const raw = String(text || "");
  return Boolean(raw && NOTE_TOKEN_CHARS.test(raw));
}

export function isRangeInsideInlineField(lineText, fromRel, toRel) {
  const text = String(lineText || "");
  const from = Math.max(0, Number.isFinite(Number(fromRel)) ? Number(fromRel) : 0);
  const to = Math.max(from, Number.isFinite(Number(toRel)) ? Number(toRel) : from);
  INLINE_FIELD_RE.lastIndex = 0;
  let m = null;
  while ((m = INLINE_FIELD_RE.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (from < end && to > start) return true;
  }
  return false;
}

export function parseHeadersNear(doc, pos) {
  if (!doc || !Number.isFinite(Number(pos))) {
    return {
      keyMap: keyAccidentalMap(""),
      baseLength: DEFAULT_BASE_LENGTH,
      qpm: DEFAULT_QPM,
    };
  }
  let keyBody = "";
  let baseLength = DEFAULT_BASE_LENGTH;
  let qpm = DEFAULT_QPM;
  let haveK = false;
  let haveL = false;
  let haveQ = false;
  const lineStart = doc.lineAt(Math.max(0, Math.min(doc.length, Number(pos)))).number;
  for (let lineNo = lineStart; lineNo >= 1; lineNo -= 1) {
    const line = String(doc.line(lineNo).text || "").trim();
    if (!line) continue;
    if (!haveK) {
      const m = line.match(/^K:\s*(.*)$/i);
      if (m) {
        keyBody = m[1] || "";
        haveK = true;
      }
    }
    if (!haveL) {
      const m = line.match(/^L:\s*(.*)$/i);
      if (m) {
        const frac = parseFraction(m[1]);
        if (Number.isFinite(frac) && frac > 0) baseLength = frac;
        haveL = true;
      }
    }
    if (!haveQ) {
      const m = line.match(/^Q:\s*(.*)$/i);
      if (m) {
        qpm = parseTempoQpm(m[1]);
        haveQ = true;
      }
    }
    if (/^X:/i.test(line) && (haveK || haveL || haveQ)) break;
  }
  return { keyMap: keyAccidentalMap(keyBody), baseLength, qpm };
}

export function findCompletedNoteTokenBeforePosition(doc, pos) {
  if (!doc || !Number.isFinite(Number(pos))) return null;
  const p = Math.max(0, Math.min(doc.length, Number(pos)));
  const line = doc.lineAt(p);
  const rel = p - line.from;
  let end = rel - 1;
  if (end < 0) return null;
  const text = String(line.text || "");
  if (!isNoteToken(text[end])) return null;
  let start = end;
  while (start > 0 && isNoteToken(text[start - 1])) start -= 1;
  const token = text.slice(start, end + 1);
  if (!token || !isNoteToken(token)) return null;
  return {
    token,
    from: line.from + start,
    to: line.from + end + 1,
  };
}

export function parseAbcNoteToken(token, context, opts = {}) {
  const raw = String(token || "");
  if (!raw || !isNoteToken(raw)) return null;
  const m = raw.match(/^([\^_=]*)([A-Ga-g])([',]*)([0-9/]+)?$/);
  if (!m) return null;
  const accidentalPrefix = m[1] || "";
  const letterRaw = m[2];
  const octaveMarks = m[3] || "";
  const durationSuffix = m[4] || "";
  const lengthMode = opts.lengthMode === "base" ? "base" : "typed";
  const skipMicrotones = opts.skipMicrotones !== false;

  const accidental = parseAccidental(accidentalPrefix, { skipMicrotones });
  if (!accidental.ok) return null;

  const letter = letterRaw.toUpperCase();
  let midi = NOTE_BASE_MIDI[letter];
  if (!Number.isFinite(midi)) return null;
  if (letterRaw === letterRaw.toLowerCase()) midi += 12;
  for (const ch of octaveMarks) {
    if (ch === "'") midi += 12;
    else if (ch === ",") midi -= 12;
  }

  const keyMap = (context && context.keyMap) || { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 };
  const implied = Object.prototype.hasOwnProperty.call(keyMap, letter) ? Number(keyMap[letter]) : 0;
  midi += Number.isFinite(accidental.semitone) ? accidental.semitone : implied;

  const multiplier = parseLengthMultiplier(durationSuffix);
  if (multiplier == null) return null;
  const baseLength = Number.isFinite(Number(context && context.baseLength)) && Number(context.baseLength) > 0
    ? Number(context.baseLength)
    : DEFAULT_BASE_LENGTH;
  const qpm = Number.isFinite(Number(context && context.qpm)) && Number(context.qpm) > 0
    ? Number(context.qpm)
    : DEFAULT_QPM;

  const noteLength = lengthMode === "base" ? baseLength : (baseLength * multiplier);
  const seconds = Math.max(0.06, Math.min(2.5, noteLength * 4 * (60 / qpm)));
  return {
    midi,
    seconds,
    durationMs: Math.round(seconds * 1000),
  };
}
