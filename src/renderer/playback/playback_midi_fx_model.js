function midiFxValueToControlLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.min(127, Math.round(n)));
}

function injectPlaybackMidiFxControls(text, offset, fxSettings = {}) {
  const reverb = midiFxValueToControlLevel(fxSettings.playbackMidiReverb);
  const chorus = midiFxValueToControlLevel(fxSettings.playbackMidiChorus);
  if (!reverb && !chorus) {
    return { text, offset: Number(offset) || 0 };
  }

  const lines = [];
  if (reverb) lines.push(`%%MIDI control 91 ${reverb}`);
  if (chorus) lines.push(`%%MIDI control 93 ${chorus}`);
  const insert = `${lines.join("\n")}\n`;
  const base = String(text || "");
  const idx = Math.max(0, Math.min(base.length, Number(offset) || 0));
  const next = `${base.slice(0, idx)}${insert}${base.slice(idx)}`;
  return { text: next, offset: idx + insert.length };
}

export {
  injectPlaybackMidiFxControls,
  midiFxValueToControlLevel,
};
