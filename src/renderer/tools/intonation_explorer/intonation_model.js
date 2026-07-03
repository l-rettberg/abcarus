import { NOTE_BASES } from "../../transpose.mjs";

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
    const basePc = (NOTE_BASES[letter] != null ? NOTE_BASES[letter] : 0)
      + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
    const normalizedPc = modNumber(basePc, 12);
    const approx = Math.round((normalizedPc * 53) / 12);
    const base = mod53(approx);
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

export {
  buildIntonationRowsFromEntries,
  formatAeuLabel,
  mod53,
  modNumber,
  parseTonalBaseFromK,
  pickAutoBaseStep,
  pickDominantSpelling,
  resolveTonalBaseInput,
};
