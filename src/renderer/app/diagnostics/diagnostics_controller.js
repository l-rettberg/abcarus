function perfNowMs() {
  try {
    return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  } catch {
    return Date.now();
  }
}

function sanitizeDumpSlug(raw) {
  const base = String(raw || "").trim().toLowerCase() || "event";
  const cleaned = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "event";
}

export function createDiagnosticsController({
  api,
  storage,
  autoDumpDefaultEnabled = false,
  autoWcDumpDefaultEnabled = false,
  getAutoWcDumpLimit = () => 12,
  getSuggestedDebugDumpDir = () => "",
  writeDebugDumpSnapshotToPath = async () => ({ ok: false }),
  nowCompactStamp = () => new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14),
  safeString = (value, maxLen = 250000) => {
    const s = String(value == null ? "" : value);
    return s.length > maxLen ? `${s.slice(0, maxLen)}\n…[truncated ${s.length - maxLen} chars]` : s;
  },
} = {}) {
  const debugLogBuffer = [];
  const recentActions = [];
  const startupPerfT0Ms = perfNowMs();
  let autoDumpLastAtMs = 0;
  let autoDumpSeq = 0;
  let autoWcDumpLastAtMs = 0;
  let autoWcDumpSeq = 0;

  try {
    const savedSeq = Number(storage && storage.getItem ? storage.getItem("abcarusWcDumpSeq") || 0 : 0);
    if (Number.isFinite(savedSeq) && savedSeq > 0) autoWcDumpSeq = savedSeq;
  } catch {}

  const recordDebugLog = (level, args, stackOverride) => {
    if (window.__abcarusDebugLog !== true) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      message: Array.isArray(args) ? args.map((a) => {
        if (a instanceof Error) return a.stack || a.message || String(a);
        try { return typeof a === "string" ? a : JSON.stringify(a); } catch { return String(a); }
      }).join(" ") : String(args || ""),
      stack: stackOverride || null,
    };
    debugLogBuffer.push(entry);
    if (debugLogBuffer.length > 300) debugLogBuffer.splice(0, debugLogBuffer.length - 300);
  };

  const recordRecentAction = (type, details) => {
    try {
      const entry = {
        ts: new Date().toISOString(),
        type: String(type || "event"),
        details: details && typeof details === "object" ? details : (details != null ? { value: String(details) } : null),
      };
      recentActions.push(entry);
      if (recentActions.length > 200) recentActions.splice(0, recentActions.length - 200);
    } catch {}
  };

  const isIntonationPerfEnabled = () => {
    try {
      return window.__abcarusPerfIntonation === true;
    } catch {
      return false;
    }
  };

  const logIntonationPerf = (label, data) => {
    if (!isIntonationPerfEnabled()) return;
    try {
      if (data !== undefined) console.log(`[perf:intonation] ${label}`, data);
      else console.log(`[perf:intonation] ${label}`);
    } catch {}
  };

  const isStartupPerfEnabled = () => {
    try {
      return (api && api.startupPerfEnabled === true) || window.__abcarusPerfStartup === true;
    } catch {
      return false;
    }
  };

  const logStartupPerf = (label, data) => {
    if (!isStartupPerfEnabled()) return;
    try {
      const ms = Math.round(perfNowMs() - startupPerfT0Ms);
      if (data !== undefined) console.log(`[startup:renderer] +${ms}ms ${label}`, data);
      else console.log(`[startup:renderer] +${ms}ms ${label}`);
    } catch {}
  };

  const isFilePerfEnabled = () => {
    try {
      return window.__abcarusPerfFiles === true || isStartupPerfEnabled();
    } catch {
      return false;
    }
  };

  const logFilePerf = (label, data) => {
    if (!isFilePerfEnabled()) return;
    try {
      if (data !== undefined) console.log(`[perf:file] ${label}`, data);
      else console.log(`[perf:file] ${label}`);
    } catch {}
  };

  const isRenderPerfEnabled = () => {
    try {
      return window.__abcarusPerfRender === true || isStartupPerfEnabled();
    } catch {
      return false;
    }
  };

  const logRenderPerf = (label, data) => {
    if (!isRenderPerfEnabled()) return;
    try {
      if (data !== undefined) console.log(`[perf:render] ${label}`, data);
      else console.log(`[perf:render] ${label}`);
    } catch {}
  };

  const abbreviatePathForLog = (fullPath, tailSegments = 3) => {
    if (!fullPath) return "";
    const raw = String(fullPath);
    const sep = raw.includes("\\") ? "\\" : "/";
    const parts = raw.split(/[\\/]+/).filter(Boolean);
    if (parts.length <= tailSegments) return raw;
    return ["...", ...parts.slice(-tailSegments)].join(sep);
  };

  const reportStartupStatus = (text) => {
    try {
      if (api && typeof api.reportStartupStatus === "function") {
        api.reportStartupStatus(String(text || "")).catch(() => {});
      }
    } catch {}
  };

  const shouldAutoDump = () => {
    if (window.__abcarusAutoDumpOnError === true) return true;
    if (window.__abcarusAutoDumpOnError === false) return false;
    return Boolean(autoDumpDefaultEnabled);
  };

  const shouldAutoWcDump = () => {
    if (window.__abcarusAutoWcDump === true) return true;
    if (window.__abcarusAutoWcDump === false) return false;
    return Boolean(autoWcDumpDefaultEnabled());
  };

  const scheduleAutoDump = (reason, extra) => {
    if (!shouldAutoDump()) return;
    const now = perfNowMs();
    if (now - autoDumpLastAtMs < 6000) return;
    autoDumpLastAtMs = now;
    const seq = (autoDumpSeq += 1);
    const slug = sanitizeDumpSlug(reason);
    const fileName = `abcarus-auto-${nowCompactStamp()}-${slug}-${seq}.json`;
    const dir = getSuggestedDebugDumpDir();
    if (!dir || !api || typeof api.mkdirp !== "function" || typeof api.pathJoin !== "function") return;
    const target = api.pathJoin(dir, fileName);
    api.mkdirp(dir).then(() => {
      writeDebugDumpSnapshotToPath(target, { silent: true, reason: `${slug}${extra ? ` ${safeString(String(extra || ""), 2000)}` : ""}` }).catch(() => {});
    }).catch(() => {});
  };

  const scheduleAutoWcDump = (reason, extra) => {
    if (!shouldAutoWcDump()) return;
    const now = perfNowMs();
    if (now - autoWcDumpLastAtMs < 1500) return;
    autoWcDumpLastAtMs = now;
    const seq = (autoWcDumpSeq += 1);
    try { if (storage && storage.setItem) storage.setItem("abcarusWcDumpSeq", String(autoWcDumpSeq)); } catch {}
    const limit = getAutoWcDumpLimit();
    const idx = ((seq - 1) % limit) + 1;
    const slug = sanitizeDumpSlug(reason);
    const fileName = `abcarus-wc-${idx}.json`;
    const dir = getSuggestedDebugDumpDir();
    if (!dir || !api || typeof api.mkdirp !== "function" || typeof api.pathJoin !== "function") return;
    const target = api.pathJoin(dir, fileName);
    const reasonText = `${slug}${extra ? ` ${safeString(String(extra || ""), 2000)}` : ""}`;
    api.mkdirp(dir).then(() => {
      writeDebugDumpSnapshotToPath(target, { silent: true, reason: `auto-wc ${reasonText}` }).catch(() => {});
    }).catch(() => {});
  };

  const installConsoleCapture = () => {
    if (window.__abcarusDebugLog !== true) return;
    if (window.__abcarusConsoleWrapped) return;
    window.__abcarusConsoleWrapped = true;
    const origErr = console.error.bind(console);
    const origWarn = console.warn.bind(console);
    console.error = (...args) => {
      try { recordDebugLog("error", args); } catch {}
      origErr(...args);
    };
    console.warn = (...args) => {
      try { recordDebugLog("warn", args); } catch {}
      origWarn(...args);
    };
    window.addEventListener("error", (e) => {
      try {
        recordDebugLog("window.error", [e && e.message ? e.message : "Window error"], e && e.error ? (e.error.stack || e.error.message) : null);
      } catch {}
    });
    window.addEventListener("unhandledrejection", (e) => {
      try {
        const reason = e && e.reason ? e.reason : null;
        recordDebugLog("unhandledrejection", [reason && reason.message ? reason.message : String(reason || "Unhandled rejection")], reason && reason.stack ? reason.stack : null);
      } catch {}
    });
  };

  return {
    debugLogBuffer,
    recentActions,
    abbreviatePathForLog,
    installConsoleCapture,
    isFilePerfEnabled,
    isIntonationPerfEnabled,
    isRenderPerfEnabled,
    isStartupPerfEnabled,
    logFilePerf,
    logIntonationPerf,
    logRenderPerf,
    logStartupPerf,
    perfNowMs,
    recordDebugLog,
    recordRecentAction,
    reportStartupStatus,
    scheduleAutoDump,
    scheduleAutoWcDump,
  };
}
