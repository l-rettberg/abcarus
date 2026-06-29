function createTemplatesFileCache({ readFile } = {}) {
  const cache = new Map();

  function clear() {
    cache.clear();
  }

  async function getText(filePath) {
    const p = String(filePath || "");
    if (!p) return "";
    const cached = cache.get(p);
    if (typeof cached === "string") return cached;
    if (typeof readFile !== "function") return "";
    const res = await readFile(p);
    if (!res || !res.ok) return "";
    const text = String(res.data || "");
    cache.set(p, text);
    return text;
  }

  return {
    clear,
    getText,
  };
}

export {
  createTemplatesFileCache,
};
