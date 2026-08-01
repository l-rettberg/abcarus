export function getRenderCompatMapFromPayload(payload) {
  return payload && payload.compatMap ? payload.compatMap : null;
}

export function mapSourceOffsetToRenderOffset(offset, compatMap = null) {
  const raw = Number(offset);
  if (!Number.isFinite(raw)) return raw;
  const map = compatMap;
  if (!map || !Array.isArray(map.shifts) || !map.shifts.length) return raw;
  let lo = 0;
  let hi = map.shifts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((map.shifts[mid].srcPos || 0) <= raw) lo = mid + 1;
    else hi = mid;
  }
  const shift = lo > 0 ? map.shifts[lo - 1] : null;
  const delta = shift && Number.isFinite(shift.delta) ? shift.delta : 0;
  return raw + delta;
}

export function mapRenderOffsetToSourceOffset(offset, compatMap = null) {
  const raw = Number(offset);
  if (!Number.isFinite(raw)) return raw;
  const map = compatMap;
  if (!map || !Array.isArray(map.shifts) || !map.shifts.length) return raw;
  let lo = 0;
  let hi = map.shifts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((map.shifts[mid].outPos || 0) <= raw) lo = mid + 1;
    else hi = mid;
  }
  const shift = lo > 0 ? map.shifts[lo - 1] : null;
  const delta = shift && Number.isFinite(shift.delta) ? shift.delta : 0;
  return raw - delta;
}

export function mapEditorOffsetToRenderIdx(editorOffset, payload = null) {
  const raw = Number(editorOffset);
  if (!Number.isFinite(raw)) return raw;
  const renderOffset = payload && Number.isFinite(payload.offset) ? payload.offset : 0;
  const sourcePos = raw + renderOffset;
  return mapSourceOffsetToRenderOffset(sourcePos, payload && payload.compatMap ? payload.compatMap : null);
}

export function mapRenderIdxToEditorOffset(renderIdx, payload = null) {
  const raw = Number(renderIdx);
  if (!Number.isFinite(raw)) return raw;
  const renderOffset = payload && Number.isFinite(payload.offset) ? payload.offset : 0;
  const sourcePos = mapRenderOffsetToSourceOffset(raw, payload && payload.compatMap ? payload.compatMap : null);
  return Math.max(0, sourcePos - renderOffset);
}

export function normalizeHeaderNoneSpacing(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  for (const line of lines) {
    const match = line.match(/^(\s*[KM]:)(\s+)(none\b.*)$/i);
    if (match) {
      const lead = match[1];
      const gap = match[2] || "";
      const rest = match[3] || "";
      out.push(`${lead}${rest}${" ".repeat(gap.length)}`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

export function stripSepForRender(text) {
  const value = String(text || "");
  let replaced = false;
  // Keep the output string length identical to preserve SVG/editor offset mapping.
  const stripped = value.replace(/^[ \t]*%%sep\b.*$/gmi, (line) => {
    replaced = true;
    const len = String(line || "").length;
    if (len <= 0) return "%";
    return `%${" ".repeat(Math.max(0, len - 1))}`;
  });
  return { text: stripped, replaced };
}
