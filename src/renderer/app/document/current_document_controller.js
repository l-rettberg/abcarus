function createCurrentDocumentController({
  state = {},
} = {}) {
  const {
    getDocumentSessionController = () => null,
    getDocumentLifecycleController = () => null,
  } = state;

  function getSession() {
    return getDocumentSessionController() || null;
  }

  function getLifecycle() {
    return getDocumentLifecycleController() || null;
  }

  function updateUIFromDocument(doc) {
    const lifecycle = getLifecycle();
    if (lifecycle) lifecycle.applyDocumentToUi(doc);
  }

  function showEmptyState() {
    const lifecycle = getLifecycle();
    if (lifecycle) lifecycle.showEmptyState();
  }

  function setCurrentDocument(doc) {
    const session = getSession();
    if (!session) return null;
    const nextDoc = session.replaceCurrentDocument(doc);
    updateUIFromDocument(nextDoc);
    return nextDoc;
  }

  function clearCurrentDocument() {
    const session = getSession();
    if (session) session.replaceCurrentDocument(null);
    showEmptyState();
  }

  function getCurrentDocument() {
    const session = getSession();
    return session ? session.getCurrentDocument() : null;
  }

  function hasCurrentDocument() {
    const session = getSession();
    return session ? session.hasCurrentDocument() : false;
  }

  function getCurrentDocumentPath() {
    const session = getSession();
    return session ? session.getCurrentDocumentPath() : "";
  }

  function isCurrentDocumentDirty() {
    const session = getSession();
    return session ? session.isCurrentDocumentDirty() : false;
  }

  function ensureCurrentDocument(content = "") {
    const session = getSession();
    return session ? session.ensureCurrentDocument(content) : null;
  }

  function patchCurrentDocument(patch = {}, options = {}) {
    const session = getSession();
    return session ? session.patchCurrentDocument(patch, options) : null;
  }

  function markCurrentDocumentClean() {
    return patchCurrentDocument({ dirty: false }, { create: false });
  }

  function serializeDocument(doc) {
    const session = getSession();
    return session ? session.serializeDocument(doc) : String(doc && doc.content ? doc.content : "");
  }

  function deserializeToDocument(data) {
    const session = getSession();
    return session ? session.deserializeToDocument(data) : { path: null, dirty: false, content: String(data || "") };
  }

  return {
    setCurrentDocument,
    clearCurrentDocument,
    getCurrentDocument,
    hasCurrentDocument,
    getCurrentDocumentPath,
    isCurrentDocumentDirty,
    ensureCurrentDocument,
    patchCurrentDocument,
    markCurrentDocumentClean,
    updateUIFromDocument,
    showEmptyState,
    serializeDocument,
    deserializeToDocument,
  };
}

export {
  createCurrentDocumentController,
};
