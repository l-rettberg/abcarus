import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import semver from "semver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");
const changelogPath = path.join(root, "CHANGELOG.md");

const bumpType = process.argv[2];
if (!["patch", "minor", "major"].includes(bumpType)) {
  console.error("Usage: node scripts/release.mjs <patch|minor|major>");
  process.exit(1);
}

function runGit(args) {
  return String(execFileSync("git", args, { cwd: root })).trim();
}

function tagExists(tag) {
  try {
    runGit(["rev-parse", "--verify", `refs/tags/${tag}`]);
    return true;
  } catch {
    return false;
  }
}

function readUnreleasedNotes(changelog) {
  const header = "## [Unreleased]";
  const idx = changelog.indexOf(header);
  if (idx === -1) throw new Error("CHANGELOG.md is missing the Unreleased section.");
  const headerEnd = idx + header.length;
  const nextHeaderIdx = changelog.indexOf("\n## [", headerEnd);
  const body = changelog.slice(headerEnd, nextHeaderIdx === -1 ? changelog.length : nextHeaderIdx)
    .replace(/^\s+/, "")
    .replace(/\s+$/, "");
  if (!body) throw new Error("CHANGELOG.md Unreleased section is empty. Add release notes first.");
  return { header, idx, headerEnd, nextHeaderIdx, body };
}

const status = runGit(["status", "--porcelain"]);
if (status) {
  console.error("Git working tree is not clean. Commit or stash changes first.");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const current = String(pkg.version || "");
const next = semver.inc(current, bumpType);
if (!next) {
  console.error(`Failed to bump version from ${current}.`);
  process.exit(1);
}
const nextTag = `v${next}`;
if (tagExists(nextTag)) {
  console.error(`Tag ${nextTag} already exists. Resolve the release state before continuing.`);
  process.exit(1);
}

let changelog;
let unreleased;
try {
  changelog = fs.readFileSync(changelogPath, "utf8");
  unreleased = readUnreleasedNotes(changelog);
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}

if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  const lockRootVersion = lock.packages && lock.packages[""] ? String(lock.packages[""].version || "") : current;
  if (String(lock.version || "") !== current || lockRootVersion !== current) {
    console.error("package.json and package-lock.json versions are out of sync. Fix them before releasing.");
    process.exit(1);
  }
}

console.log("Running release preflight...");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
execFileSync(npmCommand, ["run", "-s", "test:release-preflight"], { cwd: root, stdio: "inherit" });

pkg.version = next;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  lock.version = next;
  if (lock.packages && lock.packages[""]) {
    lock.packages[""].version = next;
  }
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

const today = new Date().toISOString().slice(0, 10);
const entry = `\n\n## [${next}] - ${today}\n${unreleased.body}\n`;
const updated =
  changelog.slice(0, unreleased.headerEnd) +
  "\n\n" +
  entry +
  (unreleased.nextHeaderIdx === -1 ? "" : changelog.slice(unreleased.nextHeaderIdx));
fs.writeFileSync(changelogPath, updated);

runGit(["add", "package.json", "package-lock.json", "CHANGELOG.md"]);
runGit(["commit", "-m", `chore(release): v${next}`]);
runGit(["tag", "-a", nextTag, "-m", nextTag]);

const taggedCommit = runGit(["rev-parse", `${nextTag}^{}`]);
const headCommit = runGit(["rev-parse", "HEAD"]);
if (taggedCommit !== headCommit) {
  console.error(`${nextTag} does not point to the release commit. Stop before pushing.`);
  process.exit(1);
}

console.log(`Release prepared: v${next}`);
console.log("Next steps:");
console.log("  git push");
console.log(`  git push origin v${next}`);
console.log("  Run the publish script to sync CHANGELOG notes into the GitHub Release body.");
