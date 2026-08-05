export function resolveTuneEntry(snapshot, { tuneUid, tuneIndex, startOffset } = {}) {
  if (!snapshot || !Array.isArray(snapshot.tunes)) return null;
  const tunes = snapshot.tunes;
  let idx = -1;
  if (tuneUid) idx = tunes.findIndex((t) => t && t.tuneUid && t.tuneUid === tuneUid);
  if (!tuneUid && Number.isFinite(Number(tuneIndex))) {
    const candidate = Number(tuneIndex);
    if (candidate >= 0 && candidate < tunes.length) idx = candidate;
  }
  if (!tuneUid && idx < 0 && Number.isFinite(Number(startOffset))) {
    idx = tunes.findIndex((t) => Number(t && t.start) === Number(startOffset));
  }
  if (idx < 0 || idx >= tunes.length) return null;
  const tune = tunes[idx];
  const start = Number(tune && tune.start);
  const end = Number(tune && tune.end);
  if (!tune || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null;
  return { tuneUid: tune.tuneUid || "", tuneIndex: idx, start, end };
}
