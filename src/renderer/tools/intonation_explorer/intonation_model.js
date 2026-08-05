import {
  NOTE_BASES,
  baseId53ForNaturalLetter,
  buildEffectiveKeyMicroMap53FromKBody,
  computeOctave,
  parseAccidentalPrefix53,
  parseNoteTokenAt53,
} from "../../transpose.mjs";

function modNumber(value, modulus) {
  if (!Number.isFinite(modulus) || modulus === 0) return 0;
  const num = Number(value) || 0;
  const mod = Number(modulus) || 1;
  const raw = num % mod;
  return raw < 0 ? raw + mod : raw;
}

function mod53(value) {
  return modNumber(value, 53);
}

const EURO_SEMITONE_COMMAS_UP_BY_PC12 = [4, 5, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4];

function formatAeuLabel(step) {
  return String(mod53(step));
}

function pickDominantSpelling(spellings) {
  const entries = spellings && typeof spellings.entries === "function" ? Array.from(spellings.entries()) : [];
  if (!entries.length) return "";
  entries.sort((a, b) => {
    const ac = Number(a[1]) || 0;
    const bc = Number(b[1]) || 0;
    if (bc !== ac) return bc - ac;
    const aKey = String(a[0] || "");
    const bKey = String(b[0] || "");
    if (aKey.length !== bKey.length) return aKey.length - bKey.length;
    return aKey.localeCompare(bKey);
  });
  return String(entries[0][0] || "");
}

function resolveTonalBaseInput(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return { ok: true, base: 0, label: "pc53=0" };
  }
  const lower = raw.toLowerCase();
  const pcMatch = lower.match(/^pc53=(\d{1,2})$/);
  if (pcMatch) {
    const num = Number(pcMatch[1]);
    if (Number.isFinite(num) && num >= 0 && num < 53) {
      return { ok: true, base: num, label: `pc53=${num}` };
    }
    return { ok: false, error: `Tonal base pc53=${pcMatch[1]} must be 0–52.` };
  }
  const numMatch = lower.match(/^(\d{1,2})$/);
  if (numMatch) {
    const num = Number(numMatch[1]);
    if (Number.isFinite(num) && num >= 0 && num < 53) {
      return { ok: true, base: num, label: `pc53=${num}` };
    }
    return { ok: false, error: `Tonal base ${numMatch[1]} must be 0–52.` };
  }
  const letterMatch = raw.match(/^([A-Ga-g])([#b])?$/);
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase();
    const accidental = letterMatch[2] || "";
    const basePc12 = NOTE_BASES[letter] != null ? NOTE_BASES[letter] : 0;
    let base = baseId53ForNaturalLetter(letter);
    if (accidental === "#") {
      base += EURO_SEMITONE_COMMAS_UP_BY_PC12[modNumber(basePc12, 12)] || 0;
    } else if (accidental === "b") {
      base -= EURO_SEMITONE_COMMAS_UP_BY_PC12[modNumber(basePc12 - 1, 12)] || 0;
    }
    base = mod53(base);
    return { ok: true, base, label: `${letter}${accidental} (pc53=${base})` };
  }
  return { ok: false, error: `Unable to parse tonal base (“${raw}”).` };
}

function buildIntonationRowsFromEntries(entries, baseStep, { sortMode = "count" } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const rows = list.map((entry) => ({
    step: entry.abs53,
    normalizedStep: mod53((entry.pc53 || 0) - baseStep),
    absStep: mod53(entry.pc53 || 0),
    abcSpelling: pickDominantSpelling(entry.spellings),
    count: entry.count,
    ranges: entry.ranges,
    firstStart: entry.firstStart,
    octave: entry.octave,
    letterUpper: entry.letterUpper,
    micro: entry.micro,
  }));
  rows.sort((a, b) => {
    if (sortMode === "first") {
      const aFirst = Number.isFinite(Number(a.firstStart)) ? Number(a.firstStart) : Number.POSITIVE_INFINITY;
      const bFirst = Number.isFinite(Number(b.firstStart)) ? Number(b.firstStart) : Number.POSITIVE_INFINITY;
      if (aFirst !== bFirst) return aFirst - bFirst;
      return a.step - b.step;
    }
    if (sortMode === "pitch") {
      const aAbs = Number(a.step);
      const bAbs = Number(b.step);
      if (aAbs !== bAbs) return aAbs - bAbs;
      const aKey = String(a.abcSpelling || "").toLowerCase();
      const bKey = String(b.abcSpelling || "").toLowerCase();
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return a.absStep - b.absStep;
    }
    if (sortMode === "rel") {
      if (a.normalizedStep !== b.normalizedStep) return a.normalizedStep - b.normalizedStep;
      return a.absStep - b.absStep;
    }
    if (sortMode === "abs") {
      if (a.absStep !== b.absStep) return a.absStep - b.absStep;
      return a.normalizedStep - b.normalizedStep;
    }
    if (sortMode === "abc") {
      const aKey = String(a.abcSpelling || "").toLowerCase();
      const bKey = String(b.abcSpelling || "").toLowerCase();
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return a.absStep - b.absStep;
    }
    if (b.count !== a.count) return b.count - a.count;
    return a.step - b.step;
  });
  return rows;
}

function pickAutoBaseStep(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return 0;
  const best = list.reduce((acc, entry) => {
    if (!acc) return entry;
    if ((entry.count || 0) > (acc.count || 0)) return entry;
    if ((entry.count || 0) === (acc.count || 0) && entry.abs53 < acc.abs53) return entry;
    return acc;
  }, null);
  return best ? mod53(best.abs53) : 0;
}

function parseTonalBaseFromK(tuneText) {
  const text = String(tuneText || "");
  const match = text.match(/(?:^|\n)K:\s*([^\r\n]+)/i);
  if (!match) return { ok: false, error: "No K: line found in the active tune." };
  const value = String(match[1] || "").trim();
  if (!value) return { ok: false, error: "Empty K: line in the active tune." };
  const token = value.split(/\s+/)[0] || value;
  const keyMatch = token.match(/^([A-Ga-g])([#b])?/);
  if (!keyMatch) return { ok: false, error: `Unable to parse K: (“${token}”).` };
  const letter = keyMatch[1].toUpperCase();
  const acc = keyMatch[2] || "";
  return resolveTonalBaseInput(`${letter}${acc}`);
}

function parseLengthString(lenStr) {
  if (!lenStr) return { num: 1, den: 1 };
  if (/^\/+$/.test(lenStr)) {
    return { num: 1, den: 2 ** lenStr.length };
  }
  if (/^\d+$/.test(lenStr)) {
    return { num: Number(lenStr), den: 1 };
  }
  const slashOnly = lenStr.match(/^(\d+)(\/+)$/);
  if (slashOnly) {
    const num = Number(slashOnly[1]);
    const den = 2 ** slashOnly[2].length;
    return { num, den };
  }
  const ratio = lenStr.match(/^(\d+)\/(\d+)$/);
  if (ratio) {
    return { num: Number(ratio[1]), den: Number(ratio[2]) };
  }
  const denomOnly = lenStr.match(/^\/(\d+)$/);
  if (denomOnly) {
    return { num: 1, den: Number(denomOnly[1]) };
  }
  const trailingSlash = lenStr.match(/^(\d+)\/$/);
  if (trailingSlash) {
    return { num: Number(trailingSlash[1]), den: 2 };
  }
  return null;
}

function noteDurationWeightFromToken(durationToken) {
  try {
    const parsed = parseLengthString(String(durationToken || ""));
    if (!parsed) return 1;
    const num = Number(parsed.num);
    const den = Number(parsed.den);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 1;
    return Math.max(0.0625, num / den);
  } catch {
    return 1;
  }
}

function scanIntonationEntries(snapshot, {
  activeTune = null,
  skipGraceNotes = true,
  scope = null,
  perfEnabled = false,
  nowMs = () => 0,
  logPerf = () => {},
} = {}) {
  if (!snapshot || !snapshot.text) return { tune: null, entries: [], error: "Unable to read the active tune." };
  const perfOn = Boolean(perfEnabled);
  const t0 = perfOn ? nowMs() : 0;
  const tune = activeTune;
  if (!tune) return { tune: null, entries: [], error: "No active tune snapshot available." };
  const fullText = String(snapshot.text || "");
  const body = fullText.slice(tune.start, tune.end);
  const scopeStart = scope && Number.isFinite(Number(scope.start))
    ? Math.max(0, Math.min(body.length, Number(scope.start)))
    : 0;
  const scopeEnd = scope && Number.isFinite(Number(scope.end))
    ? Math.max(scopeStart, Math.min(body.length, Number(scope.end)))
    : body.length;
  const activeScope = scopeEnd > scopeStart && (scopeStart > 0 || scopeEnd < body.length)
    ? { type: "selection", label: "Selection", start: scopeStart, end: scopeEnd }
    : { type: "tune", label: "Tune", start: 0, end: body.length };

  let is53 = false;
  try {
    is53 = /%%\s*MIDI\s+temperamentequal\s+53\b/i.test(body) || /%%\s*MIDI\s+temperamentequal\s+53\b/i.test(fullText);
  } catch { is53 = false; }

  const formatEffectiveAccPrefix53 = (letterPc12, micro) => {
    const m = Number(micro) || 0;
    if (m === 0) return "";
    return m > 0 ? `^${m}` : `_${-m}`;
  };

  let scanStart = 0;
  let kLineBody = "";
  try {
    const re = /(?:^|\n)K:([^\r\n]*)(?:\r?\n)?/i;
    const m = re.exec(body);
    if (m) {
      kLineBody = String(m[1] || "");
      scanStart = Math.max(0, Math.min(body.length, m.index + m[0].length));
    }
  } catch {}

  let keyMicroMap = {};
  try {
    keyMicroMap = buildEffectiveKeyMicroMap53FromKBody(kLineBody, { allowMicro: is53 });
  } catch {
    keyMicroMap = {};
  }

  const seen = new Map();
  const noteEvents = [];
  let lastNoteEvent = null;
  let idx = Math.max(scanStart, activeScope.start);
  const scanEnd = Math.max(idx, Math.min(body.length, activeScope.end));
  let inTextBlock = false;
  let graceDepth = 0;
  let barAccidentals = new Map();
  let perfParseAttempts = 0;
  let perfParsedNotes = 0;
  let perfSkippedFast = 0;
  while (idx < scanEnd) {
    if (!inTextBlock) {
      const prev = idx > 0 ? body[idx - 1] : "";
      const lineStart = idx === 0 || prev === "\n" || prev === "\r";
      if (lineStart) {
        let j = idx;
        while (j < body.length && (body[j] === " " || body[j] === "\t")) j += 1;
        if (body.startsWith("%%begintext", j)) {
          inTextBlock = true;
          idx = j + "%%begintext".length;
          continue;
        }
      }
    } else {
      const prev = idx > 0 ? body[idx - 1] : "";
      const lineStart = idx === 0 || prev === "\n" || prev === "\r";
      if (lineStart) {
        let j = idx;
        while (j < body.length && (body[j] === " " || body[j] === "\t")) j += 1;
        if (body.startsWith("%%endtext", j)) {
          inTextBlock = false;
          idx = j + "%%endtext".length;
          continue;
        }
      }
      idx += 1;
      continue;
    }

    if (body[idx] === "%" && !(idx + 1 < body.length && body[idx + 1] === "%")) {
      const nextNl = body.indexOf("\n", idx + 1);
      const nextCr = body.indexOf("\r", idx + 1);
      const next = (nextNl >= 0 && nextCr >= 0) ? Math.min(nextNl, nextCr) : (nextNl >= 0 ? nextNl : nextCr);
      idx = next >= 0 ? Math.min(next + 1, scanEnd) : scanEnd;
      continue;
    }

    if (body[idx] === "$") {
      if (lastNoteEvent) lastNoteEvent.phraseEnd = true;
      idx += 1;
      continue;
    }

    {
      const prev = idx > 0 ? body[idx - 1] : "";
      const lineStart = idx === 0 || prev === "\n" || prev === "\r";
      if (lineStart) {
        let j = idx;
        while (j < body.length && (body[j] === " " || body[j] === "\t")) j += 1;
        if (body[j] === "%" && j + 1 < body.length && body[j + 1] === "%") {
          const nextNl = body.indexOf("\n", j + 2);
          const nextCr = body.indexOf("\r", j + 2);
          const next = (nextNl >= 0 && nextCr >= 0) ? Math.min(nextNl, nextCr) : (nextNl >= 0 ? nextNl : nextCr);
          idx = next >= 0 ? Math.min(next + 1, scanEnd) : scanEnd;
          continue;
        }
      }
    }

    if (body[idx] === "[" && idx + 2 < body.length && /[A-Za-z]/.test(body[idx + 1]) && body[idx + 2] === ":") {
      const close = body.indexOf("]", idx + 3);
      if (close >= 0) {
        const tag = String(body[idx + 1] || "").toUpperCase();
        if (tag === "K") {
          try {
            const tokenPart = body.slice(idx + 3, close);
            keyMicroMap = buildEffectiveKeyMicroMap53FromKBody(tokenPart, { allowMicro: is53 });
            barAccidentals = new Map();
          } catch {}
        }
        idx = close + 1;
        continue;
      }
    }

    {
      const prev = idx > 0 ? body[idx - 1] : "";
      const lineStart = idx === 0 || prev === "\n" || prev === "\r";
      if (lineStart) {
        let j = idx;
        while (j < body.length && (body[j] === " " || body[j] === "\t")) j += 1;
        if (j + 1 < body.length && /[A-Za-z]/.test(body[j]) && body[j + 1] === ":") {
          const tag = String(body[j] || "").toUpperCase();
          const nextNl = body.indexOf("\n", j + 2);
          const nextCr = body.indexOf("\r", j + 2);
          const next = (nextNl >= 0 && nextCr >= 0) ? Math.min(nextNl, nextCr) : (nextNl >= 0 ? nextNl : nextCr);
          if (tag === "K") {
            try {
              const lineEnd = next >= 0 ? next : body.length;
              const tokenPart = body.slice(j + 2, lineEnd);
              keyMicroMap = buildEffectiveKeyMicroMap53FromKBody(tokenPart, { allowMicro: is53 });
              barAccidentals = new Map();
            } catch {}
          }
          idx = next >= 0 ? Math.min(next + 1, scanEnd) : scanEnd;
          continue;
        }
      }
    }

    if (body[idx] === "\"") {
      const next = body.indexOf("\"", idx + 1);
      if (next >= 0) {
        idx = next + 1;
        continue;
      }
    }

    if (skipGraceNotes) {
      const ch = body[idx];
      if (ch === "{") {
        graceDepth += 1;
        idx += 1;
        continue;
      }
      if (ch === "}") {
        graceDepth = Math.max(0, graceDepth - 1);
        idx += 1;
        continue;
      }
      if (graceDepth > 0) {
        idx += 1;
        continue;
      }
    }

    if (body[idx] === "|") {
      if (lastNoteEvent) lastNoteEvent.phraseEnd = true;
      barAccidentals = new Map();
      idx += 1;
      continue;
    }

    {
      const ch = body[idx];
      const couldStart =
        ch === "^"
        || ch === "_"
        || ch === "="
        || (ch >= "A" && ch <= "G")
        || (ch >= "a" && ch <= "g");
      if (!couldStart) {
        if (perfOn) perfSkippedFast += 1;
        idx += 1;
        continue;
      }
    }

    if (perfOn) perfParseAttempts += 1;
    const note = parseNoteTokenAt53(body, idx);
    if (!note) {
      idx += 1;
      continue;
    }
    if (perfOn) perfParsedNotes += 1;
    const letter = note.letter ? note.letter.toUpperCase() : "";
    if (!letter) {
      idx = note.end;
      continue;
    }
    const letterPc = NOTE_BASES[letter] != null ? NOTE_BASES[letter] : 0;
    const baseId = baseId53ForNaturalLetter(letter);
    const accidental = parseAccidentalPrefix53(note.accPrefix, letterPc);
    const octave = computeOctave(note.letter, note.octaveMarks);
    const barKey = `${letter}:${octave}`;
    let appliedMicro = 0;
    if (accidental && accidental.explicit) {
      appliedMicro = Number.isFinite(accidental.micro) ? accidental.micro : 0;
      barAccidentals.set(barKey, appliedMicro);
    } else if (barAccidentals.has(barKey)) {
      appliedMicro = barAccidentals.get(barKey);
    } else {
      const keyMicro = keyMicroMap && Object.prototype.hasOwnProperty.call(keyMicroMap, letter)
        ? keyMicroMap[letter]
        : 0;
      appliedMicro = Number.isFinite(keyMicro) ? keyMicro : 0;
    }
    const abs53 = octave * 53 + baseId + appliedMicro;
    const pc53 = mod53(abs53);
    const entryKey = String(abs53);
    const entry = seen.get(entryKey) || {
      abs53,
      pc53,
      octave,
      letterUpper: letter,
      micro: appliedMicro,
      count: 0,
      ranges: [],
      firstStart: null,
      spellings: new Map(),
    };
    entry.count += 1;
    if (entry.firstStart == null || note.start < entry.firstStart) entry.firstStart = note.start;
    try {
      const effectivePrefix = formatEffectiveAccPrefix53(letterPc, appliedMicro);
      const spelling = `${effectivePrefix}${String(note.letter || "")}${String(note.octaveMarks || "")}`;
      if (spelling) entry.spellings.set(spelling, (Number(entry.spellings.get(spelling)) || 0) + 1);
      const noteEvent = {
        abs53,
        pc53,
        octave,
        letterUpper: letter,
        micro: appliedMicro,
        spelling,
        durationWeight: noteDurationWeightFromToken(note.duration),
        phraseEnd: false,
        start: note.start,
        end: note.end,
      };
      noteEvents.push(noteEvent);
      lastNoteEvent = noteEvent;
    } catch {}
    entry.ranges.push({
      start: note.start,
      end: note.end,
    });
    seen.set(entryKey, entry);
    idx = Math.max(idx + 1, note.end);
  }
  const entries = Array.from(seen.values());
  if (perfOn) {
    logPerf("scan.loop", {
      ms: Math.round(nowMs() - t0),
      chars: body.length,
      parseAttempts: perfParseAttempts,
      parsedNotes: perfParsedNotes,
      skippedFast: perfSkippedFast,
      entries: entries.length,
      events: noteEvents.length,
    });
  }
  return {
    tune,
    scope: activeScope,
    entries,
    noteEvents,
    is53,
    error: entries.length ? null : "No musical notes found in the tune.",
  };
}

function buildPitchSetText(noteEvents) {
  const events = Array.isArray(noteEvents) ? noteEvents : [];
  const pitchSetPc53 = Array.from(new Set(events.map((e) => mod53(e && e.pc53 ? e.pc53 : 0))))
    .sort((a, b) => a - b)
    .map((n) => formatAeuLabel(n));
  return pitchSetPc53.length ? `pitchSetPc53=[${pitchSetPc53.join(", ")}]` : "";
}

function buildSeyirSnapshotText({
  tuneText,
  rows,
  noteEvents,
  baseStep,
  baseLabel,
  is53,
  scopeLabel,
  formatPerdeName = () => "",
} = {}) {
  const events = Array.isArray(noteEvents) ? noteEvents : [];
  const list = Array.isArray(rows) ? rows : [];
  const text = String(tuneText || "");

  const mX = text.match(/(?:^|\n)X:\s*([^\r\n]+)/);
  const mT = text.match(/(?:^|\n)T:\s*([^\r\n]+)/);
  const mK = text.match(/(?:^|\n)K:\s*([^\r\n]+)/i);
  const meta = {
    x: mX ? String(mX[1] || "").trim() : "",
    title: mT ? String(mT[1] || "").trim() : "",
    key: mK ? String(mK[1] || "").trim() : "",
  };

  const pitchSetPc53 = Array.from(new Set(events.map((e) => mod53(e.pc53 || 0))))
    .sort((a, b) => a - b)
    .map((n) => formatAeuLabel(n));

  const compressed = [];
  for (const e of events) {
    const last = compressed.length ? compressed[compressed.length - 1] : null;
    if (last && String(last.abs53) === String(e.abs53)) continue;
    compressed.push(e);
  }

  const relTrace = compressed.map((e) => formatAeuLabel(mod53((e.pc53 || 0) - (baseStep || 0))));
  const absTrace = compressed.map((e) => formatAeuLabel(mod53(e.pc53 || 0)));

  const start = compressed.length ? compressed[0] : null;
  const end = compressed.length ? compressed[compressed.length - 1] : null;
  const absVals = compressed.map((e) => Number(e.abs53)).filter((n) => Number.isFinite(n));
  const minAbs = absVals.length ? Math.min(...absVals) : null;
  const maxAbs = absVals.length ? Math.max(...absVals) : null;

  const turning = [];
  for (let i = 1; i + 1 < compressed.length; i += 1) {
    const a = Number(compressed[i - 1].abs53);
    const b = Number(compressed[i].abs53);
    const c = Number(compressed[i + 1].abs53);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) continue;
    if (b > a && b > c) turning.push({ kind: "peak", idx: i, e: compressed[i] });
    else if (b < a && b < c) turning.push({ kind: "trough", idx: i, e: compressed[i] });
  }

  const anchors = list
    .slice()
    .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
    .slice(0, 12)
    .map((row) => {
      const perde = formatPerdeName(row, { is53 });
      const perdePart = is53 ? `; perde=${perde || "??"}` : "";
      return `- ${row.abcSpelling || ""} (pc53=${formatAeuLabel(row.absStep)}) count=${row.count || 0}${perdePart}`;
    });

  const turningLines = turning.slice(0, 12).map((tp) => {
    const e = tp.e || {};
    const label = e.spelling || "";
    const pc = formatAeuLabel(mod53(e.pc53 || 0));
    return `- ${tp.kind} #${tp.idx}: ${label} (pc53=${pc})`;
  });

  return [
    "[ABCarus] Intonation DNA (read-only)",
    meta.x || meta.title ? `X:${meta.x || "?"}  T:${meta.title || "?"}` : "",
    meta.key ? `K:${meta.key}` : "",
    scopeLabel ? `scope=${String(scopeLabel)}` : "",
    `mode=${is53 ? "EDO-53" : "EDO-12"} base=${String(baseLabel || "")}`,
    `events=${events.length} compressed=${compressed.length}`,
    (minAbs != null && maxAbs != null) ? `range(abs53)=${maxAbs - minAbs} (min=${minAbs}, max=${maxAbs})` : "",
    start ? `start=${start.spelling || ""} (pc53=${formatAeuLabel(mod53(start.pc53 || 0))})` : "",
    end ? `end=${end.spelling || ""} (pc53=${formatAeuLabel(mod53(end.pc53 || 0))})` : "",
    `pitchSetPc53=[${pitchSetPc53.join(", ")}]`,
    "",
    "Top anchors:",
    ...(anchors.length ? anchors : ["- (none)"]),
    "",
    "Turning points (first 12):",
    ...(turningLines.length ? turningLines : ["- (none)"]),
    "",
    `Trace rel(base) (first 80): ${relTrace.slice(0, 80).join(" ")}`,
    `Trace abs(pc53) (first 80): ${absTrace.slice(0, 80).join(" ")}`,
  ]
    .filter((s) => String(s || "").trim() !== "")
    .join("\n");
}

export {
  buildIntonationRowsFromEntries,
  buildPitchSetText,
  buildSeyirSnapshotText,
  formatAeuLabel,
  mod53,
  modNumber,
  parseTonalBaseFromK,
  pickAutoBaseStep,
  pickDominantSpelling,
  resolveTonalBaseInput,
  scanIntonationEntries,
};
