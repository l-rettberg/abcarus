const HELP_BY_HEADER_KEY = new Map([
  ["K", "Key signature (e.g. K:Dm, K:G, K:C#m). abc2svg treats K: as the header/body boundary."],
  ["M", "Meter/time signature (e.g. M:4/4, M:6/8, M:C, M:C|)."],
  ["L", "Default note length unit (e.g. L:1/8)."],
]);

const HELP_BY_MIDI_COMMAND = new Map([
  ["program", "Select instrument program (0\u2013127). Use ABC Helpers (Ctrl+F2) for GM program picker."],
  ["chordprog", "Select chord instrument program. Use ABC Helpers (Ctrl+F2) for GM program picker."],
  ["bassprog", "Select bass instrument program. Use ABC Helpers (Ctrl+F2) for GM program picker."],
  ["instrument", "Instrument selection (engine-defined; often an alias of program)."],
  ["temperamentequal", "Enable EDO-N tuning (e.g. %%MIDI temperamentequal 53)."],
  ["drum", "Define drum pattern. Use ABC Helpers (Ctrl+F2) > Drum Helper for guided editing."],
  ["drumon", "Enable drums. Use ABC Helpers (Ctrl+F2) > Drum Helper for drum lines."],
  ["drumoff", "Disable drums. Use ABC Helpers (Ctrl+F2) > Drum Helper for drum lines."],
  ["gchord", "Define accompaniment pattern. Use ABC Helpers (Ctrl+F2) > Gchord Helper for guided editing."],
  ["gchordbars", "Set bars covered by gchord pattern. Use ABC Helpers (Ctrl+F2) > Gchord Helper."],
  ["gchordon", "Enable gchords."],
  ["gchordoff", "Disable gchords."],
]);

function getAbcHelpAtLine(text) {
  if (!text) return null;

  const headerMatch = /^\s*([KML]):/.exec(text);
  if (headerMatch) {
    const key = headerMatch[1];
    const help = HELP_BY_HEADER_KEY.get(key) || null;
    if (!help) return null;
    return { title: `${key}:`, help };
  }

  const midiMatch = /^\s*(%{1,2})\s*MIDI\s+([A-Za-z]+)/i.exec(text);
  if (midiMatch) {
    const cmd = String(midiMatch[2] || "").toLowerCase();
    const help = HELP_BY_MIDI_COMMAND.get(cmd) || null;
    if (!help) return null;
    return { title: `%%MIDI ${cmd}`, help };
  }

  return null;
}

function formatAbcHelpLine(help) {
  if (!help) return "";
  return `${help.title} \u2014 ${help.help}`;
}

export {
  formatAbcHelpLine,
  getAbcHelpAtLine,
};
