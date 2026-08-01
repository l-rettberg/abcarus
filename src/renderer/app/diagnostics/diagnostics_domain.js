import { createDebugDumpFeature } from "./debug_dump_feature.js";
import { createDiagnosticsController } from "./diagnostics_controller.js";
import { createDevAutoscrollDemo } from "./dev_autoscroll_demo.js";
import { installDevUiSmokeHook } from "./dev_ui_smoke_hook.js";

function readDevConfig(api) {
  try {
    return (api && typeof api.getDevConfig === "function") ? (api.getDevConfig() || {}) : {};
  } catch {
    return {};
  }
}

function createDiagnosticsDomain({
  api,
  windowRef = typeof window !== "undefined" ? window : null,
  documentRef = typeof document !== "undefined" ? document : null,
  storage = typeof localStorage !== "undefined" ? localStorage : null,
  debugDumpHost = {},
  uiSmokeHost = {},
  devAutoscrollHost = {},
  getLatestSettings = () => null,
  clampInt = (value, min, max, fallback) => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  },
} = {}) {
  const devConfig = readDevConfig(api);
  const autoDumpDefaultEnabled = String(devConfig.ABCARUS_DEV_AUTO_DUMP || "") === "1";
  const autoDumpDirOverride = String(devConfig.ABCARUS_DEV_AUTO_DUMP_DIR || "");

  const debugDumpFeature = createDebugDumpFeature({
    ...debugDumpHost,
    api,
    windowRef,
    documentRef,
    getAutoDumpDirOverride: () => autoDumpDirOverride,
  });

  function getAutoWcDumpLimit() {
    const latestSettings = getLatestSettings();
    const raw = latestSettings && Number.isFinite(Number(latestSettings.autoWcDumpsLimit))
      ? Number(latestSettings.autoWcDumpsLimit)
      : 12;
    return clampInt(raw, 3, 50, 12);
  }

  const diagnosticsController = createDiagnosticsController({
    api,
    storage,
    autoDumpDefaultEnabled,
    autoWcDumpDefaultEnabled: () => {
      const latestSettings = getLatestSettings();
      return Boolean(latestSettings && latestSettings.autoWcDumpsEnabled);
    },
    getAutoWcDumpLimit,
    getSuggestedDebugDumpDir: debugDumpFeature.getSuggestedDir,
    writeDebugDumpSnapshotToPath: debugDumpFeature.writeSnapshotToPath,
    nowCompactStamp: debugDumpFeature.nowCompactStamp,
    safeString: debugDumpFeature.safeString,
  });

  function install() {
    debugDumpFeature.exposeGlobalApi();
    debugDumpFeature.installGlobalShortcuts();
    diagnosticsController.installConsoleCapture();
    if (windowRef && typeof windowRef.addEventListener === "function") {
      windowRef.addEventListener("error", (event) => {
        try {
          const msg = event && event.message ? String(event.message) : "window.error";
          diagnosticsController.scheduleAutoDump("window-error", msg);
        } catch {}
      });
      windowRef.addEventListener("unhandledrejection", (event) => {
        try {
          const reason = event && event.reason ? event.reason : null;
          const msg = reason && reason.message ? String(reason.message) : String(reason || "unhandledrejection");
          diagnosticsController.scheduleAutoDump("unhandledrejection", msg);
        } catch {}
      });
    }
  }

  function installDevUiSmoke(extraHost = {}) {
    return installDevUiSmokeHook({
      ...uiSmokeHost,
      ...extraHost,
      windowRef,
      devConfig,
    });
  }

  function runDevAutoscrollDemo(extraHost = {}) {
    return createDevAutoscrollDemo({
      ...devAutoscrollHost,
      ...extraHost,
      api,
      windowRef,
      documentRef,
      devConfig,
    }).run();
  }

  function isDebugMessagesEnabled() {
    try {
      return Boolean(windowRef && windowRef.__abcarusDebugMessages);
    } catch {
      return false;
    }
  }

  return {
    controller: diagnosticsController,
    debugDumpFeature,
    devConfig,
    abbreviatePathForLog: diagnosticsController.abbreviatePathForLog,
    dumpDebugToFile: (...args) => debugDumpFeature.dumpToFile(...args),
    install,
    installDevUiSmoke,
    isDebugMessagesEnabled,
    isFilePerfEnabled: diagnosticsController.isFilePerfEnabled,
    isIntonationPerfEnabled: diagnosticsController.isIntonationPerfEnabled,
    isRenderPerfEnabled: diagnosticsController.isRenderPerfEnabled,
    isStartupPerfEnabled: diagnosticsController.isStartupPerfEnabled,
    logFilePerf: diagnosticsController.logFilePerf,
    logIntonationPerf: diagnosticsController.logIntonationPerf,
    logRenderPerf: diagnosticsController.logRenderPerf,
    logStartupPerf: diagnosticsController.logStartupPerf,
    perfNowMs: diagnosticsController.perfNowMs,
    recordDebugLog: diagnosticsController.recordDebugLog,
    recordRecentAction: diagnosticsController.recordRecentAction,
    reportStartupStatus: diagnosticsController.reportStartupStatus,
    runDevAutoscrollDemo,
    scheduleAutoDump: diagnosticsController.scheduleAutoDump,
    scheduleAutoWcDump: diagnosticsController.scheduleAutoWcDump,
  };
}

export {
  createDiagnosticsDomain,
};
