#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const env = { ...process.env };
env.ABCARUS_DEV_UI_SMOKE = "1";
env.ABCARUS_DEV_NO_MAXIMIZE = "1";
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ["."], {
  cwd: repoRoot,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(Number.isFinite(code) ? code : 1);
});

child.on("error", () => {
  process.exit(1);
});
