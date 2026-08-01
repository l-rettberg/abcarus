function buildPlaybackState(firstSymbol, options = {}) {
  const symbols = [];
  const measures = [];
  const barIstarts = [];
  const voiceEventsById = new Map(); // voiceId -> [{time, istart}]
  const voiceEventsByIndex = new Map(); // voiceIndex -> [{time, istart}]
  const voiceStats = new Map(); // voice key -> { id, index, order, playable, pitched }
  const pushUnique = (arr, symbol) => {
    if (!symbol || !Number.isFinite(symbol.istart)) return;
    if (arr.length && arr[arr.length - 1].istart === symbol.istart) return;
    arr.push({ istart: symbol.istart, symbol });
  };
  const isPlayableSymbol = (symbol) => !!(symbol && !symbol.noplay && Number.isFinite(symbol.dur) && symbol.dur > 0);
  const isBarLikeSymbol = (symbol) => !!(symbol && (symbol.bar_type || symbol.type === 14));

  let s = firstSymbol;
  let guard = 0;
  let preferredVoiceId = null;
  let preferredVoiceIndex = null;
  let lockedPrimaryVoice = false;
  let voiceOrderSeq = 0;
  const editorLen = Number.isFinite(Number(options.editorLength)) ? Number(options.editorLength) : 0;
  const playbackOffset = Number.isFinite(Number(options.playbackIndexOffset)) ? Number(options.playbackIndexOffset) : 0;
  const editorMaxIstart = playbackOffset + (Number.isFinite(editorLen) ? editorLen : 0);
  const isInjectedSymbol = (symbol) => {
    if (!symbol || !Number.isFinite(symbol.istart)) return false;
    if (!editorLen) return false;
    return symbol.istart >= editorMaxIstart;
  };
  const considerVoice = (symbol) => {
    if (!symbol || !symbol.p_v) return;
    const id = symbol.p_v.id ? String(symbol.p_v.id) : null;
    if (id && id.toUpperCase() === "DRUM") return;
    const v = Number.isFinite(symbol.p_v.v) ? symbol.p_v.v : null;
    // Convention: if V:1 exists, Follow should use it as the primary voice.
    // Some abc2svg timelines assign voice indices that do not correspond to V: numbering.
    if (!lockedPrimaryVoice && id === "1") {
      preferredVoiceId = id;
      preferredVoiceIndex = v;
      lockedPrimaryVoice = true;
      return;
    }
    if (lockedPrimaryVoice) return;
    if (preferredVoiceIndex == null) {
      preferredVoiceIndex = v;
      preferredVoiceId = id;
      return;
    }
    if (v != null && preferredVoiceIndex != null && v < preferredVoiceIndex) {
      preferredVoiceIndex = v;
      preferredVoiceId = id;
      return;
    }
    if (preferredVoiceIndex == null && v != null) {
      preferredVoiceIndex = v;
      preferredVoiceId = id;
    }
  };

  const getVoiceStatsKey = (id, index) => {
    if (id) return `id:${id}`;
    if (index != null) return `idx:${index}`;
    return null;
  };

  const recordVoiceStats = (symbol) => {
    if (!symbol || !symbol.p_v) return;
    if (!isPlayableSymbol(symbol)) return;
    const id = symbol.p_v.id ? String(symbol.p_v.id) : null;
    if (id && id.toUpperCase() === "DRUM") return;
    const index = Number.isFinite(symbol.p_v.v) ? symbol.p_v.v : null;
    const key = getVoiceStatsKey(id, index);
    if (!key) return;
    let stats = voiceStats.get(key);
    if (!stats) {
      stats = { id, index, order: voiceOrderSeq, playable: 0, pitched: 0 };
      voiceOrderSeq += 1;
      voiceStats.set(key, stats);
    }
    stats.playable += 1;
    // abc2svg marks normal pitched notes as type 8. In many lead sheets an
    // accompaniment voice made of `x` heads is playable too, but it is a poor
    // default target for Follow when a real melody voice is present.
    if (symbol.type === 8) stats.pitched += 1;
  };

  const pushVoiceEvent = (symbol) => {
    if (!symbol || !symbol.p_v) return;
    if (!isPlayableSymbol(symbol)) return;
    if (!Number.isFinite(symbol.time) || !Number.isFinite(symbol.istart)) return;
    const pv = symbol.p_v;
    const id = pv.id != null ? String(pv.id) : null;
    const v = Number.isFinite(pv.v) ? String(pv.v) : null;
    const evt = { time: symbol.time, istart: symbol.istart };
    const push = (map, key) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(evt);
    };
    // Keep both maps available; Follow will prefer id but can fall back to index.
    // IMPORTANT: keep these separate to avoid key collisions (e.g. voiceId "1" vs voiceIndex "1").
    if (id && id.toUpperCase() !== "DRUM") push(voiceEventsById, id);
    if (v != null) push(voiceEventsByIndex, v);
  };

  if (s && !isInjectedSymbol(s)) pushUnique(symbols, s);
  if (s && !isInjectedSymbol(s)) pushUnique(measures, s);

  while (s && guard < 200000) {
    if (!isInjectedSymbol(s)) {
      pushUnique(symbols, s);
      if (isBarLikeSymbol(s) && s.ts_next) {
        // In some abc2svg timelines (multi-voice + injected DRUM), a barline's ts_next may point into
        // the injected tail. For bar-snapping/highlighting we want the next *editor-visible* symbol.
        let next = s.ts_next;
        let hop = 0;
        while (next && isInjectedSymbol(next) && hop < 64) {
          next = next.ts_next;
          hop += 1;
        }
        if (next && !isInjectedSymbol(next)) {
          pushUnique(measures, next);
        }
        barIstarts.push(s.istart);
      }
      if (isPlayableSymbol(s)) {
        considerVoice(s);
        recordVoiceStats(s);
        pushVoiceEvent(s);
      }
    }
    s = s.ts_next;
    guard += 1;
  }

  // Sort by istart (text position) so binary searches behave deterministically even with multi-voice timelines.
  // Note: injected/appended voices (e.g. DRUM) are filtered out above, so these maps reflect editor-visible ABC.
  symbols.sort((a, b) => a.istart - b.istart);
  measures.sort((a, b) => a.istart - b.istart);

  const uniqSorted = (arr) => {
    const out = [];
    let last = null;
    for (const v of arr.slice().sort((a, b) => a - b)) {
      if (!Number.isFinite(v)) continue;
      if (last == null || v !== last) out.push(v);
      last = v;
    }
    return out;
  };

  // IMPORTANT:
  // Keep `*_Istarts` aligned 1:1 with their corresponding `symbols/measures` arrays.
  // Some timelines contain multiple symbols with the same `istart` (multi-voice / decorations / non-playable markers).
  // If we de-duplicate istarts here, binary-search indices no longer match array indices and Follow/voice selection breaks.
  const symbolIstarts = symbols.map((item) => item.istart);
  const measureIstarts = measures.map((item) => item.istart);
  const playableIstarts = uniqSorted(
    symbols
      .filter((item) => isPlayableSymbol(item && item.symbol))
      .map((item) => item.istart)
  );
  const timeline = symbols.map((item) => {
    const sym = item.symbol;
    return {
      istart: item.istart,
      time: Number.isFinite(sym && sym.time) ? sym.time : null,
      dur: Number.isFinite(sym && sym.dur) ? sym.dur : null,
      type: Number.isFinite(sym && sym.type) ? sym.type : null,
    };
  });

  const buildTimelineObject = (eventsMap) => {
    const out = {};
    for (const [key, list] of eventsMap.entries()) {
      if (!key || !Array.isArray(list) || !list.length) continue;
      const sorted = list.slice().sort((a, b) => (a.time - b.time) || (a.istart - b.istart));
      const times = [];
      const istarts = [];
      let lastTime = null;
      let lastIstart = null;
      for (const e of sorted) {
        if (!e || !Number.isFinite(e.time) || !Number.isFinite(e.istart)) continue;
        // Keep duplicates (chords), but drop exact duplicates to reduce noise.
        if (lastTime === e.time && lastIstart === e.istart) continue;
        times.push(e.time);
        istarts.push(e.istart);
        lastTime = e.time;
        lastIstart = e.istart;
      }
      if (times.length) out[key] = { times, istarts };
    }
    return out;
  };

  const voiceTimeline = {
    byId: buildTimelineObject(voiceEventsById),
    byIndex: buildTimelineObject(voiceEventsByIndex),
  };

  const preferredKey = getVoiceStatsKey(preferredVoiceId, preferredVoiceIndex);
  const preferredStats = preferredKey ? voiceStats.get(preferredKey) : null;
  if (!preferredStats || !preferredStats.pitched) {
    let bestPitched = null;
    for (const stats of voiceStats.values()) {
      if (!stats || !stats.pitched) continue;
      if (
        !bestPitched
        || stats.pitched > bestPitched.pitched
        || (stats.pitched === bestPitched.pitched && stats.order < bestPitched.order)
      ) {
        bestPitched = stats;
      }
    }
    if (bestPitched) {
      preferredVoiceId = bestPitched.id;
      preferredVoiceIndex = bestPitched.index;
    }
  }

  let startSymbol = firstSymbol;
  if (!startSymbol || !Number.isFinite(startSymbol.istart)) {
    startSymbol = symbols.length ? symbols[0].symbol : firstSymbol;
  }
  if (!isPlayableSymbol(startSymbol)) {
    const playable = symbols.find((item) => isPlayableSymbol(item.symbol));
    if (playable) startSymbol = playable.symbol;
  }
  return {
    rootSymbol: firstSymbol || null,
    startSymbol,
    preferredVoiceId,
    preferredVoiceIndex,
    symbols,
    measures,
    symbolIstarts,
    measureIstarts,
    playableIstarts,
    barIstarts: uniqSorted(barIstarts),
    timeline,
    voiceTimeline,
    voiceStats: Array.from(voiceStats.values()).map((stats) => ({ ...stats })),
  };
}


function lowerBoundIstart(list, value) {
  if (!Array.isArray(list) || !list.length) return 0;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBoundIstart(list, value) {
  if (!Array.isArray(list) || !list.length) return 0;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function findBoundaryAtOrAfter(sorted, target) {
  if (!Array.isArray(sorted) || !sorted.length) return null;
  const t = Number(target);
  if (!Number.isFinite(t)) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  let best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = sorted[mid];
    if (v >= t) {
      best = v;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return best;
}

function pickStartFromListAtOrAfter(list, minRenderIdx) {
  if (!Array.isArray(list) || !list.length) return null;
  const min = Number(minRenderIdx);
  if (!Number.isFinite(min)) return list[0];
  for (const v of list) {
    if (Number.isFinite(v) && v >= min) return v;
  }
  return list[list.length - 1];
}

function snapIstartToPlayable(playbackState, istart) {
  if (!Number.isFinite(istart)) return istart;
  if (!playbackState || !Array.isArray(playbackState.playableIstarts) || !playbackState.playableIstarts.length) {
    return istart;
  }
  const list = playbackState.playableIstarts;
  const pos = lowerBoundIstart(list, istart);
  const right = pos < list.length ? list[pos] : null;
  const left = pos > 0 ? list[pos - 1] : null;
  const rightDist = Number.isFinite(right) ? Math.abs(right - istart) : Infinity;
  const leftDist = Number.isFinite(left) ? Math.abs(istart - left) : Infinity;
  // Prefer the forward note on ties so Follow doesn't lag behind.
  const winner = rightDist <= leftDist ? right : left;
  if (!Number.isFinite(winner)) return istart;
  // Guardrail: snap only if close; large jumps usually mean unrelated timeline noise.
  if (Math.abs(winner - istart) > 32) return istart;
  return winner;
}

function upperBoundTime(list, value) {
  if (!Array.isArray(list) || !list.length) return 0;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function findPlaybackSymbolAtOrBefore(playbackState, idx) {
  if (!playbackState || !playbackState.symbols.length) return null;
  const list = playbackState.symbolIstarts || [];
  if (!list.length) return null;
  const pos = upperBoundIstart(list, idx) - 1;
  const best = Math.max(0, Math.min(playbackState.symbols.length - 1, pos));
  const item = playbackState.symbols[best];
  return item ? item.symbol : null;
}

function findPlaybackSymbolAtOrAfter(playbackState, idx) {
  if (!playbackState || !playbackState.symbols.length) return null;
  const list = playbackState.symbolIstarts || [];
  if (!list.length) return null;
  const pos = lowerBoundIstart(list, idx);
  const best = Math.max(0, Math.min(playbackState.symbols.length - 1, pos));
  const item = playbackState.symbols[best];
  return item ? item.symbol : null;
}

function findPlaybackMeasureIndex(playbackState, idx) {
  if (!playbackState || !playbackState.measures.length) return 0;
  const list = playbackState.measureIstarts || [];
  if (!list.length) return 0;
  const pos = upperBoundIstart(list, idx) - 1;
  return Math.max(0, Math.min(playbackState.measures.length - 1, pos));
}


export {
  buildPlaybackState,
  findBoundaryAtOrAfter,
  findPlaybackMeasureIndex,
  findPlaybackSymbolAtOrAfter,
  findPlaybackSymbolAtOrBefore,
  lowerBoundIstart,
  pickStartFromListAtOrAfter,
  snapIstartToPlayable,
  upperBoundIstart,
  upperBoundTime,
};
