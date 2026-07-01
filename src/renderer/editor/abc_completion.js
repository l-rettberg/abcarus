function buildAbcCompletionSource() {
  const keyOptions = [
    "C",
    "G",
    "D",
    "A",
    "E",
    "B",
    "F#",
    "C#",
    "F",
    "Bb",
    "Eb",
    "Ab",
    "Db",
    "Gb",
    "Cb",
    "Am",
    "Em",
    "Bm",
    "F#m",
    "C#m",
    "G#m",
    "D#m",
    "A#m",
    "Dm",
    "Gm",
    "Cm",
    "Fm",
    "Bbm",
    "Ebm",
    "Abm",
  ].map((label) => ({ label, type: "keyword" }));

  const meterOptions = [
    "4/4",
    "3/4",
    "2/4",
    "6/8",
    "12/8",
    "2/2",
    "5/4",
    "7/8",
    "9/8",
    "C",
    "C|",
    "none",
  ].map((label) => ({ label, type: "keyword" }));

  const unitOptions = [
    "1/8",
    "1/16",
    "1/4",
    "1/2",
  ].map((label) => ({ label, type: "keyword" }));

  const tempoOptions = [
    "1/4=60",
    "1/4=80",
    "1/4=100",
    "1/4=120",
    "1/4=144",
    "1/8=120",
    "1/8=180",
  ].map((label) => ({ label, type: "keyword" }));

  const voiceOptions = ["1", "2", "3", "4"].map((label) => ({ label, type: "keyword" }));

  const edoOptions = ["12", "19", "24", "31", "41", "53"].map((label) => ({ label, type: "keyword" }));

  const midiDirectives = [
    { label: "%%MIDI program ", type: "keyword", info: "Select instrument program (0\u2013127). Use ABC Helpers (Ctrl+F2) for GM program picker." },
    { label: "%%MIDI chordprog ", type: "keyword", info: "Select chord instrument program. Use ABC Helpers (Ctrl+F2) for GM program picker." },
    { label: "%%MIDI bassprog ", type: "keyword", info: "Select bass instrument program. Use ABC Helpers (Ctrl+F2) for GM program picker." },
    { label: "%%MIDI instrument ", type: "keyword", info: "Alias of program (engine-defined)" },
    { label: "%%MIDI temperamentequal ", type: "keyword", info: "Enable EDO-N (e.g. 53)" },
    { label: "%%MIDI drum ", type: "keyword", info: "Define drum pattern. Use ABC Helpers (Ctrl+F2) > Drum Helper for guided editing." },
    { label: "%%MIDI drumoff", type: "keyword", info: "Disable drums. Use ABC Helpers (Ctrl+F2) > Drum Helper for drum lines." },
    { label: "%%MIDI drumon", type: "keyword", info: "Enable drums. Use ABC Helpers (Ctrl+F2) > Drum Helper for drum lines." },
    { label: "%%MIDI gchord ", type: "keyword", info: "Define accompaniment pattern. Use ABC Helpers (Ctrl+F2) > Gchord Helper for guided editing." },
    { label: "%%MIDI gchordbars ", type: "keyword", info: "Set bars covered by gchord pattern. Use ABC Helpers (Ctrl+F2) > Gchord Helper." },
    { label: "%%MIDI gchordoff", type: "keyword", info: "Disable gchords." },
    { label: "%%MIDI gchordon", type: "keyword", info: "Enable gchords." },
  ];

  return (context) => {
    const pos = context.pos;
    const line = context.state.doc.lineAt(pos);
    const lineText = line.text;
    const before = lineText.slice(0, pos - line.from);
    const beforeTrim = before.trimStart();

    // Offer `%%MIDI ...` directives at start of line (or after indentation).
    if (beforeTrim.startsWith("%%") || /^(\s*)$/.test(before)) {
      const m = context.matchBefore(/^\s*%%[A-Za-z]*$/);
      if (m) {
        return { from: line.from + m.from, options: midiDirectives, validFor: /^\s*%%[A-Za-z]*$/ };
      }
      const m2 = context.matchBefore(/^\s*%%MIDI\s+[A-Za-z]*$/);
      if (m2) {
        return { from: line.from + m2.from, options: midiDirectives, validFor: /^\s*%%MIDI\s+[A-Za-z]*$/ };
      }
    }

    // %%MIDI temperamentequal <N>
    if (/^\s*%%\s*MIDI\s+temperamentequal\b/i.test(lineText)) {
      const m = context.matchBefore(/\d*$/);
      if (m) return { from: line.from + m.from, options: edoOptions };
    }

    // Header field values.
    if (/^\s*K:/.test(lineText)) {
      const m = context.matchBefore(/[A-Za-z#bm]*$/);
      if (m) return { from: line.from + m.from, options: keyOptions };
    }
    if (/^\s*M:/.test(lineText)) {
      const m = context.matchBefore(/[0-9C|/nobe]*$/i);
      if (m) return { from: line.from + m.from, options: meterOptions };
    }
    if (/^\s*L:/.test(lineText)) {
      const m = context.matchBefore(/[0-9/]*$/);
      if (m) return { from: line.from + m.from, options: unitOptions };
    }
    if (/^\s*Q:/.test(lineText)) {
      const m = context.matchBefore(/[0-9=/]*$/);
      if (m) return { from: line.from + m.from, options: tempoOptions };
    }
    if (/^\s*V:/.test(lineText)) {
      const m = context.matchBefore(/[A-Za-z0-9_-]*$/);
      if (m) return { from: line.from + m.from, options: voiceOptions };
    }

    return null;
  };
}

export {
  buildAbcCompletionSource,
};
