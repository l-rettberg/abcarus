import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...opts,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    const e = new Error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}`);
    e.exitCode = res.status;
    throw e;
  }
  return res;
}

function runCapture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: false,
    ...opts,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    const e = new Error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}`);
    e.exitCode = res.status;
    e.stdout = res.stdout;
    e.stderr = res.stderr;
    throw e;
  }
  return String(res.stdout || "").trim();
}

function fail(message) {
  console.error(`[publish] ${message}`);
  process.exit(1);
}

function ensureGhAvailable() {
  try {
    runCapture("gh", ["--version"]);
  } catch {
    fail("GitHub CLI (`gh`) is required to publish release notes to the GitHub Release body.");
  }
}

function getVersion() {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  return pkg && pkg.version ? String(pkg.version) : null;
}

function getOriginRepoSlug() {
  const url = runCapture("git", ["remote", "get-url", "origin"]);
  const sshMatch = url.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/i);
  if (sshMatch) return sshMatch[1];
  fail(`Could not derive GitHub repository slug from origin URL: ${url}`);
}

function assertOnMaster() {
  const branch = runCapture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "master") fail(`Refusing to publish from '${branch}'. Switch to 'master'.`);
}

function assertClean() {
  const porcelain = runCapture("git", ["status", "--porcelain"]);
  if (porcelain) fail("Working tree is not clean. Commit/stash changes first.");
}

function assertOriginMasterSynced() {
  // Ensure origin exists (avoid accidental pushes to wrong remote).
  const remotes = runCapture("git", ["remote"]);
  const hasOrigin = remotes.split("\n").map((s) => s.trim()).filter(Boolean).includes("origin");
  if (!hasOrigin) fail("Remote 'origin' not found.");

  // Make sure we compare against the latest remote state.
  run("git", ["fetch", "origin", "master", "--tags"]);

  const local = runCapture("git", ["rev-parse", "master"]);
  const remote = runCapture("git", ["rev-parse", "origin/master"]);
  if (local !== remote) {
    const base = runCapture("git", ["merge-base", "master", "origin/master"]);
    if (base === local) fail("Local master is behind origin/master. Pull first.");
    if (base === remote) fail("Local master is ahead of origin/master. Push (or reset) first.");
    fail("Local master has diverged from origin/master. Resolve before publishing.");
  }
}

function assertUnreleasedNotEmpty() {
  // Guardrail so we don’t cut empty releases.
  const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
  const m = changelog.match(/## \[Unreleased\]\s*([\s\S]*?)\n## \[/);
  if (!m) fail("Could not parse CHANGELOG.md Unreleased section.");
  const body = String(m[1] || "").trim();
  if (!body) fail("CHANGELOG.md Unreleased section is empty. Add release notes first.");
}

function extractReleaseNotes(version) {
  const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
  const escapedVersion = String(version).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^## \\[${escapedVersion}\\] - .*$([\\s\\S]*?)(?=^## \\[|\\Z)`, "m");
  const match = changelog.match(re);
  if (!match) fail(`Could not find CHANGELOG entry for ${version}.`);
  const notes = String(match[1] || "").trim();
  if (!notes) fail(`CHANGELOG entry for ${version} is empty.`);
  return `${notes}\n`;
}

function upsertGitHubRelease(tag, version) {
  ensureGhAvailable();
  const repo = getOriginRepoSlug();
  const notes = extractReleaseNotes(version);
  const notesFile = path.join(os.tmpdir(), `abcarus-release-notes-${process.pid}-${version}.md`);
  fs.writeFileSync(notesFile, notes, "utf8");
  try {
    try {
      runCapture("gh", ["release", "view", tag, "-R", repo]);
      run("gh", ["release", "edit", tag, "-R", repo, "--title", tag, "--notes-file", notesFile]);
      console.log(`[publish] Updated GitHub Release notes for ${tag}`);
      return;
    } catch {}
    run("gh", ["release", "create", tag, "-R", repo, "--title", tag, "--notes-file", notesFile]);
    console.log(`[publish] Created GitHub Release with notes for ${tag}`);
  } finally {
    try { fs.unlinkSync(notesFile); } catch {}
  }
}

function usage() {
  console.log("Usage: node scripts/publish.mjs patch|minor|major");
}

function main() {
  const kind = process.argv[2] ? String(process.argv[2]) : "";
  if (!["patch", "minor", "major"].includes(kind)) {
    usage();
    process.exit(2);
  }

  assertOnMaster();
  assertClean();
  assertOriginMasterSynced();
  assertUnreleasedNotEmpty();

  const before = getVersion();
  if (!before) fail("Could not read version from package.json.");

  const tagsBefore = new Set(
    runCapture("git", ["tag", "--list"])
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  run("node", ["scripts/release.mjs", kind]);

  const after = getVersion();
  if (!after) fail("Could not read version from package.json after release.");
  if (after === before) fail(`Version did not change (still ${after}). Aborting.`);

  const tag = `v${after}`;
  // Release script should have created the tag; ensure it exists.
  run("git", ["rev-parse", `${tag}^{}`]);
  if (tagsBefore.has(tag)) {
    fail(`Tag already existed before publishing: ${tag}`);
  }

  run("git", ["push", "origin", "master"]);
  run("git", ["push", "origin", tag]);
  upsertGitHubRelease(tag, after);

  console.log(`[publish] Done: ${tag}`);
}

try {
  main();
} catch (e) {
  fail(e && e.message ? e.message : String(e));
}
