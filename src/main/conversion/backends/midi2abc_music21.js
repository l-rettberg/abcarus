const fs = require("fs");
const path = require("path");
const {
  ConversionError,
  runPythonScript,
  withTempDir,
} = require("../utils");
const { convertMusicXmlToAbc } = require("./xml2abc");

function parseMusic21MidiImportOptions(extraArgs = []) {
  const out = {
    title: "",
    composer: "",
    meter: "",
    unit: "",
    key: "",
  };
  const args = Array.isArray(extraArgs) ? extraArgs.map((x) => String(x || "")) : [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    const takeValue = () => {
      const v = args[i + 1];
      if (v == null || String(v).startsWith("-")) {
        throw new ConversionError("Invalid midi2abc flags.", `Missing value for ${a}.`, "MIDI2ABC_BAD_ARGS");
      }
      i += 1;
      return String(v);
    };
    if (a === "--title") out.title = takeValue();
    else if (a === "--composer") out.composer = takeValue();
    else if (a === "--meter") out.meter = takeValue();
    else if (a === "--unit") out.unit = takeValue();
    else if (a === "--key") out.key = takeValue();
    else if (a === "--no-quantize" || a === "--grid") {
      if (a === "--grid") takeValue();
      // Ignored in music21 backend; timing comes from parsed score data.
    } else if (a.trim()) {
      throw new ConversionError(
        "Invalid midi2abc flags.",
        `Unsupported flag for music21 backend: ${a}. Supported: --title --composer --meter --unit --key`,
        "MIDI2ABC_BAD_ARGS"
      );
    }
  }
  return out;
}

function replaceAbcHeaderLine(abcText, tag, value) {
  const txt = String(abcText || "");
  const v = String(value || "").trim();
  if (!v) return txt;
  const re = new RegExp(`^${tag}:.*$`, "m");
  if (re.test(txt)) return txt.replace(re, `${tag}:${v}`);
  const lines = txt.split(/\r\n|\n|\r/);
  let insertAt = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*(X:|T:|C:|Q:|L:|M:)\b/.test(lines[i] || "")) {
      insertAt = i + 1;
      continue;
    }
    break;
  }
  lines.splice(insertAt, 0, `${tag}:${v}`);
  return `${lines.join("\n")}\n`;
}

async function runMidiToMusicXmlWithMusic21({ pythonPath, midi2xmlScriptPath, inputPath, outputPath }) {
  try {
    await runPythonScript({
      pythonPath,
      scriptPath: midi2xmlScriptPath,
      args: [inputPath, outputPath],
      cwd: fs.existsSync(inputPath) ? path.dirname(inputPath) : process.cwd(),
      timeoutMs: 60000,
    });
  } catch (e) {
    const detail = e && e.detail ? String(e.detail) : "";
    if (detail.includes("MUSIC21_IMPORT_ERROR:") || detail.includes("No module named 'music21'")) {
      throw new ConversionError(
        "music21 is required for this MIDI import backend.",
        "Install midi2xml Python dependencies in the bundled runtime, or switch backend to bundled midi2abc.",
        "MUSIC21_MISSING"
      );
    }
    throw new ConversionError(
      "MIDI to MusicXML conversion failed.",
      detail || (e && e.message ? e.message : String(e)),
      "MIDI2XML_FAILED"
    );
  }
}

async function convertMidiToAbcViaMusic21({
  pythonPath,
  midi2xmlScriptPath,
  xml2abcScriptPath,
  inputPath,
  xml2abcExtraArgs = [],
  midiExtraArgs = [],
}) {
  if (!inputPath) {
    throw new ConversionError("No input file selected.", "Choose a MIDI file to import.", "NO_INPUT");
  }
  const options = parseMusic21MidiImportOptions(midiExtraArgs);
  return withTempDir(async (tmpDir) => {
    const xmlPath = path.join(tmpDir, "input.musicxml");
    await runMidiToMusicXmlWithMusic21({
      pythonPath,
      midi2xmlScriptPath,
      inputPath,
      outputPath: xmlPath,
    });
    let converted = await convertMusicXmlToAbc({
      python: pythonPath,
      scriptPath: xml2abcScriptPath,
      inputPath: xmlPath,
      extraArgs: xml2abcExtraArgs,
    });
    let abcText = String(converted.abcText || "");
    if (options.title) abcText = replaceAbcHeaderLine(abcText, "T", options.title);
    if (options.composer) abcText = replaceAbcHeaderLine(abcText, "C", options.composer);
    if (options.meter) abcText = replaceAbcHeaderLine(abcText, "M", options.meter);
    if (options.unit) abcText = replaceAbcHeaderLine(abcText, "L", options.unit);
    if (options.key) abcText = replaceAbcHeaderLine(abcText, "K", options.key);
    return {
      abcText,
      warnings: "Converted via music21 -> MusicXML -> xml2abc (experimental).",
      backend: "music21-xml2abc",
    };
  });
}

module.exports = {
  convertMidiToAbcViaMusic21,
};
