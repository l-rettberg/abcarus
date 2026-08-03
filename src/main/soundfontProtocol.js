const crypto = require("crypto");
const { Readable } = require("stream");

const SOUNDFONT_SCHEME = "abcarus-sf2";
const MAX_REGISTERED_SOUNDFONTS = 16;

function registerSoundfontScheme(protocol) {
  protocol.registerSchemesAsPrivileged([{
    scheme: SOUNDFONT_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  }]);
}

function createSoundfontProtocol({ protocol, fs, path }) {
  const entries = new Map();
  let registered = false;

  function response(status, body, headers = {}) {
    return new Response(body, { status, headers });
  }

  async function handleRequest(request) {
    if (!request || String(request.method || "GET").toUpperCase() !== "GET") {
      return response(405, "Method not allowed");
    }
    let token = "";
    try {
      const parsed = new URL(request.url);
      token = path.basename(parsed.pathname).replace(/\.sf2$/i, "");
    } catch {
      return response(400, "Invalid soundfont URL");
    }
    const filePath = entries.get(token);
    if (!filePath) return response(404, "Soundfont not found");
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) return response(404, "Soundfont not found");
      const stream = Readable.toWeb(fs.createReadStream(filePath));
      return response(200, stream, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(stat.size),
        "Cache-Control": "no-store",
      });
    } catch {
      return response(404, "Soundfont not found");
    }
  }

  function register() {
    if (registered) return;
    protocol.handle(SOUNDFONT_SCHEME, handleRequest);
    registered = true;
  }

  async function exposeFile(filePath) {
    const raw = String(filePath || "").trim();
    if (!raw || !path.isAbsolute(raw) || !raw.toLowerCase().endsWith(".sf2")) {
      throw new Error("Invalid external soundfont path.");
    }
    const resolved = await fs.promises.realpath(raw);
    const stat = await fs.promises.stat(resolved);
    if (!stat.isFile()) throw new Error("Soundfont file was not found.");

    const token = crypto.randomBytes(18).toString("hex");
    entries.set(token, resolved);
    while (entries.size > MAX_REGISTERED_SOUNDFONTS) {
      entries.delete(entries.keys().next().value);
    }
    return `${SOUNDFONT_SCHEME}://local/${token}.sf2`;
  }

  return {
    register,
    exposeFile,
    handleRequest,
  };
}

module.exports = {
  SOUNDFONT_SCHEME,
  createSoundfontProtocol,
  registerSoundfontScheme,
};
