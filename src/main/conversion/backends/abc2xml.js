const fs = require("fs");
const path = require("path");
const {
  ConversionError,
  runPythonScript,
  withTempDir,
  findFirstFileByExt,
} = require("../utils");

async function convertAbcToMusicXml({ python, scriptPath, abcText, extraArgs = [] }) {
  if (!abcText || !String(abcText).trim()) {
    throw new ConversionError(
      "No ABC data to export.",
      "Add notation to the editor before exporting.",
      "EMPTY_INPUT"
    );
  }

  return withTempDir(async (dir) => {
    const inputPath = path.join(dir, "input.abc");
    await fs.promises.writeFile(inputPath, abcText, "utf8");

    const { stdout, stderr } = await runPythonScript({
      pythonPath: python,
      scriptPath,
      args: [...extraArgs, inputPath],
      cwd: path.dirname(scriptPath),
    });

    let xmlText = stdout;
    if (!xmlText) {
      const xmlPath = await findFirstFileByExt(dir, [".xml", ".musicxml"]);
      if (xmlPath) xmlText = await fs.promises.readFile(xmlPath, "utf8");
    }

    if (!xmlText) {
      throw new ConversionError(
        "No MusicXML output produced.",
        "The converter did not return XML output.",
        "NO_OUTPUT"
      );
    }

    return { xmlText, warnings: stderr || undefined };
  });
}

function stripBatchOutputArgs(extraArgs) {
  const source = Array.isArray(extraArgs) ? extraArgs : [];
  const out = [];
  for (let i = 0; i < source.length; i += 1) {
    const arg = String(source[i] || "");
    if (arg === "-o") { i += 1; continue; }
    if (arg === "-m") { i += 2; continue; }
    if (arg === "-z" || arg === "--mxl") { i += 1; continue; }
    if (arg === "-t" || arg.startsWith("--mxl=")) continue;
    out.push(arg);
  }
  return out;
}

async function convertAbcBatchToMusicXml({ python, scriptPath, items, extraArgs = [] }) {
  const sourceItems = Array.isArray(items) ? items : [];
  if (!sourceItems.length) {
    throw new ConversionError("No ABC data to export.", "The active file contains no tunes.", "EMPTY_INPUT");
  }
  const converterArgs = stripBatchOutputArgs(extraArgs);
  return withTempDir(async (dir) => {
    const inputDir = path.join(dir, "input");
    const outputDir = path.join(dir, "output");
    await fs.promises.mkdir(inputDir, { recursive: true });
    await fs.promises.mkdir(outputDir, { recursive: true });
    const inputPaths = [];
    for (let i = 0; i < sourceItems.length; i += 1) {
      const inputPath = path.join(inputDir, `tune-${String(i + 1).padStart(5, "0")}.abc`);
      await fs.promises.writeFile(inputPath, String(sourceItems[i] && sourceItems[i].abcText ? sourceItems[i].abcText : ""), "utf8");
      inputPaths.push(inputPath);
    }

    try {
      await runPythonScript({
        pythonPath: python,
        scriptPath,
        args: [...converterArgs, "-o", outputDir, ...inputPaths],
        cwd: path.dirname(scriptPath),
        timeoutMs: Math.min(300000, Math.max(30000, sourceItems.length * 1500)),
        maxOutputBytes: 20 * 1024 * 1024,
      });
      const converted = [];
      for (let i = 0; i < inputPaths.length; i += 1) {
        const xmlPath = path.join(outputDir, `${path.basename(inputPaths[i], ".abc")}.xml`);
        converted.push({ index: i, xmlText: await fs.promises.readFile(xmlPath, "utf8") });
      }
      return { converted, failures: [], warnings: undefined, usedFallback: false };
    } catch (_batchError) {
      const converted = [];
      const failures = [];
      const warnings = [];
      for (let i = 0; i < sourceItems.length; i += 1) {
        try {
          const result = await convertAbcToMusicXml({
            python,
            scriptPath,
            abcText: String(sourceItems[i] && sourceItems[i].abcText ? sourceItems[i].abcText : ""),
            extraArgs: converterArgs,
          });
          converted.push({ index: i, xmlText: result.xmlText });
          if (result.warnings) warnings.push(`Tune ${i + 1}: ${result.warnings}`);
        } catch (error) {
          failures.push({
            index: i,
            error: error && error.message ? String(error.message) : String(error),
            detail: error && error.detail ? String(error.detail) : "",
          });
        }
      }
      return { converted, failures, warnings: warnings.join("\n") || undefined, usedFallback: true };
    }
  });
}

module.exports = { convertAbcBatchToMusicXml, convertAbcToMusicXml, stripBatchOutputArgs };
