#!/usr/bin/env node
import { execFileSync } from "node:child_process";

function gitTrackedFiles() {
  const out = execFileSync("git", ["ls-files", "third_party"], { encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean);
}

const files = gitTrackedFiles();
const failures = [];

const forbiddenPatterns = [
  { re: /^third_party\/_upd\//, reason: "download/update staging must stay local" },
  { re: /(^|\/)\.ninja_/, reason: "local build state must not be vendored" },
  { re: /(^|\/)__pycache__(\/|$)/, reason: "Python cache must stay local" },
  { re: /\.pyc$/, reason: "Python bytecode cache must stay local" },
  { re: /\.log$/, reason: "logs must stay local" },
  { re: /\.tmp$/, reason: "temporary files must stay local" },
  { re: /\.bak$/, reason: "backup files must stay local" },
  { re: /^third_party\/codemirror\/build\//, reason: "ABCarus-owned build recipe belongs under scripts/codemirror" },
  { re: /^third_party\/codemirror\/BUILD\.md$/, reason: "ABCarus-owned build documentation belongs under docs/vendor" },
];

for (const file of files) {
  for (const rule of forbiddenPatterns) {
    if (rule.re.test(file)) failures.push(`${file}: ${rule.reason}`);
  }
}

if (failures.length) {
  console.error("% FAIL third-party boundary check");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("% PASS third-party boundary check");
