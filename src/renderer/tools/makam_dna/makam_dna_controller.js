function createMakamDnaController({
  modal,
  closeButton,
  cancelButton,
  editor,
  status,
  resetBuiltinButton,
  saveButton,
  api,
  ensureLoaded,
  getInitialText,
  validateText,
  applyText,
  resetBuiltin,
  enableDraggable,
  onSaved,
  onError,
} = {}) {
  function setStatus(message, { error = false } = {}) {
    if (!status) return;
    const text = String(message || "");
    status.textContent = text;
    status.classList.toggle("error", Boolean(error && text));
  }

  function close() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    setStatus("");
  }

  async function open() {
    if (!modal || !editor) return;
    if (typeof ensureLoaded === "function") await ensureLoaded();
    editor.value = typeof getInitialText === "function" ? String(getInitialText() || "") : "";
    setStatus("");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    try { editor.focus(); } catch {}
  }

  async function handleResetBuiltin() {
    setStatus("");
    if (!api || typeof api.clearMakamDnaUser !== "function") {
      setStatus("Not available in this build.", { error: true });
      return;
    }
    try {
      const res = await api.clearMakamDnaUser();
      if (!res || !res.ok) {
        setStatus(res && res.error ? String(res.error) : "Reset failed.", { error: true });
        return;
      }
      const text = typeof resetBuiltin === "function" ? await resetBuiltin() : "";
      if (editor) editor.value = String(text || "");
      setStatus("Reset to built-in.");
    } catch (e) {
      if (typeof onError === "function") onError(e);
      setStatus("Reset failed.", { error: true });
    }
  }

  async function handleSave() {
    setStatus("");
    if (!editor) return;
    const text = String(editor.value || "");
    const parsed = typeof validateText === "function" ? validateText(text) : { ok: true };
    if (!parsed || !parsed.ok) {
      setStatus(parsed && parsed.error ? parsed.error : "Invalid Makam DNA.", { error: true });
      return;
    }
    if (!api || typeof api.saveMakamDnaUser !== "function") {
      setStatus("Not available in this build.", { error: true });
      return;
    }
    try {
      const res = await api.saveMakamDnaUser(text);
      if (!res || !res.ok) {
        setStatus(res && res.error ? String(res.error) : "Save failed.", { error: true });
        return;
      }
      const applied = typeof applyText === "function" ? await applyText(text) : { ok: true };
      if (!applied || !applied.ok) {
        setStatus(applied && applied.error ? applied.error : "Save failed.", { error: true });
        return;
      }
      close();
      if (typeof onSaved === "function") onSaved();
    } catch (e) {
      if (typeof onError === "function") onError(e);
      setStatus("Save failed.", { error: true });
    }
  }

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      close();
    });
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      close();
    });
  }

  if (resetBuiltinButton) {
    resetBuiltinButton.addEventListener("click", () => {
      handleResetBuiltin().catch((e) => {
        if (typeof onError === "function") onError(e);
        setStatus("Reset failed.", { error: true });
      });
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", () => {
      handleSave().catch((e) => {
        if (typeof onError === "function") onError(e);
        setStatus("Save failed.", { error: true });
      });
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    modal.addEventListener("keydown", (e) => {
      if (!e) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "Enter" && saveButton) {
        e.preventDefault();
        e.stopPropagation();
        saveButton.click();
      }
    });
    if (typeof enableDraggable === "function") enableDraggable(modal);
  }

  return {
    close,
    open,
    setStatus,
  };
}

export {
  createMakamDnaController,
};
