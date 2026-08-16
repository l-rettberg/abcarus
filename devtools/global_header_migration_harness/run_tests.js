#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const os = require("os");
const path = require("path");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function exists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function withTempDir(run) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "abcarus-global-header-migration-"));
  try {
    await run(dir);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const modulePath = path.resolve(__dirname, "../../src/main/global_header_store.js");
  let globalHeaderStore;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    globalHeaderStore = require(modulePath);
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      fail("global_header_store.js is not implemented yet (expected red migration contract)");
    }
    throw error;
  }

  const {
    GLOBAL_HEADER_MIGRATION_VERSION,
    PORTABLE_MARKER_FILE,
    migrateLegacyGlobalHeader,
    resolveGlobalHeaderPath,
  } = globalHeaderStore;

  assert(
    Number.isInteger(GLOBAL_HEADER_MIGRATION_VERSION) && GLOBAL_HEADER_MIGRATION_VERSION >= 1,
    "migration version must be a positive integer"
  );
  assert(typeof migrateLegacyGlobalHeader === "function", "migrateLegacyGlobalHeader export is required");
  assert(PORTABLE_MARKER_FILE === "ABCarus.portable", "portable marker filename must remain stable");
  assert(typeof resolveGlobalHeaderPath === "function", "resolveGlobalHeaderPath export is required");

  {
    const resolved = resolveGlobalHeaderPath({
      path: path.win32,
      userDataPath: "C:\\Users\\Ann\\AppData\\Roaming\\ABCarus",
      executablePath: "C:\\Portable\\ABCarus.exe",
      portableExecutableDir: "D:\\Music\\ABCarus",
      portableMarkerPresent: false,
    });
    assert(
      resolved === "D:\\Music\\ABCarus\\user_settings.abc",
      "portable executable directory must override installed userData"
    );
  }

  {
    const resolved = resolveGlobalHeaderPath({
      path: path.win32,
      userDataPath: "C:\\Users\\Ann\\AppData\\Roaming\\ABCarus",
      executablePath: "D:\\ABCarus\\ABCarus.exe",
      portableMarkerPresent: true,
    });
    assert(
      resolved === "D:\\ABCarus\\user_settings.abc",
      "Windows unpacked marker must resolve beside the executable"
    );
  }

  {
    const resolved = resolveGlobalHeaderPath({
      path: path.posix,
      userDataPath: "/home/user/.config/ABCarus",
      executablePath: "/opt/ABCarus/ABCarus",
      portableMarkerPresent: true,
    });
    assert(
      resolved === "/opt/ABCarus/user_settings.abc",
      "Linux portable marker must resolve beside the executable"
    );
  }

  {
    const resolved = resolveGlobalHeaderPath({
      path: path.posix,
      userDataPath: "/home/user/.config/ABCarus",
      executablePath: "/usr/bin/abcarus",
      portableMarkerPresent: false,
    });
    assert(
      resolved === "/home/user/.config/ABCarus/user_settings.abc",
      "installed builds must resolve under userData"
    );
  }

  await withTempDir(async (dir) => {
    const headerPath = path.join(dir, "user_settings.abc");
    const existingText = "%%MIDI program 24\n";
    await fs.promises.writeFile(headerPath, existingText, "utf8");

    const result = await migrateLegacyGlobalHeader({
      fs,
      path,
      headerPath,
      legacyText: "%%MIDI program 1\n",
      migrationVersion: 0,
    });

    assert(await fs.promises.readFile(headerPath, "utf8") === existingText, "existing header must win over legacy text");
    assert(result && result.migrationVersion === GLOBAL_HEADER_MIGRATION_VERSION, "existing header must complete migration");
  });

  await withTempDir(async (dir) => {
    const headerPath = path.join(dir, "user_settings.abc");
    const legacyText = "%%gchordfont MuseJazz Text 20\n%%MIDI program 1\n% Armenian: \u0565\u0580\u0561\u056a\u0577\u057f\u0578\u0582\u0569\u0575\u0578\u0582\u0576\n";
    let wroteDestinationDirectly = false;
    let renamedIntoDestination = false;
    const trackedPromises = new Proxy(fs.promises, {
      get(target, property) {
        if (property === "writeFile") {
          return async (filePath, ...args) => {
            if (path.resolve(filePath) === path.resolve(headerPath)) wroteDestinationDirectly = true;
            return target.writeFile(filePath, ...args);
          };
        }
        if (property === "rename") {
          return async (fromPath, toPath) => {
            if (path.resolve(toPath) === path.resolve(headerPath)) renamedIntoDestination = true;
            return target.rename(fromPath, toPath);
          };
        }
        const value = target[property];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const trackedFs = { ...fs, promises: trackedPromises };

    const result = await migrateLegacyGlobalHeader({
      fs: trackedFs,
      path,
      headerPath,
      legacyText,
      migrationVersion: 0,
    });

    assert(await fs.promises.readFile(headerPath, "utf8") === legacyText, "legacy text must be preserved exactly");
    assert(result && result.migrationVersion === GLOBAL_HEADER_MIGRATION_VERSION, "legacy creation must complete migration");
    assert(!wroteDestinationDirectly, "migration must not write directly to the destination file");
    assert(renamedIntoDestination, "migration must atomically rename a temporary file into place");
    assert((await fs.promises.readdir(dir)).join("\n") === "user_settings.abc", "migration must not leave temporary files");
  });

  await withTempDir(async (dir) => {
    const headerPath = path.join(dir, "user_settings.abc");
    const result = await migrateLegacyGlobalHeader({
      fs,
      path,
      headerPath,
      legacyText: "  \n\t",
      migrationVersion: 0,
    });

    assert(!(await exists(headerPath)), "empty legacy text must not create a header file");
    assert(result && result.migrationVersion === GLOBAL_HEADER_MIGRATION_VERSION, "empty legacy state must complete migration");
  });

  await withTempDir(async (dir) => {
    const headerPath = path.join(dir, "user_settings.abc");
    await fs.promises.writeFile(headerPath, "", "utf8");

    const result = await migrateLegacyGlobalHeader({
      fs,
      path,
      headerPath,
      legacyText: "%%MIDI program 1\n",
      migrationVersion: 0,
    });

    assert(await fs.promises.readFile(headerPath, "utf8") === "", "an existing empty header must remain authoritative");
    assert(result && result.migrationVersion === GLOBAL_HEADER_MIGRATION_VERSION, "existing empty header must complete migration");
  });

  await withTempDir(async (dir) => {
    const headerPath = path.join(dir, "user_settings.abc");
    const legacyText = "%%MIDI program 1\n";
    const first = await migrateLegacyGlobalHeader({
      fs,
      path,
      headerPath,
      legacyText,
      migrationVersion: 0,
    });
    assert(first && first.migrationVersion === GLOBAL_HEADER_MIGRATION_VERSION, "first migration must return its marker version");

    await fs.promises.rm(headerPath);
    const second = await migrateLegacyGlobalHeader({
      fs,
      path,
      headerPath,
      legacyText,
      migrationVersion: first.migrationVersion,
    });

    assert(!(await exists(headerPath)), "completed migration must not resurrect a deleted header file");
    assert(second && second.migrationVersion === GLOBAL_HEADER_MIGRATION_VERSION, "repeated migration must remain complete");
  });

  console.log("global header migration harness: all tests passed");
}

main().catch((error) => {
  console.error("global header migration harness: failed");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
