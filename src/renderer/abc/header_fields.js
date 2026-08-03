function latinize(text) {
  if (!text) return "";
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function pickPreferredLatinText(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  let fallback = "";
  let best = "";
  let bestScore = -1;
  for (const raw of list) {
    const text = String(raw || "").trim();
    if (!text) continue;
    if (!fallback) fallback = text;
    const latin = latinize(text).trim();
    const letters = (latin.match(/[A-Za-z]/g) || []).length;
    const score = letters > 0 ? letters : 0;
    if (score > bestScore) {
      bestScore = score;
      best = text;
    }
  }
  return best || fallback || "";
}

function parseAbcHeaderFields(text) {
  const fields = { titles: [], title: "", composer: "", key: "" };
  const lines = String(text || "").split(/\r\n|\n|\r/);
  for (const line of lines) {
    if (/^T:/.test(line)) {
      const t = line.replace(/^T:\s*/, "").trim();
      if (t) fields.titles.push(t);
      if (!fields.title) fields.title = t;
    } else if (!fields.composer && /^C:/.test(line)) {
      fields.composer = line.replace(/^C:\s*/, "").trim();
    } else if (!fields.key && /^K:/.test(line)) {
      fields.key = line.replace(/^K:\s*/, "").trim();
      break;
    }
  }
  const preferred = pickPreferredLatinText(fields.titles);
  if (preferred) fields.title = preferred;
  return fields;
}

function normalizeSuggestedKeyName(key) {
  const raw = String(key || "").trim();
  if (!raw) return "";
  const first = raw.split(/\s+/)[0] || "";
  if (!first || /^none$/i.test(first) || /^HP$/i.test(first) || /^Hp$/i.test(first)) return "";
  return first;
}

function parseTuneIdentityFields(text) {
  const out = { xNumber: "", title: "", composer: "", key: "", preview: "" };
  const lines = String(text || "").split(/\r\n|\n|\r/);
  for (const line of lines) {
    if (!out.xNumber) {
      const m = line.match(/^X:\s*(\d+)/);
      if (m) out.xNumber = m[1];
    }
    if (!out.title && /^T:/.test(line)) out.title = line.replace(/^T:\s*/, "").trim();
    else if (!out.composer && /^C:/.test(line)) out.composer = line.replace(/^C:\s*/, "").trim();
    else if (!out.key && /^K:/.test(line)) {
      out.key = line.replace(/^K:\s*/, "").trim();
      break;
    }
  }
  out.preview = out.title || (out.xNumber ? `X:${out.xNumber}` : "");
  return out;
}

export {
  normalizeSuggestedKeyName,
  parseAbcHeaderFields,
  parseTuneIdentityFields,
};
