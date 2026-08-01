function mod53(value) {
  const num = Number(value) || 0;
  const raw = num % 53;
  return raw < 0 ? raw + 53 : raw;
}

function normalizePerdeKey(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const base = raw
    .split("(")[0]
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");
  const map = {
    "ç": "c",
    "ğ": "g",
    "ı": "i",
    "ş": "s",
    "ö": "o",
    "ü": "u",
    "â": "a",
    "î": "i",
    "û": "u",
  };
  return base
    .split("")
    .map((ch) => (map[ch] ? map[ch] : ch))
    .join("")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function parseMakamDnaPerdeField(fieldText) {
  const raw = String(fieldText || "");
  const name = raw.split("(")[0].trim();
  const lower = raw.toLowerCase();
  const hint = lower.includes("low") ? "low" : (lower.includes("high") ? "high" : "");
  return { name, hint };
}

function createPerdeService() {
  let perdeApisPromise = null;
  let resolvePerdeNameFn = null;
  let resolvePerdeNamesFromAbcTokenFn = null;
  let perdeNameIndex = null;

  async function ensureApisLoaded() {
    if (resolvePerdeNameFn && resolvePerdeNamesFromAbcTokenFn) return;
    if (!perdeApisPromise) {
      perdeApisPromise = Promise.all([
        import("../perde53.mjs").catch(() => null),
        import("../perde_by_abc.mjs").catch(() => null),
      ]).then(([perde53, perdeByAbc]) => {
        resolvePerdeNameFn = perde53 && typeof perde53.resolvePerdeName === "function" ? perde53.resolvePerdeName : null;
        resolvePerdeNamesFromAbcTokenFn = perdeByAbc && typeof perdeByAbc.resolvePerdeNamesFromAbcToken === "function"
          ? perdeByAbc.resolvePerdeNamesFromAbcToken
          : null;
      });
    }
    await perdeApisPromise;
  }

  function resolveName(args) {
    try { return resolvePerdeNameFn ? (resolvePerdeNameFn(args) || "") : ""; } catch { return ""; }
  }

  function resolveNamesFromAbcToken(token) {
    try { return resolvePerdeNamesFromAbcTokenFn ? (resolvePerdeNamesFromAbcTokenFn(token) || []) : []; } catch { return []; }
  }

  async function ensureNameIndexLoaded() {
    if (perdeNameIndex) return;
    await ensureApisLoaded();
    if (!resolvePerdeNameFn) {
      perdeNameIndex = new Map();
      return;
    }
    const idx = new Map();
    for (let octave = 4; octave <= 8; octave += 1) {
      for (let pc53 = 0; pc53 < 53; pc53 += 1) {
        const name = resolveName({ pc53, octave });
        if (!name) continue;
        const key = normalizePerdeKey(name);
        if (!key) continue;
        const abs53 = octave * 53 + pc53;
        if (!idx.has(key)) idx.set(key, []);
        idx.get(key).push({ pc53, octave, abs53, name });
      }
    }
    perdeNameIndex = idx;
  }

  function resolvePc53Candidates(perdeName) {
    const key = normalizePerdeKey(perdeName);
    const candidates = key && perdeNameIndex ? (perdeNameIndex.get(key) || []) : [];
    return Array.from(new Set(candidates.map((cand) => mod53(cand.pc53)).filter((pc) => Number.isFinite(pc))));
  }

  function pickOverlayAbs53(perdeName, { hint, observedMinAbs, observedMaxAbs } = {}) {
    const key = normalizePerdeKey(perdeName);
    const candidates = key && perdeNameIndex ? (perdeNameIndex.get(key) || []) : [];
    if (!candidates.length) return null;
    const mid = (Number.isFinite(observedMinAbs) && Number.isFinite(observedMaxAbs))
      ? (observedMinAbs + observedMaxAbs) / 2
      : null;
    const prefer = (cand) => {
      if (!hint) return 0;
      if (hint === "low") return cand.octave <= 5 ? 0 : 1;
      if (hint === "high") return cand.octave >= 7 ? 0 : 1;
      return cand.octave === 6 ? 0 : 1;
    };
    let best = null;
    for (const cand of candidates) {
      const inRangePenalty = (Number.isFinite(observedMinAbs) && Number.isFinite(observedMaxAbs))
        ? ((cand.abs53 < observedMinAbs - 26 || cand.abs53 > observedMaxAbs + 26) ? 1 : 0)
        : 0;
      const dist = mid != null ? Math.abs(cand.abs53 - mid) : 0;
      const score = [prefer(cand), inRangePenalty, dist];
      if (!best) best = { cand, score };
      else {
        for (let i = 0; i < score.length; i += 1) {
          if (score[i] < best.score[i]) { best = { cand, score }; break; }
          if (score[i] > best.score[i]) break;
        }
      }
    }
    return best ? best.cand.abs53 : null;
  }

  return {
    ensureApisLoaded,
    ensureNameIndexLoaded,
    parseMakamDnaPerdeField,
    pickOverlayAbs53,
    resolveName,
    resolveNamesFromAbcToken,
    resolvePc53Candidates,
  };
}

export {
  createPerdeService,
  normalizePerdeKey,
  parseMakamDnaPerdeField,
};
