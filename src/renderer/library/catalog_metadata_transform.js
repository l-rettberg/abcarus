const FACET_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

function normalizeFacetName(value) {
  const facet = String(value || "").trim().toLowerCase();
  return FACET_NAME_RE.test(facet) ? facet : "";
}

function normalizeFacetValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function readLinesWithOffsets(text) {
  const source = String(text || "");
  const lines = [];
  const re = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  let match;
  while ((match = re.exec(source))) {
    if (!match[0]) break;
    const full = match[0];
    const line = full.replace(/(?:\r\n|\r|\n)$/, "");
    lines.push({ line, start: match.index, end: match.index + line.length, fullEnd: match.index + full.length });
    if (re.lastIndex >= source.length) break;
  }
  return lines;
}

function inspectTuneFacet(tuneText, facet, value) {
  const normalizedFacet = normalizeFacetName(facet);
  const normalizedValue = normalizeFacetValue(value);
  if (!normalizedFacet || !normalizedValue) {
    return { ok: false, error: "Facet and value are required.", existingValues: [], exact: false };
  }

  const existingValues = [];
  let sawHeader = false;
  let insertOffset = null;
  let headerEndOffset = 0;
  for (const record of readLinesWithOffsets(tuneText)) {
    const trimmed = record.line.trim();
    const isBlank = !trimmed;
    const isHeader = /^\s*[A-Za-z]:/.test(record.line) || /^\s*%/.test(record.line);
    if (isHeader) sawHeader = true;
    if (sawHeader && isBlank) break;
    if (!isHeader && !isBlank) break;
    if (isHeader) headerEndOffset = record.fullEnd;
    if (insertOffset == null && /^\s*K:/.test(record.line)) insertOffset = record.start;
    const groupMatch = record.line.match(/^\s*G:\s*\[([A-Za-z][A-Za-z0-9_-]*)\]\s*(.*?)\s*$/);
    if (groupMatch && groupMatch[1].toLowerCase() === normalizedFacet) {
      const existingValue = normalizeFacetValue(groupMatch[2]);
      if (existingValue && !existingValues.includes(existingValue)) existingValues.push(existingValue);
    }
  }

  const foldedValue = normalizedValue.toLowerCase();
  const exact = existingValues.some((item) => item.toLowerCase() === foldedValue);
  return {
    ok: true,
    facet: normalizedFacet,
    value: normalizedValue,
    existingValues,
    exact,
    insertOffset: insertOffset == null ? headerEndOffset : insertOffset,
  };
}

function addFacetToTuneText(tuneText, facet, value) {
  const source = String(tuneText || "");
  const inspection = inspectTuneFacet(source, facet, value);
  if (!inspection.ok) return { ...inspection, text: source, changed: false };
  if (inspection.exact) return { ...inspection, text: source, changed: false };

  const eolMatch = source.match(/\r\n|\r|\n/);
  const eol = eolMatch ? eolMatch[0] : "\n";
  const tag = `G:[${inspection.facet}] ${inspection.value}`;
  const offset = Math.max(0, Math.min(source.length, inspection.insertOffset));
  let insertion = `${tag}${eol}`;
  if (offset > 0 && source[offset - 1] !== "\n" && source[offset - 1] !== "\r") insertion = `${eol}${insertion}`;
  return {
    ...inspection,
    text: `${source.slice(0, offset)}${insertion}${source.slice(offset)}`,
    changed: true,
  };
}

function findTuneStarts(fileText) {
  const starts = [];
  const re = /^[ \t]*X:/gm;
  let match;
  while ((match = re.exec(String(fileText || "")))) starts.push(match.index);
  return starts;
}

function valuesEqual(left, right) {
  return normalizeFacetValue(left).normalize("NFC") === normalizeFacetValue(right).normalize("NFC");
}

function replaceFacetInTuneText(tuneText, facet, sourceValue, targetValue) {
  const source = String(tuneText || "");
  const normalizedFacet = normalizeFacetName(facet);
  const from = normalizeFacetValue(sourceValue).normalize("NFC");
  const to = normalizeFacetValue(targetValue).normalize("NFC");
  if (!normalizedFacet || !from || !to) {
    return { ok: false, error: "Facet, source value, and target value are required.", text: source, changed: false };
  }
  if (valuesEqual(from, to)) {
    return { ok: true, facet: normalizedFacet, sourceValue: from, targetValue: to, text: source, changed: false, replacements: 0 };
  }

  const records = readLinesWithOffsets(source);
  let headerOpen = false;
  let sawTarget = false;
  let replacements = 0;
  const output = [];
  for (const record of records) {
    const newline = source.slice(record.end, record.fullEnd);
    const trimmed = record.line.trim();
    if (!headerOpen && /^\s*X:/.test(record.line)) headerOpen = true;
    if (headerOpen && (!trimmed || (!/^\s*[A-Za-z]:/.test(record.line) && !/^\s*%/.test(record.line)))) headerOpen = false;

    const match = headerOpen
      ? record.line.match(/^(\s*G:\s*\[([A-Za-z][A-Za-z0-9_-]*)\]\s*)(.*?)\s*$/)
      : null;
    if (!match || normalizeFacetName(match[2]) !== normalizedFacet) {
      output.push(record.line + newline);
      continue;
    }

    const value = normalizeFacetValue(match[3]);
    if (valuesEqual(value, to)) {
      if (sawTarget) {
        replacements += 1;
        continue;
      }
      sawTarget = true;
      output.push(record.line + newline);
      continue;
    }
    if (!valuesEqual(value, from)) {
      output.push(record.line + newline);
      continue;
    }

    replacements += 1;
    if (sawTarget) continue;
    sawTarget = true;
    output.push(`${match[1]}${to}${newline}`);
  }

  return {
    ok: true,
    facet: normalizedFacet,
    sourceValue: from,
    targetValue: to,
    text: output.join(""),
    changed: replacements > 0,
    replacements,
  };
}

function replaceFacetInFileText(fileText, facet, sourceValue, targetValue) {
  const source = String(fileText || "");
  const starts = findTuneStarts(source);
  if (!starts.length) {
    return { ok: true, text: source, changed: false, tunesChanged: 0, replacements: 0 };
  }

  let text = source.slice(0, starts[0]);
  let tunesChanged = 0;
  let replacements = 0;
  for (let index = 0; index < starts.length; index += 1) {
    const end = index + 1 < starts.length ? starts[index + 1] : source.length;
    const result = replaceFacetInTuneText(source.slice(starts[index], end), facet, sourceValue, targetValue);
    if (!result.ok) return { ...result, text: source, tunesChanged: 0, replacements: 0 };
    text += result.text;
    if (result.changed) tunesChanged += 1;
    replacements += result.replacements;
  }
  return { ok: true, text, changed: replacements > 0, tunesChanged, replacements };
}

function replacePlainHeaderFieldInTuneText(tuneText, field, sourceValue, targetValue) {
  const source = String(tuneText || "");
  const normalizedField = String(field || "").trim().toUpperCase();
  const from = normalizeFacetValue(sourceValue).normalize("NFC");
  const to = normalizeFacetValue(targetValue).normalize("NFC");
  if (!/^(?:C|G)$/.test(normalizedField) || !from || !to) {
    return { ok: false, error: "Only exact C: and plain G: category replacement is supported.", text: source, changed: false };
  }
  if (from === to) return { ok: true, text: source, changed: false, replacements: 0 };

  const records = readLinesWithOffsets(source);
  let headerOpen = false;
  let sawTarget = false;
  let replacements = 0;
  const output = [];
  for (const record of records) {
    const newline = source.slice(record.end, record.fullEnd);
    const trimmed = record.line.trim();
    if (!headerOpen && /^\s*X:/.test(record.line)) headerOpen = true;
    if (headerOpen && (!trimmed || (!/^\s*[A-Za-z]:/.test(record.line) && !/^\s*%/.test(record.line)))) headerOpen = false;
    const match = headerOpen
      ? record.line.match(new RegExp(`^(\\s*${normalizedField}:\\s*)(.*?)\\s*$`))
      : null;
    if (!match) {
      output.push(record.line + newline);
      continue;
    }
    const value = normalizeFacetValue(match[2]);
    if (normalizedField === "G" && /^\[[A-Za-z][A-Za-z0-9_-]*\]\s*\S/.test(value)) {
      output.push(record.line + newline);
      continue;
    }
    if (valuesEqual(value, to)) {
      if (sawTarget) {
        replacements += 1;
        continue;
      }
      sawTarget = true;
      output.push(record.line + newline);
      continue;
    }
    if (!valuesEqual(value, from)) {
      output.push(record.line + newline);
      continue;
    }
    replacements += 1;
    if (sawTarget) continue;
    sawTarget = true;
    output.push(`${match[1]}${to}${newline}`);
  }
  return { ok: true, text: output.join(""), changed: replacements > 0, replacements };
}

function replacePlainHeaderFieldInFileText(fileText, field, sourceValue, targetValue) {
  const source = String(fileText || "");
  const starts = findTuneStarts(source);
  if (!starts.length) return { ok: true, text: source, changed: false, tunesChanged: 0, replacements: 0 };
  let text = source.slice(0, starts[0]);
  let tunesChanged = 0;
  let replacements = 0;
  for (let index = 0; index < starts.length; index += 1) {
    const end = index + 1 < starts.length ? starts[index + 1] : source.length;
    const result = replacePlainHeaderFieldInTuneText(source.slice(starts[index], end), field, sourceValue, targetValue);
    if (!result.ok) return { ...result, text: source, tunesChanged: 0, replacements: 0 };
    text += result.text;
    if (result.changed) tunesChanged += 1;
    replacements += result.replacements;
  }
  return { ok: true, text, changed: replacements > 0, tunesChanged, replacements };
}

function addFacetToAllTunes(fileText, facet, value) {
  const source = String(fileText || "");
  const starts = findTuneStarts(source);
  if (!starts.length) return { ok: false, error: "No X: tunes found in the active file.", text: source, total: 0, changed: 0, existing: 0, conflicts: [] };

  let text = source.slice(0, starts[0]);
  let changed = 0;
  let existing = 0;
  const conflicts = [];
  for (let index = 0; index < starts.length; index += 1) {
    const end = index + 1 < starts.length ? starts[index + 1] : source.length;
    const result = addFacetToTuneText(source.slice(starts[index], end), facet, value);
    if (!result.ok) return { ...result, text: source, total: starts.length, changed: 0, existing: 0, conflicts: [] };
    text += result.text;
    if (result.changed) changed += 1;
    else existing += 1;
    if (result.changed && result.existingValues.length) {
      conflicts.push({ tuneIndex: index + 1, existingValues: result.existingValues.slice() });
    }
  }
  return { ok: true, text, total: starts.length, changed, existing, conflicts };
}

export {
  addFacetToAllTunes,
  addFacetToTuneText,
  inspectTuneFacet,
  normalizeFacetName,
  normalizeFacetValue,
  replaceFacetInFileText,
  replaceFacetInTuneText,
  replacePlainHeaderFieldInFileText,
  replacePlainHeaderFieldInTuneText,
};
