export function createLibraryRuntimeStore() {
  let index = null;
  let visible = true;
  let recentEntriesSuppressed = false;

  return {
    getIndex() {
      return index;
    },
    setIndex(next) {
      index = next || null;
    },
    getFiles() {
      return index && Array.isArray(index.files) ? index.files : [];
    },
    getRoot() {
      return index && index.root ? String(index.root) : "";
    },
    isVisible() {
      return visible;
    },
    setVisible(next) {
      visible = Boolean(next);
    },
    areRecentEntriesSuppressed() {
      return recentEntriesSuppressed;
    },
    setRecentEntriesSuppressed(next) {
      recentEntriesSuppressed = Boolean(next);
    },
  };
}
