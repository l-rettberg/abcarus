#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const packageJson = JSON.parse(read("package.json"));
const windowsTargets = packageJson.build?.win?.target || [];
assert(windowsTargets.includes("portable"), "Windows portable target is required");

const appImageScript = read("scripts/build_appimage.sh");
assert(
  appImageScript.includes('[[ -f "${HERE}/ABCarus.portable" ]]')
    && appImageScript.includes('export ABCARUS_PORTABLE_DIR="${HERE}"'),
  "Linux AppRun must activate portable settings only when ABCarus.portable exists",
);

const workflow = read(".github/workflows/release-assets.yml");
const buildAppImage = workflow.indexOf("name: Build AppImage");
const linuxMarker = workflow.indexOf("touch dist/appimage/AppDir/ABCarus.portable");
const linuxArchive = workflow.indexOf("ABCarus-x86_64-portable.tar.gz");
assert(buildAppImage >= 0 && linuxMarker > buildAppImage, "Linux marker must be added after the AppImage is built");
assert(linuxArchive > linuxMarker, "Linux marker must be added before the portable folder archive");
assert(
  workflow.includes('New-Item -ItemType File -Force -Path (Join-Path $src "ABCarus.portable")'),
  "Windows unpacked build must include ABCarus.portable beside ABCarus.exe",
);

console.log("global header packaging check: passed");
