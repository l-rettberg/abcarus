const MIN_RUNTIME_TEMPO_MULTIPLIER = 0.5;
const MAX_RUNTIME_TEMPO_MULTIPLIER = 1.5;

function clampRuntimeTempoMultiplier(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(MIN_RUNTIME_TEMPO_MULTIPLIER, Math.min(MAX_RUNTIME_TEMPO_MULTIPLIER, parsed));
}

function parseSimpleAbcTempo(abcText) {
  const lines = String(abcText || "").split(/\r?\n/);
  for (const line of lines) {
    if (/^\s*K:/.test(line)) break;
    const match = line.match(/^\s*Q:\s*(?:"[^"]*"\s*)?(\d+)\s*\/\s*(\d+)\s*=\s*(\d+(?:\.\d+)?)\s*(?:"[^"]*"\s*)?$/);
    if (!match) continue;
    const numerator = Number(match[1]);
    const denominator = Number(match[2]);
    const bpm = Number(match[3]);
    if (!(numerator > 0 && denominator > 0 && bpm > 0)) return null;
    return { numerator, denominator, bpm };
  }
  return null;
}

function getRuntimeTempoPresentation(abcText, multiplier) {
  const safeMultiplier = clampRuntimeTempoMultiplier(multiplier);
  const tempo = parseSimpleAbcTempo(abcText);
  if (!tempo) {
    return {
      tempo: null,
      multiplier: safeMultiplier,
      effectiveBpm: null,
      label: `${Math.round(safeMultiplier * 100)}%`,
    };
  }
  const effectiveBpm = Math.max(1, Math.round(tempo.bpm * safeMultiplier));
  return {
    tempo,
    multiplier: safeMultiplier,
    effectiveBpm,
    label: `${tempo.numerator}/${tempo.denominator} = ${effectiveBpm} BPM`,
  };
}

function stepRuntimeTempoMultiplier(abcText, multiplier, direction) {
  const presentation = getRuntimeTempoPresentation(abcText, multiplier);
  const delta = Number(direction) < 0 ? -1 : 1;
  if (presentation.tempo && presentation.effectiveBpm != null) {
    const targetBpm = Math.max(1, presentation.effectiveBpm + delta);
    return clampRuntimeTempoMultiplier(targetBpm / presentation.tempo.bpm);
  }
  const stepped = Math.round((presentation.multiplier + (delta * 0.01)) * 100) / 100;
  return clampRuntimeTempoMultiplier(stepped);
}

export {
  MAX_RUNTIME_TEMPO_MULTIPLIER,
  MIN_RUNTIME_TEMPO_MULTIPLIER,
  clampRuntimeTempoMultiplier,
  getRuntimeTempoPresentation,
  parseSimpleAbcTempo,
  stepRuntimeTempoMultiplier,
};
