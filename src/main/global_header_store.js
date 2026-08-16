const GLOBAL_HEADER_MIGRATION_VERSION = 1;
const PORTABLE_MARKER_FILE = "ABCarus.portable";
let temporaryFileSequence = 0;

function isMissingFileError(error) {
  const code = error && error.code ? String(error.code) : "";
  return code === "ENOENT" || code === "ENOTDIR";
}

async function fileExists(fs, filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    return Boolean(stat && stat.isFile());
  } catch (error) {
    if (isMissingFileError(error)) return false;
    throw error;
  }
}

function temporaryFilePath(path, filePath) {
  temporaryFileSequence += 1;
  return path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${temporaryFileSequence}.tmp`,
  );
}

async function syncFile(fs, filePath) {
  let handle = null;
  try {
    handle = await fs.promises.open(filePath, "r");
    await handle.sync();
  } finally {
    if (handle) await handle.close();
  }
}

async function writeNewFileAtomically({ fs, path, filePath, text }) {
  const dirPath = path.dirname(filePath);
  const tempPath = temporaryFilePath(path, filePath);
  await fs.promises.mkdir(dirPath, { recursive: true });
  try {
    await fs.promises.writeFile(tempPath, text, { encoding: "utf8", flag: "wx" });
    await syncFile(fs, tempPath);
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    try { await fs.promises.unlink(tempPath); } catch {}
    throw error;
  }
}

async function migrateLegacyGlobalHeader({
  fs,
  path,
  headerPath,
  legacyText,
  migrationVersion = 0,
}) {
  if (!fs || !fs.promises) throw new TypeError("fs is required");
  if (!path || typeof path.dirname !== "function") throw new TypeError("path is required");
  const resolvedHeaderPath = String(headerPath || "").trim();
  if (!resolvedHeaderPath) throw new TypeError("headerPath is required");

  if (Number(migrationVersion) >= GLOBAL_HEADER_MIGRATION_VERSION) {
    return {
      migrationVersion: GLOBAL_HEADER_MIGRATION_VERSION,
      created: false,
      source: "already-migrated",
    };
  }

  if (await fileExists(fs, resolvedHeaderPath)) {
    return {
      migrationVersion: GLOBAL_HEADER_MIGRATION_VERSION,
      created: false,
      source: "existing-file",
    };
  }

  const text = String(legacyText == null ? "" : legacyText);
  if (!text.trim()) {
    return {
      migrationVersion: GLOBAL_HEADER_MIGRATION_VERSION,
      created: false,
      source: "empty",
    };
  }

  await writeNewFileAtomically({
    fs,
    path,
    filePath: resolvedHeaderPath,
    text,
  });
  return {
    migrationVersion: GLOBAL_HEADER_MIGRATION_VERSION,
    created: true,
    source: "legacy",
  };
}

function resolveGlobalHeaderPath({
  path,
  userDataPath,
  executablePath,
  portableExecutableDir,
  portableMarkerPresent = false,
}) {
  if (!path || typeof path.join !== "function") throw new TypeError("path is required");
  const portableDir = String(portableExecutableDir || "").trim();
  if (portableDir) return path.join(portableDir, "user_settings.abc");
  if (portableMarkerPresent) {
    const executable = String(executablePath || "").trim();
    if (!executable) throw new TypeError("executablePath is required for portable marker mode");
    return path.join(path.dirname(executable), "user_settings.abc");
  }
  const profileDir = String(userDataPath || "").trim();
  if (!profileDir) throw new TypeError("userDataPath is required for installed mode");
  return path.join(profileDir, "user_settings.abc");
}

module.exports = {
  GLOBAL_HEADER_MIGRATION_VERSION,
  PORTABLE_MARKER_FILE,
  migrateLegacyGlobalHeader,
  resolveGlobalHeaderPath,
};
