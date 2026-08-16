function createXIssuesModalController({
  modal,
  infoElement,
  closeButton,
  copyButton,
  jumpButton,
  autoFixButton,
  safeBasename,
  enableDraggableModal,
  getFileEntry,
  refreshFile,
  loadFile,
  selectTune,
  autoFixFile,
  showToast,
} = {}) {
  let pendingFilePath = null;
  let pendingTuneId = null;

  function close() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    pendingFilePath = null;
    pendingTuneId = null;
  }

  function formatReport(fileEntry) {
    const label = fileEntry && (fileEntry.basename || (typeof safeBasename === "function" ? safeBasename(fileEntry.path) : ""))
      ? (fileEntry.basename || safeBasename(fileEntry.path))
      : "";
    const issues = fileEntry && fileEntry.xIssues ? fileEntry.xIssues : null;
    if (!issues || issues.ok) {
      return `File: ${label}\n\nNo X issues detected.`;
    }

    const tunes = Array.isArray(fileEntry.tunes) ? fileEntry.tunes : [];
    const invalidLines = tunes
      .filter((t) => !(t && t.xNumber && String(t.xNumber).trim()))
      .map((t) => t.startLine)
      .filter((n) => Number.isFinite(n));

    const dupLines = new Map();
    if (issues.duplicates && typeof issues.duplicates === "object") {
      for (const tune of tunes) {
        const x = tune && tune.xNumber != null ? String(tune.xNumber) : "";
        if (!x) continue;
        if (!Object.prototype.hasOwnProperty.call(issues.duplicates, x)) continue;
        if (!dupLines.has(x)) dupLines.set(x, []);
        dupLines.get(x).push(tune.startLine);
      }
    }

    const lines = [];
    lines.push(`File: ${label}`);
    lines.push("");
    lines.push("X issues:");
    if (invalidLines.length) {
      const shown = invalidLines.slice(0, 30);
      const more = invalidLines.length - shown.length;
      lines.push(`- Invalid/empty X at tune start lines: ${shown.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`);
    }
    if (dupLines.size) {
      const keys = Array.from(dupLines.keys()).sort((a, b) => a.localeCompare(b));
      const shownKeys = keys.slice(0, 20);
      for (const x of shownKeys) {
        const locs = (dupLines.get(x) || []).filter((n) => Number.isFinite(n));
        const shown = locs.slice(0, 20);
        const more = locs.length - shown.length;
        lines.push(`- Duplicate X:${x} at lines: ${shown.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`);
      }
      if (keys.length > shownKeys.length) lines.push(`- Duplicate X: (+${keys.length - shownKeys.length} more values)`);
    }
    if (!invalidLines.length && !dupLines.size) {
      lines.push("- (No details available; re-parse the file to compute locations.)");
    }

    return lines.join("\n");
  }

  function computeFirstIssueTuneId(fileEntry) {
    const tunes = Array.isArray(fileEntry && fileEntry.tunes) ? fileEntry.tunes : [];
    const invalid = tunes.find((t) => !(t && t.xNumber && String(t.xNumber).trim()));
    if (invalid && invalid.id) return invalid.id;
    const issues = fileEntry && fileEntry.xIssues ? fileEntry.xIssues : null;
    if (issues && issues.duplicates && typeof issues.duplicates === "object") {
      const dupX = Object.keys(issues.duplicates)[0] || "";
      if (dupX) {
        const dupTune = tunes.find((t) => String((t && t.xNumber) || "") === dupX);
        if (dupTune && dupTune.id) return dupTune.id;
      }
    }
    return null;
  }

  async function open(filePath) {
    if (!modal || !infoElement || !filePath || typeof getFileEntry !== "function") return;
    const entry = getFileEntry(filePath);
    if (!entry) return;

    let fileEntry = entry;
    if ((!fileEntry.tunes || !fileEntry.tunes.length) && typeof refreshFile === "function") {
      const updated = await refreshFile(filePath);
      if (updated) fileEntry = updated;
    }

    pendingFilePath = filePath;
    pendingTuneId = computeFirstIssueTuneId(fileEntry);
    infoElement.textContent = formatReport(fileEntry);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  async function copyReport() {
    if (!infoElement) return;
    const text = String(infoElement.textContent || "");
    if (text && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      if (typeof showToast === "function") showToast("Copied.");
    }
  }

  async function jumpToIssue() {
    const filePath = pendingFilePath;
    const tuneId = pendingTuneId;
    close();
    if (!filePath || typeof loadFile !== "function") return;
    const ok = await loadFile(filePath);
    if (!ok) return;
    if (tuneId && typeof selectTune === "function") {
      await selectTune(tuneId, { skipConfirm: true });
    }
  }

  async function autoFix() {
    const filePath = pendingFilePath;
    close();
    if (!filePath || typeof autoFixFile !== "function") return;
    await autoFixFile(filePath);
    const entry = typeof getFileEntry === "function" ? getFileEntry(filePath) : null;
    const hasIssues = Boolean(entry && entry.xIssues && entry.xIssues.ok === false);
    if (hasIssues) {
      await open(filePath);
    } else if (typeof showToast === "function") {
      showToast("Renumbered X.");
    }
  }

  if (closeButton) closeButton.addEventListener("click", () => close());
  if (copyButton) copyButton.addEventListener("click", () => {
    copyReport().catch(() => {});
  });
  if (jumpButton) jumpButton.addEventListener("click", () => {
    jumpToIssue().catch(() => {});
  });
  if (autoFixButton) autoFixButton.addEventListener("click", () => {
    autoFix().catch(() => {});
  });

  if (modal) {
    modal.addEventListener("keydown", (event) => {
      if (!event) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    });
    if (typeof enableDraggableModal === "function") enableDraggableModal(modal);
  }

  return {
    close,
    open,
    formatReport,
    computeFirstIssueTuneId,
  };
}

export {
  createXIssuesModalController,
};
