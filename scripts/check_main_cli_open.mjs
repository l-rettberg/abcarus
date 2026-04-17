import { readFile } from "node:fs/promises";
import path from "node:path";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function extractFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start < 0) return "";
  let i = src.indexOf("{", start);
  if (i < 0) return "";
  let depth = 0;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

function compileParseCliOptions(mainSource) {
  const fnCode = extractFunctionSource(mainSource, "parseCliOptions");
  assert(fnCode, "parseCliOptions() not found in src/main/index.js");
  // Keep this evaluator strict/minimal: only pass `path`.
  return new Function("path", `${fnCode}; return parseCliOptions;`)(path);
}

async function main() {
  const src = await readFile("src/main/index.js", "utf8");

  assert(src.includes("app.requestSingleInstanceLock()"), "single-instance lock is missing");
  assert(src.includes("app.on(\"second-instance\""), "second-instance handler is missing");
  assert(src.includes("queueOrOpenCliInputPath"), "CLI open helper is missing");
  assert(src.includes("type: \"openRecentFile\""), "second instance must route through openRecentFile action");

  const parseCliOptions = compileParseCliOptions(src);

  {
    const got = parseCliOptions(["electron", ".", "--input", "demo.abc"]);
    assert(got.inputPath === "demo.abc", "dev launcher '.' should be skipped");
  }
  {
    const got = parseCliOptions(["electron", "src/main/index.js", "--version"]);
    assert(got.showVersion === true, "--version must be recognized with launcher script arg");
  }
  {
    const got = parseCliOptions(["electron", "/tmp/song.abc"]);
    assert(got.inputPath === "/tmp/song.abc", "positional .abc path must not be dropped");
  }
  {
    const got = parseCliOptions(["electron", "app.asar", "/tmp/song.abc"]);
    assert(got.inputPath === "/tmp/song.abc", "app.asar launcher must be skipped");
  }
  {
    const got = parseCliOptions(["electron", "--factorysettings", "--log"]);
    assert(got.factorySettings === true, "--factorysettings must be recognized");
    assert(got.enableLog === true, "--log must be recognized");
  }
}

main().catch((err) => {
  process.stderr.write(`check_main_cli_open.mjs failed: ${err?.stack || err}\n`);
  process.exitCode = 1;
});

