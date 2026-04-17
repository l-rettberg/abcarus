import { readFile } from "node:fs/promises";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const build = packageJson && packageJson.build ? packageJson.build : {};
  const associations = Array.isArray(build.fileAssociations) ? build.fileAssociations : [];
  const abcAssoc = associations.find((it) => String(it?.ext || "").toLowerCase() === "abc");
  assert(abcAssoc, "Missing electron-builder file association for .abc");
  assert(
    String(abcAssoc.mimeType || "").toLowerCase() === "text/x-abc",
    "Expected .abc mimeType to be text/x-abc"
  );

  const appImageScript = await readFile("scripts/build_appimage.sh", "utf8");
  assert(
    appImageScript.includes("MimeType=text/x-abc;application/x-abc;"),
    "AppImage desktop entry must include text/x-abc and application/x-abc MimeType values"
  );
}

main().catch((err) => {
  process.stderr.write(`check_file_associations.mjs failed: ${err?.stack || err}\n`);
  process.exitCode = 1;
});

