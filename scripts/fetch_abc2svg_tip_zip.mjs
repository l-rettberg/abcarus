#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import https from "https";

const DEFAULT_URL = "https://chiselapp.com/user/moinejf/repository/abc2svg/zip/abc2svg-tip.zip?uuid=tip";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function nowUtcCompact() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes()
  )}${pad(d.getUTCSeconds())}Z`;
}

function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    outDir: "third_party/_upd",
    name: "",
    force: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--url") args.url = String(argv[++i] || "").trim() || DEFAULT_URL;
    else if (a === "--out-dir") args.outDir = String(argv[++i] || "").trim() || "third_party/_upd";
    else if (a === "--name") args.name = String(argv[++i] || "").trim();
    else if (a === "--force") args.force = true;
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function pickClient(urlString) {
  const u = new URL(urlString);
  return u.protocol === "http:" ? http : https;
}

function download(urlString, maxRedirects = 6) {
  return new Promise((resolve, reject) => {
    const client = pickClient(urlString);
    const req = client.get(urlString, (res) => {
      const code = Number(res.statusCode) || 0;
      if ([301, 302, 303, 307, 308].includes(code)) {
        if (maxRedirects <= 0) {
          res.resume();
          reject(new Error(`Too many redirects while downloading: ${urlString}`));
          return;
        }
        const loc = String(res.headers.location || "").trim();
        if (!loc) {
          res.resume();
          reject(new Error(`Redirect without Location header: ${urlString}`));
          return;
        }
        const next = new URL(loc, urlString).toString();
        res.resume();
        resolve(download(next, maxRedirects - 1));
        return;
      }
      if (code < 200 || code >= 300) {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
          if (body.length > 4096) body = body.slice(0, 4096);
        });
        res.on("end", () => reject(new Error(`HTTP ${code} while downloading: ${urlString}\n${body}`)));
        return;
      }
      resolve({ res, finalUrl: urlString });
    });
    req.on("error", reject);
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(
      "Usage: node scripts/fetch_abc2svg_tip_zip.mjs [--url <tip-zip-url>] [--out-dir third_party/_upd] [--name <file.zip>] [--force]"
    );
    process.exit(0);
  }

  const root = repoRoot();
  const outDirAbs = path.resolve(root, args.outDir);
  ensureDir(outDirAbs);

  const fileName = args.name || `abc2svg-tip-${nowUtcCompact()}.zip`;
  const outPath = path.join(outDirAbs, fileName);
  if (fs.existsSync(outPath) && !args.force) {
    throw new Error(`File already exists: ${path.relative(root, outPath)} (use --force or --name)`);
  }
  const tmpPath = `${outPath}.tmp-${process.pid}-${Date.now()}`;

  const { res } = await download(args.url);
  const hash = crypto.createHash("sha256");
  let size = 0;

  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(tmpPath);
    res.on("data", (chunk) => {
      size += chunk.length;
      hash.update(chunk);
    });
    res.on("error", reject);
    ws.on("error", reject);
    ws.on("finish", resolve);
    res.pipe(ws);
  });

  const firstBytes = fs.readFileSync(tmpPath, { encoding: null }).subarray(0, 2);
  if (!(firstBytes[0] === 0x50 && firstBytes[1] === 0x4b)) {
    fs.rmSync(tmpPath, { force: true });
    throw new Error("Downloaded file does not look like a ZIP (missing PK header).");
  }

  fs.renameSync(tmpPath, outPath);

  const rel = path.relative(root, outPath);
  const sha = hash.digest("hex");
  console.log("abc2svg tip downloaded:");
  console.log(`- file: ${rel}`);
  console.log(`- size: ${size} bytes`);
  console.log(`- sha256: ${sha}`);
  console.log("");
  console.log("Next:");
  console.log(`npm run thirdparty:review -- --candidate ${rel} --abc2svg-build`);
  console.log(`npm run abc2svg:upgrade -- --zip ${rel} --apply`);
}

main().catch((e) => {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
});

