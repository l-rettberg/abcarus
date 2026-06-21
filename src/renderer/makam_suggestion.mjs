import { BUILTIN_MAKAM_K_SIGNATURES } from "./makam_dna/makam_k_signatures.mjs";

function mod53(value) {
  const raw = (Number(value) || 0) % 53;
  return raw < 0 ? raw + 53 : raw;
}

function normalizeName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
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
  return raw
    .toLowerCase()
    .replace(/[’']/g, "")
    .split("")
    .map((ch) => (map[ch] ? map[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MAKAM_NAME_ALIASES = Object.freeze({
  nihavent: Object.freeze(["nihavend"]),
  nihavend: Object.freeze(["nihavent"]),
});

const DEFAULT_RECOGNITION_MAKAMS = Object.freeze([
  "acemasiran",
  "acemkurdi",
  "bestenigar",
  "beyati",
  "hicaz",
  "hicazkar",
  "huseyni",
  "huzzam",
  "karcigar",
  "kurdilihicazkar",
  "mahur",
  "muhayyer",
  "neva",
  "nihavent",
  "rast",
  "saba",
  "segah",
  "sultaniyegah",
  "suzinak",
  "ussak",
]);

const DEFAULT_RECOGNITION_MAKAM_KEYS = new Set(DEFAULT_RECOGNITION_MAKAMS.flatMap((name) => [normalizeName(name), ...(MAKAM_NAME_ALIASES[normalizeName(name)] || [])]));

function makamSearchKeys(name) {
  const key = normalizeName(name);
  if (!key) return [];
  const aliases = MAKAM_NAME_ALIASES[key] || [];
  return Array.from(new Set([key, ...aliases.map((alias) => normalizeName(alias)).filter(Boolean)]));
}

function normalizeKSignature(value) {
  return String(value || "")
    .trim()
    .replace(/^K:\s*/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function extractFirstKSignature(tuneText) {
  const match = String(tuneText || "").match(/(?:^|\n)K:\s*([^\r\n]+)/i);
  return match ? normalizeKSignature(match[1]) : "";
}

function splitRoleNames(fieldText) {
  return String(fieldText || "")
    .split(",")
    .map((part) => part.split("(")[0].trim())
    .filter(Boolean);
}

function sumWeightsForPcs(pcWeights, pcs) {
  const list = Array.isArray(pcs) ? pcs : [];
  let sum = 0;
  for (const pc of list) sum += Number(pcWeights.get(String(mod53(pc)))) || 0;
  return Math.min(1, sum);
}

function signedPcDistance(fromPc, toPc) {
  let d = mod53(toPc - fromPc);
  if (d > 26) d -= 53;
  return d;
}

function nearestAnchorDistance(pc, anchors) {
  const list = Array.isArray(anchors) ? anchors : [];
  if (!list.length) return null;
  let best = null;
  for (const anchor of list) {
    const d = Math.abs(signedPcDistance(anchor, pc));
    if (best == null || d < best) best = d;
  }
  return best;
}

function anchorWeightForEvents(events, anchors, { maxDistance = 2, phraseEndOnly = false } = {}) {
  const list = Array.isArray(events) ? events : [];
  let total = 0;
  let hit = 0;
  for (const ev of list) {
    if (!ev) continue;
    if (phraseEndOnly && !ev.phraseEnd) continue;
    const w = Math.max(0.0625, Number(ev.durationWeight) || 1);
    total += w;
    const d = nearestAnchorDistance(mod53(ev.pc53), anchors);
    if (d != null && d <= maxDistance) hit += w;
  }
  return total > 0 ? Math.min(1, hit / total) : 0;
}

function shiftedPcs(pcs, shift) {
  return (Array.isArray(pcs) ? pcs : []).map((pc) => mod53(pc + shift));
}

function pickDominantPcs(pcWeights, limit = 4) {
  return Array.from(pcWeights.entries())
    .map(([pc, weight]) => ({ pc: mod53(Number(pc)), weight: Number(weight) || 0 }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.max(0, Number(limit) || 0))
    .map((item) => item.pc);
}

function buildPcWeights(noteEvents, rows) {
  const counts = new Map();
  const events = Array.isArray(noteEvents) ? noteEvents : [];
  if (events.length) {
    for (const ev of events) {
      const pc = mod53(ev && ev.pc53);
      const weight = Math.max(0.0625, Number(ev && ev.durationWeight) || 1);
      counts.set(String(pc), (Number(counts.get(String(pc))) || 0) + weight);
    }
  } else {
    for (const row of Array.isArray(rows) ? rows : []) {
      const pc = mod53(row && row.absStep);
      counts.set(String(pc), (Number(counts.get(String(pc))) || 0) + (Number(row && row.count) || 0));
    }
  }
  const total = Array.from(counts.values()).reduce((acc, n) => acc + (Number(n) || 0), 0);
  const weights = new Map();
  if (total <= 0) return weights;
  for (const [pc, count] of counts.entries()) weights.set(pc, count / total);
  return weights;
}

function buildSeyirFeatures(noteEvents, { durakPcs, gucluPcs } = {}) {
  const events = (Array.isArray(noteEvents) ? noteEvents : [])
    .filter((ev) => ev && Number.isFinite(Number(ev.abs53)));
  if (!events.length) return null;
  const openingCount = Math.max(1, Math.min(12, Math.ceil(events.length * 0.2)));
  const opening = events.slice(0, openingCount);
  const phraseEnds = events.filter((ev) => ev && ev.phraseEnd);
  const weightedAvgRel = (list, anchors) => {
    if (!list.length || !anchors || !anchors.length) return null;
    let sum = 0;
    let total = 0;
    for (const ev of list) {
      const w = Math.max(0.0625, Number(ev.durationWeight) || 1);
      const pc = mod53(ev.pc53);
      let best = null;
      for (const anchor of anchors) {
        const d = signedPcDistance(anchor, pc);
        if (best == null || Math.abs(d) < Math.abs(best)) best = d;
      }
      if (best == null) continue;
      sum += best * w;
      total += w;
    }
    return total > 0 ? sum / total : null;
  };
  const topPc = (() => {
    const weights = buildPcWeights(events, []);
    const first = pickDominantPcs(weights, 1);
    return first.length ? first[0] : null;
  })();
  return {
    openingDurakWeight: anchorWeightForEvents(opening, durakPcs, { maxDistance: 2 }),
    openingGucluWeight: anchorWeightForEvents(opening, gucluPcs, { maxDistance: 2 }),
    phraseEndDurakWeight: anchorWeightForEvents(phraseEnds, durakPcs, { maxDistance: 2 }),
    phraseEndGucluWeight: anchorWeightForEvents(phraseEnds, gucluPcs, { maxDistance: 2 }),
    gravityPc: topPc,
    gravityDurakDistance: topPc == null ? null : nearestAnchorDistance(topPc, durakPcs),
    gravityGucluDistance: topPc == null ? null : nearestAnchorDistance(topPc, gucluPcs),
    openingAvgRelDurak: weightedAvgRel(opening, durakPcs),
  };
}

function confidenceFromScore(score) {
  if (score >= 0.76) return "Strong";
  if (score >= 0.62) return "Likely";
  if (score >= 0.28) return "Possible";
  return "Weak";
}

function formatShiftPc53(shift) {
  const normalized = mod53(shift);
  if (!normalized) return "";
  const signed = normalized > 26 ? normalized - 53 : normalized;
  return `${signed > 0 ? "+" : ""}${signed}pc53`;
}

function scoreSeyir(entry, noteEvents, durakPcs) {
  const seyir = normalizeName(entry && entry.seyir);
  const events = (Array.isArray(noteEvents) ? noteEvents : [])
    .filter((ev) => ev && Number.isFinite(Number(ev.abs53)));
  if (events.length < 8 || !seyir) return null;
  const sliceSize = Math.max(1, Math.floor(events.length / 3));
  const first = events.slice(0, sliceSize);
  const last = events.slice(events.length - sliceSize);
  const avg = (list) => list.reduce((acc, ev) => acc + Number(ev.abs53), 0) / Math.max(1, list.length);
  const earlyAvg = avg(first);
  const lateAvg = avg(last);
  const finalPc = mod53(events[events.length - 1].pc53);
  const endsOnDurak = (Array.isArray(durakPcs) ? durakPcs : []).some((pc) => mod53(pc) === finalPc);

  if (seyir.includes("descending") && !seyir.includes("ascending") && lateAvg <= earlyAvg + 3) {
    return { score: 0.07, detail: "late contour is compatible with descending seyir" };
  }
  if (seyir.includes("ascending") && !seyir.includes("descending") && lateAvg >= earlyAvg - 3) {
    return { score: 0.07, detail: "late contour is compatible with ascending seyir" };
  }
  if (seyir.includes("ascending descending") || seyir.includes("ascendingdescending")) {
    if (endsOnDurak) return { score: 0.06, detail: "contour returns to the expected durak zone" };
  }
  return null;
}

export function suggestMakamCandidates({
  tuneText,
  rows,
  noteEvents,
  baseStep,
  makamEntries,
  resolvePerdePc53,
  maxCandidates = 5,
  recognitionMakamKeys = DEFAULT_RECOGNITION_MAKAM_KEYS,
} = {}) {
  const entries = Array.isArray(makamEntries) ? makamEntries : [];
  const events = Array.isArray(noteEvents) ? noteEvents : [];
  const pcWeights = buildPcWeights(events, rows);
  const tuneK = extractFirstKSignature(tuneText);
  const kByMakam = new Map();
  for (const item of BUILTIN_MAKAM_K_SIGNATURES) {
    const sig = normalizeKSignature(item && item.k);
    for (const key of makamSearchKeys(item && item.makam)) {
      if (key && sig && !kByMakam.has(key)) kByMakam.set(key, sig);
    }
  }
  const finalPc = events.length ? mod53(events[events.length - 1].pc53) : null;
  const observedCenters = [];
  if (finalPc != null) observedCenters.push(finalPc);
  if (Number.isFinite(Number(baseStep))) observedCenters.push(mod53(baseStep));
  observedCenters.push(...pickDominantPcs(pcWeights, 3));

  const resolve = (names) => {
    const pcs = [];
    for (const name of names) {
      let resolved = [];
      try {
        resolved = typeof resolvePerdePc53 === "function" ? (resolvePerdePc53(name) || []) : [];
      } catch {
        resolved = [];
      }
      for (const pc of resolved) {
        if (Number.isFinite(Number(pc))) pcs.push(mod53(pc));
      }
    }
    return Array.from(new Set(pcs.map((pc) => String(pc)))).map((pc) => Number(pc));
  };

  const candidates = [];
  for (const entry of entries) {
    const makam = String(entry && entry.makam ? entry.makam : "").trim();
    if (!makam) continue;
    const makamKeys = makamSearchKeys(makam);
    if (recognitionMakamKeys && !makamKeys.some((key) => recognitionMakamKeys.has(key))) continue;
    const makamKey = makamKeys[0] || "";
    const sourceDurakPcs = resolve(splitRoleNames(entry.durak));
    const sourceGucluPcs = resolve(splitRoleNames(entry.guclu));
    const sourceYedenPcs = resolve(splitRoleNames(entry.yeden));
    const shiftCandidates = [0];
    for (const center of observedCenters) {
      for (const durakPc of sourceDurakPcs) shiftCandidates.push(mod53(center - durakPc));
    }
    const uniqueShifts = Array.from(new Set(shiftCandidates.map((shift) => String(mod53(shift))))).map((shift) => Number(shift));
    let bestShift = 0;
    let bestRoleWeight = -1;
    for (const shift of uniqueShifts) {
      const roleWeight =
        sumWeightsForPcs(pcWeights, shiftedPcs(sourceDurakPcs, shift)) * 1.2
        + sumWeightsForPcs(pcWeights, shiftedPcs(sourceGucluPcs, shift)) * 0.8
        + sumWeightsForPcs(pcWeights, shiftedPcs(sourceYedenPcs, shift)) * 0.4;
      if (roleWeight > bestRoleWeight) {
        bestRoleWeight = roleWeight;
        bestShift = shift;
      }
    }
    const durakPcs = shiftedPcs(sourceDurakPcs, bestShift);
    const gucluPcs = shiftedPcs(sourceGucluPcs, bestShift);
    const yedenPcs = shiftedPcs(sourceYedenPcs, bestShift);
    const seyirFeatures = buildSeyirFeatures(events, { durakPcs, gucluPcs });
    const evidence = [];
    let score = 0;

    const durakWeight = sumWeightsForPcs(pcWeights, durakPcs);
    if (durakWeight > 0) {
      const add = Math.min(0.18, durakWeight * 0.55);
      score += add;
      const shiftLabel = formatShiftPc53(bestShift);
      const transposed = shiftLabel ? ` after transposition ${shiftLabel}` : "";
      evidence.push({ kind: "durak", label: "Durak weight", score: add, detail: `${Math.round(durakWeight * 100)}% of notes fall on expected durak class${transposed}` });
    }
    if (finalPc != null && durakPcs.some((pc) => mod53(pc) === finalPc)) {
      score += 0.18;
      evidence.push({ kind: "final", label: "Final note", score: 0.18, detail: "final pitch class matches expected durak" });
    }

    if (seyirFeatures && seyirFeatures.phraseEndDurakWeight > 0) {
      const add = Math.min(0.10, seyirFeatures.phraseEndDurakWeight * 0.12);
      score += add;
      evidence.push({ kind: "cadence", label: "Cadence", score: add, detail: `${Math.round(seyirFeatures.phraseEndDurakWeight * 100)}% of phrase endings return near durak` });
    }

    const gucluWeight = sumWeightsForPcs(pcWeights, gucluPcs);
    if (gucluWeight > 0) {
      const add = Math.min(0.14, gucluWeight * 0.45);
      score += add;
      evidence.push({ kind: "guclu", label: "Güçlü", score: add, detail: `${Math.round(gucluWeight * 100)}% of notes fall on expected güçlü class` });
    }

    if (seyirFeatures && seyirFeatures.openingGucluWeight > 0.25) {
      const add = Math.min(0.08, seyirFeatures.openingGucluWeight * 0.10);
      score += add;
      evidence.push({ kind: "opening", label: "Opening", score: add, detail: `opening activity is centered near güçlü (${Math.round(seyirFeatures.openingGucluWeight * 100)}%)` });
    } else if (seyirFeatures && seyirFeatures.openingDurakWeight > 0.25) {
      const add = Math.min(0.07, seyirFeatures.openingDurakWeight * 0.09);
      score += add;
      evidence.push({ kind: "opening", label: "Opening", score: add, detail: `opening activity is centered near durak (${Math.round(seyirFeatures.openingDurakWeight * 100)}%)` });
    }

    if (seyirFeatures && (seyirFeatures.gravityDurakDistance != null || seyirFeatures.gravityGucluDistance != null)) {
      const nearDurak = seyirFeatures.gravityDurakDistance != null && seyirFeatures.gravityDurakDistance <= 2;
      const nearGuclu = seyirFeatures.gravityGucluDistance != null && seyirFeatures.gravityGucluDistance <= 2;
      if (nearDurak || nearGuclu) {
        const add = nearGuclu ? 0.08 : 0.06;
        score += add;
        evidence.push({
          kind: "gravity",
          label: "Gravity",
          score: add,
          detail: nearGuclu ? "strongest activity is near expected güçlü" : "strongest activity is near expected durak",
        });
      }
    }

    const yedenWeight = sumWeightsForPcs(pcWeights, yedenPcs);
    if (yedenWeight > 0) {
      const add = Math.min(0.08, yedenWeight * 0.35);
      score += add;
      evidence.push({ kind: "yeden", label: "Yeden", score: add, detail: `${Math.round(yedenWeight * 100)}% of notes fall on expected yeden class` });
    }

    const expectedK = kByMakam.get(makamKey) || "";
    if (tuneK && expectedK && tuneK === expectedK) {
      score += 0.18;
      evidence.push({ kind: "kSignature", label: "K: signature", score: 0.18, detail: `matches common SymbTr K: ${expectedK}` });
    }

    const seyir = scoreSeyir(entry, events, durakPcs);
    if (seyir) {
      score += seyir.score;
      evidence.push({ kind: "seyir", label: "Seyir", score: seyir.score, detail: seyir.detail });
    }

    if (seyirFeatures && Number.isFinite(Number(seyirFeatures.openingAvgRelDurak))) {
      const avg = Number(seyirFeatures.openingAvgRelDurak);
      const seyirKey = normalizeName(entry && entry.seyir);
      if (seyirKey.includes("ascending") && avg >= -4 && avg <= 10) {
        score += 0.05;
        evidence.push({ kind: "direction", label: "Direction", score: 0.05, detail: "opening register is compatible with ascending seyir" });
      } else if (seyirKey.includes("descending") && avg >= 5) {
        score += 0.05;
        evidence.push({ kind: "direction", label: "Direction", score: 0.05, detail: "opening register is compatible with descending seyir" });
      }
    }

    if (!evidence.length) continue;
    evidence.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    candidates.push({
      makam,
      score: Math.min(1, score),
      confidence: confidenceFromScore(score),
      evidence,
    });
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.makam || "").localeCompare(String(b.makam || ""), undefined, { sensitivity: "base" });
  });
  return candidates.slice(0, Math.max(1, Number(maxCandidates) || 5));
}
