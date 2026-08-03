function lruGet(map, key) {
  if (!map.has(key)) return undefined;
  const value = map.get(key);
  map.delete(key);
  map.set(key, value);
  return value;
}

function lruSet(map, key, value, maxEntries) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > maxEntries) {
    const firstKey = map.keys().next().value;
    if (firstKey == null) break;
    map.delete(firstKey);
  }
}

export function createFileContentCache({
  maxEntries = 12,
  normalizePath = (filePath) => String(filePath || ""),
} = {}) {
  const cache = new Map();
  const limit = Math.max(1, Number(maxEntries) || 1);
  const stats = { hits: 0, misses: 0, evictions: 0, reads: 0, readMs: 0, bytesRead: 0 };

  function normalizeKey(filePath) {
    return normalizePath(filePath || "");
  }

  function get(filePath) {
    const key = normalizeKey(filePath);
    if (!key) return undefined;
    const value = lruGet(cache, key);
    if (value === undefined) stats.misses += 1;
    else stats.hits += 1;
    return value;
  }

  function set(filePath, content) {
    const key = normalizeKey(filePath);
    if (!key) return;
    const hadKey = cache.has(key);
    const wasFull = cache.size >= limit;
    lruSet(cache, key, content, limit);
    if (!hadKey && wasFull) stats.evictions += 1;
  }

  async function getCached(filePath, readFile) {
    let content = get(filePath);
    if (content == null) {
      const started = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
      const res = await readFile(filePath);
      if (!res.ok) return res;
      content = res.data;
      const finished = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
      stats.reads += 1;
      stats.readMs += Math.max(0, finished - started);
      stats.bytesRead += typeof content === "string" ? content.length : 0;
      set(filePath, content);
    }
    return { ok: true, data: content };
  }

  return {
    clear: () => cache.clear(),
    deleteKey: (key) => cache.delete(key),
    get,
    getCached,
    getStats: () => ({ ...stats, entries: cache.size, maxEntries: limit }),
    hasKey: (key) => cache.has(key),
    normalizeKey,
    resetStats: () => {
      stats.hits = 0;
      stats.misses = 0;
      stats.evictions = 0;
      stats.reads = 0;
      stats.readMs = 0;
      stats.bytesRead = 0;
    },
    set,
  };
}

export function createFileOperationLocks({
  normalizePath = (filePath) => String(filePath || ""),
} = {}) {
  const queues = new Map();

  function normalizeKey(filePath) {
    const raw = String(filePath || "");
    const normalized = normalizePath(raw);
    return normalized || raw;
  }

  async function withFileLock(filePath, operation) {
    const key = normalizeKey(filePath);
    if (!key) return operation();
    const prev = queues.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(operation);
    const tail = next.finally(() => {
      if (queues.get(key) === tail) queues.delete(key);
    });
    queues.set(key, tail);
    return tail;
  }

  async function withFileLocks(filePaths, operation) {
    const list = Array.from(new Set((filePaths || []).map((p) => normalizeKey(p)).filter(Boolean)));
    if (!list.length) return operation();
    list.sort((a, b) => a.localeCompare(b));
    let chained = operation;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      const prevFn = chained;
      chained = () => withFileLock(p, prevFn);
    }
    return chained();
  }

  return {
    normalizeKey,
    withFileLock,
    withFileLocks,
  };
}
