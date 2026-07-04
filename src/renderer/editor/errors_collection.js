function createErrorsCollection() {
  const entries = [];
  const entryMap = new Map();

  function getEntries() {
    return entries;
  }

  function clear() {
    entries.length = 0;
    entryMap.clear();
  }

  function reindex() {
    for (let i = 0; i < entries.length; i += 1) {
      entries[i].index = i;
    }
  }

  function getByKey(key) {
    return key ? entryMap.get(key) || null : null;
  }

  function hasKey(key) {
    return Boolean(key && entryMap.has(key));
  }

  function add(entry, key, { noRepeatCount = false } = {}) {
    if (!entry || !key) return { entry: null, existing: false };
    const existing = entryMap.get(key);
    if (existing) {
      if (!noRepeatCount) existing.count += 1;
      return { entry: existing, existing: true };
    }
    entry.errorKey = key;
    entry.index = entries.length;
    entries.push(entry);
    entryMap.set(key, entry);
    return { entry, existing: false };
  }

  function deleteByKey(key) {
    const entry = getByKey(key);
    if (!entry) return null;
    entryMap.delete(key);
    const idx = entries.indexOf(entry);
    if (idx !== -1) {
      entries.splice(idx, 1);
      reindex();
    }
    return entry;
  }

  return {
    add,
    clear,
    deleteByKey,
    getByKey,
    getEntries,
    hasKey,
  };
}

export {
  createErrorsCollection,
};
