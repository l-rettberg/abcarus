function stripErrorMessagePrefix(message) {
  let msg = String(message || "");
  msg = msg.replace(/^\s*\w+:\d+:\d+\s+/i, "").trim();
  msg = msg.replace(/^\s*(warning|error)\s*:\s*/i, "").trim();
  msg = msg.replace(/^\s*X:\s*\d+\s+[^:]*:\s*/i, "").trim();
  msg = msg.replace(/\s+\(abc2svg\)\s*$/i, "").trim();
  return msg;
}

function createErrorsFocusMessageController({
  element,
  getEditorText,
  getNavItems,
  computeErrorId,
  parseMeterParts,
  computeMeasureStats,
} = {}) {
  function clear() {
    if (!element) return;
    element.textContent = "";
    element.hidden = true;
    element.title = "";
  }

  function set(entry, from) {
    if (!element) return;
    const navItems = typeof getNavItems === "function" ? getNavItems() : [];
    const navId = typeof computeErrorId === "function" ? computeErrorId(entry) : "";
    const navIdx = navId && Array.isArray(navItems) ? navItems.findIndex((x) => x.id === navId) : -1;
    const navPrefix = (navIdx !== -1 && navItems.length) ? `${navIdx + 1}/${navItems.length} ` : "";

    const text = typeof getEditorText === "function" ? String(getEditorText() || "") : "";
    const parts = typeof parseMeterParts === "function" ? parseMeterParts(text) : null;
    const stats = typeof computeMeasureStats === "function" ? computeMeasureStats(text, from) : null;

    const msg = stripErrorMessagePrefix(entry && entry.message ? entry.message : "");
    let out = "";
    const suppressBeatsPrefix = /^meter mismatch:/i.test(msg) || /^repeat marker\b/i.test(msg);
    if (!suppressBeatsPrefix && parts && stats && Number.isFinite(stats.actualWhole)) {
      const expectedBeats = parts.num;
      const actualBeats = stats.actualWhole * parts.den;
      const diff = actualBeats - expectedBeats;
      if (Number.isFinite(diff) && Math.abs(diff) >= 0.01) {
        out = `Beats: ${actualBeats.toFixed(2)} (expected ${expectedBeats}, \u0394 ${diff.toFixed(2)})`;
      }
    }
    if (msg) {
      out = out ? `${out} \u2014 ${msg}` : msg;
    }

    const final = out ? `${navPrefix}${out}`.trim() : "";
    element.textContent = final;
    element.hidden = !final;
    element.title = msg || "";
  }

  return {
    clear,
    set,
  };
}

export {
  createErrorsFocusMessageController,
  stripErrorMessagePrefix,
};
