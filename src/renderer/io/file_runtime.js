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
