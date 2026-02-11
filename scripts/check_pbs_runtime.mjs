#!/usr/bin/env node
// scripts/check_pbs_runtime.mjs
// Ensures a PBS runtime is installed for the current (or specified) platform.
//
// Usage:
//   node scripts/check_pbs_runtime.mjs
//   node scripts/check_pbs_runtime.mjs --platform=win-x64

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const argv = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const m = arg.match(/^--([^=]+)=(.*)$/);
  if (m) return [m[1], m[2]];
  const m2 = arg.match(/^--(.+)$/);
  return m2 ? [m2[1], "true"] : [arg, "true"];
}));

const KNOWN_PLATFORMS = ["linux-x64", "darwin-x64", "darwin-arm64", "win-x64"];

function inferPlatform() {
  if (process.platform === "win32") return "win-x64";
  if (process.platform === "linux") return "linux-x64";
  if (process.platform === "darwin") return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  return "";
}

const platform = String(argv.platform || "").trim() || inferPlatform();
if (!platform || !KNOWN_PLATFORMS.includes(platform)) {
  console.error(`Unable to determine platform. Use --platform=<${KNOWN_PLATFORMS.join("|")}>`);
  process.exit(1);
}

const root = path.join("third_party", "python-embed", platform);
const lockPath = path.join(root, "python-build-standalone.lock.json");

function existsFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function existsExecutable(p) {
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return false;
    // On Windows, just being a file is enough for our purposes here.
    if (process.platform === "win32") return true;
    return (st.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

function listTopEntries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).map((e) => e.name);
  } catch {
    return [];
  }
}

function findWindowsPythonExe(searchRoot) {
  const candidates = [];
  const level0 = path.join(searchRoot, "python.exe");
  if (existsFile(level0)) candidates.push(level0);

  const dirs1 = fs.existsSync(searchRoot)
    ? fs.readdirSync(searchRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(searchRoot, d.name))
    : [];

  for (const d1 of dirs1) {
    const p1 = path.join(d1, "python.exe");
    if (existsFile(p1)) candidates.push(p1);
  }

  for (const d1 of dirs1) {
    const dirs2 = fs.readdirSync(d1, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(d1, d.name));
    for (const d2 of dirs2) {
      const p2 = path.join(d2, "python.exe");
      if (existsFile(p2)) candidates.push(p2);
    }
  }

  return Array.from(new Set(candidates));
}

function fail(message) {
  console.error(message);
  console.error("");
  console.error("Install PBS runtime for this platform:");
  console.error(`  node devtools/pbs/pbs-update-lock.mjs --platform=${platform} --py=3.11 --flavor=install_only_stripped`);
  if (platform === "win-x64") {
    console.error("  powershell -ExecutionPolicy Bypass -File devtools/pbs/pbs-install-windows.ps1 -Platform win-x64");
  } else {
    console.error(`  bash devtools/pbs/pbs-install-unix.sh ${platform}`);
  }
  process.exit(1);
}

function runPythonProbe(pythonExe, code, cwd = process.cwd()) {
  try {
    execFileSync(pythonExe, ["-c", code], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, error: "" };
  } catch (e) {
    const errText = String(
      (e && e.stderr ? e.stderr.toString("utf8") : "")
      || (e && e.stdout ? e.stdout.toString("utf8") : "")
      || (e && e.message ? e.message : e)
    ).trim();
    return { ok: false, error: errText };
  }
}

function parseRequiredPyModules() {
  const reqPath = path.join("third_party", "midi2xml", "requirements.txt");
  if (!existsFile(reqPath)) return [];
  const raw = fs.readFileSync(reqPath, "utf8");
  const modules = [];
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const pkg = text.split(/[<>=!~\s\[]/, 1)[0].trim();
    if (!pkg) continue;
    // Known direct import names can diverge from package names.
    if (pkg.toLowerCase() === "music21") modules.push("music21");
  }
  return Array.from(new Set(modules));
}

function verifyPythonDeps(pythonExe) {
  const modules = parseRequiredPyModules();
  if (!modules.length) return;
  for (const mod of modules) {
    const probe = runPythonProbe(pythonExe, `import ${mod}; print(${mod}.__name__)`);
    if (!probe.ok) {
      fail(`Missing Python dependency '${mod}' in PBS runtime.\n${probe.error}`);
    }
  }
}

if (!existsFile(lockPath)) {
  fail(`Missing PBS lock file: ${lockPath}`);
}

if (!fs.existsSync(root)) {
  fail(`Missing PBS platform directory: ${root}`);
}

if (platform === "win-x64") {
  const candidates = findWindowsPythonExe(root);
  if (!candidates.length) {
    console.error(`No python.exe found under ${root} (max depth 2).`);
    const entries = listTopEntries(root);
    if (entries.length) console.error(`Top-level entries: ${entries.join(", ")}`);
    fail("PBS runtime not installed.");
  }
  verifyPythonDeps(candidates[0]);
  console.log(`OK: PBS runtime looks installed (${path.relative(process.cwd(), candidates[0])})`);
  process.exit(0);
}

const python3Path = path.join(root, "bin", "python3");
if (!existsExecutable(python3Path)) {
  const entries = listTopEntries(root);
  if (entries.length) console.error(`Top-level entries under ${root}: ${entries.join(", ")}`);
  fail(`Missing executable: ${python3Path}`);
}

verifyPythonDeps(python3Path);
console.log(`OK: PBS runtime looks installed (${python3Path})`);
