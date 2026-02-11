const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const {
  ConversionError,
  resolvePythonExecutable,
  parseArgString,
  runPythonScript,
} = require("./utils");
const { convertAbcToMusicXml: runAbcToMusicXml } = require("./backends/abc2xml");
const { convertMusicXmlToAbc } = require("./backends/xml2abc");
const { convertMidiToAbc } = require("./backends/midi2abc");
const { convertMidiToAbcViaMusic21 } = require("./backends/midi2abc_music21");

const TOOL_SCRIPTS = {
  abc2xml: ["abc2xml.py"],
  xml2abc: ["xml2abc.py"],
  midi2xml: ["midi2xml.py"],
};

function resolveMidi2abcPath() {
  const root = resolveThirdPartyRoot();
  const converterPath = path.join(root, "midi2abc", "midi2abc.mjs");
  if (fs.existsSync(converterPath)) return converterPath;
  throw new ConversionError(
    "Converter not found.",
    `Missing midi2abc at ${converterPath}`,
    "CONVERTER_MISSING"
  );
}

function resolveThirdPartyRoot() {
  const devRoot = path.join(app.getAppPath(), "third_party");
  const unpacked = path.join(process.resourcesPath || "", "app.asar.unpacked", "third_party");
  if (app.isPackaged && fs.existsSync(unpacked)) return unpacked;
  if (fs.existsSync(devRoot)) return devRoot;
  return devRoot;
}

function resolveScriptPath(toolKey) {
  const candidates = TOOL_SCRIPTS[toolKey] || [];
  const root = resolveThirdPartyRoot();
  for (const filename of candidates) {
    const scriptPath = path.join(root, toolKey, filename);
    if (fs.existsSync(scriptPath)) return scriptPath;
  }
  const tried = candidates.length
    ? candidates.map((name) => path.join(root, toolKey, name)).join(", ")
    : path.join(root, toolKey);
  throw new ConversionError(
    "Converter not found.",
    `Missing ${toolKey} at ${tried}`,
    "CONVERTER_MISSING"
  );
}

async function convertFileToAbc({ kind, inputPath, args, midiBackend, xmlArgs }) {
  if (kind === "musicxml" || kind === "mxl") {
    const extraArgs = parseArgString(args);
    const python = await resolvePythonExecutable();
    const scriptPath = resolveScriptPath("xml2abc");
    return convertMusicXmlToAbc({ python, scriptPath, inputPath, extraArgs });
  }
  if (kind === "midi") {
    const selectedBackend = String(midiBackend || "auto").trim() || "auto";
    const midiArgs = parseArgString(args);
    const tryMusic21 = async () => {
      const python = await resolvePythonExecutable();
      const midi2xmlScriptPath = resolveScriptPath("midi2xml");
      const xml2abcScriptPath = resolveScriptPath("xml2abc");
      const xml2abcExtraArgs = parseArgString(xmlArgs);
      return convertMidiToAbcViaMusic21({
        pythonPath: python,
        midi2xmlScriptPath,
        xml2abcScriptPath,
        inputPath,
        xml2abcExtraArgs,
        midiExtraArgs: midiArgs,
      });
    };

    if (selectedBackend === "music21-xml2abc" || selectedBackend === "auto") {
      try {
        return await tryMusic21();
      } catch (e) {
        const canFallback = selectedBackend === "auto" || (e && e.code === "MUSIC21_MISSING");
        if (!canFallback) throw e;
        const converterPath = resolveMidi2abcPath();
        const fallback = await convertMidiToAbc({ inputPath, converterPath, extraArgs: midiArgs });
        const reason = (e && e.code === "MUSIC21_MISSING")
          ? "music21 unavailable"
          : "music21 backend failed";
        const warn = `${reason}, fell back to bundled midi2abc.`;
        return {
          ...fallback,
          warnings: fallback.warnings ? `${fallback.warnings} ${warn}` : warn,
          backend: "midi2abc(fallback)",
        };
      }
    }
    const converterPath = resolveMidi2abcPath();
    return convertMidiToAbc({ inputPath, converterPath, extraArgs: midiArgs });
  }
  throw new ConversionError(
    "Unsupported import format.",
    `Unknown import kind: ${kind}`,
    "UNSUPPORTED_KIND"
  );
}

async function convertAbcToMusicXml({ abcText, args }) {
  const python = await resolvePythonExecutable();
  const scriptPath = resolveScriptPath("abc2xml");
  const extraArgs = parseArgString(args);
  return runAbcToMusicXml({ python, scriptPath, abcText, extraArgs });
}

async function checkConversionTools() {
  const result = {
    python: { ok: false, path: null, error: "", detail: "", code: "" },
    abc2xml: { ok: false, path: null, error: "", detail: "", code: "" },
    xml2abc: { ok: false, path: null, error: "", detail: "", code: "" },
    midi2xml: { ok: false, path: null, error: "", detail: "", code: "" },
    midi2abc: { ok: false, path: null, error: "", detail: "", code: "" },
  };

  try {
    const python = await resolvePythonExecutable();
    result.python = { ok: true, path: python };
  } catch (e) {
    result.python = {
      ok: false,
      path: null,
      error: e && e.message ? e.message : "Python not found.",
      detail: e && e.detail ? e.detail : "",
      code: e && e.code ? e.code : "",
    };
  }

  try {
    const scriptPath = resolveScriptPath("abc2xml");
    result.abc2xml = { ok: true, path: scriptPath };
  } catch (e) {
    result.abc2xml = {
      ok: false,
      path: null,
      error: e && e.message ? e.message : "abc2xml not found.",
      detail: e && e.detail ? e.detail : "",
      code: e && e.code ? e.code : "",
    };
  }

  try {
    const scriptPath = resolveScriptPath("xml2abc");
    result.xml2abc = { ok: true, path: scriptPath };
  } catch (e) {
    result.xml2abc = {
      ok: false,
      path: null,
      error: e && e.message ? e.message : "xml2abc not found.",
      detail: e && e.detail ? e.detail : "",
      code: e && e.code ? e.code : "",
    };
  }

  try {
    const scriptPath = resolveScriptPath("midi2xml");
    result.midi2xml = { ok: true, path: scriptPath };
  } catch (e) {
    result.midi2xml = {
      ok: false,
      path: null,
      error: e && e.message ? e.message : "midi2xml not found.",
      detail: e && e.detail ? e.detail : "",
      code: e && e.code ? e.code : "",
    };
  }

  try {
    const converterPath = resolveMidi2abcPath();
    result.midi2abc = { ok: true, path: converterPath };
  } catch (e) {
    result.midi2abc = {
      ok: false,
      path: null,
      error: e && e.message ? e.message : "midi2abc not found.",
      detail: e && e.detail ? e.detail : "",
      code: e && e.code ? e.code : "",
    };
  }

  // Dependency check for midi2xml backend.
  if (result.python.ok && result.midi2xml.ok) {
    try {
      await runPythonScript({
        pythonPath: result.python.path,
        scriptPath: result.midi2xml.path,
        args: ["--version"],
        cwd: process.cwd(),
        timeoutMs: 10000,
      });
    } catch (e) {
      result.midi2xml = {
        ok: false,
        path: result.midi2xml.path,
        error: "midi2xml runtime check failed.",
        detail: e && e.detail ? e.detail : (e && e.message ? e.message : String(e)),
        code: e && e.code ? e.code : "",
      };
    }
  }

  return result;
}

module.exports = {
  convertFileToAbc,
  convertAbcToMusicXml,
  resolveThirdPartyRoot,
  ConversionError,
  checkConversionTools,
};
