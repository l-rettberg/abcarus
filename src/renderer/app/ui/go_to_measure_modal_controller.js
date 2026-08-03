function createGoToMeasureModalElements() {
  const backdrop = document.createElement("div");
  backdrop.className = "abcarus-modal-backdrop hidden";

  const dialog = document.createElement("div");
  dialog.className = "abcarus-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const title = document.createElement("div");
  title.className = "abcarus-modal-title";
  title.textContent = "Go to Measure";

  const body = document.createElement("div");
  body.className = "abcarus-modal-body";

  const label = document.createElement("label");
  label.className = "abcarus-modal-label";
  label.textContent = "Measure number:";

  const input = document.createElement("input");
  input.className = "abcarus-modal-input";
  input.type = "number";
  input.inputMode = "numeric";
  input.min = "0";
  input.step = "1";
  input.autocomplete = "off";
  input.spellcheck = false;

  label.appendChild(input);
  body.appendChild(label);

  const buttons = document.createElement("div");
  buttons.className = "abcarus-modal-buttons";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn abcarus-modal-btn";
  cancel.textContent = "Cancel";

  const ok = document.createElement("button");
  ok.type = "button";
  ok.className = "btn abcarus-modal-btn primary";
  ok.textContent = "OK";

  buttons.append(cancel, ok);
  dialog.append(title, body, buttons);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  return { backdrop, dialog, input, ok, cancel };
}

export function createGoToMeasureModalController() {
  let elements = null;

  const getElements = () => {
    if (!elements) elements = createGoToMeasureModalElements();
    return elements;
  };

  const prompt = async () => {
    const { backdrop, dialog, input, ok, cancel } = getElements();
    backdrop.classList.remove("hidden");

    const prevActive = document.activeElement;

    const cleanup = () => {
      backdrop.classList.add("hidden");
      try {
        if (prevActive && typeof prevActive.focus === "function") prevActive.focus();
      } catch {}
    };

    return await new Promise((resolve) => {
      const finish = (value) => {
        teardown();
        cleanup();
        resolve(value);
      };

      const onBackdropMouseDown = (ev) => {
        if (ev.target === backdrop) finish(null);
      };
      const onKeyDown = (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          finish(null);
          return;
        }
        if (ev.key === "Enter") {
          ev.preventDefault();
          finish(String(input.value || ""));
        }
      };
      const onOk = () => finish(String(input.value || ""));
      const onCancel = () => finish(null);

      const teardown = () => {
        backdrop.removeEventListener("mousedown", onBackdropMouseDown);
        ok.removeEventListener("click", onOk);
        cancel.removeEventListener("click", onCancel);
        document.removeEventListener("keydown", onKeyDown, true);
      };

      backdrop.addEventListener("mousedown", onBackdropMouseDown);
      ok.addEventListener("click", onOk);
      cancel.addEventListener("click", onCancel);
      document.addEventListener("keydown", onKeyDown, true);

      requestAnimationFrame(() => {
        input.value = "";
        input.focus();
        input.select();
        try {
          dialog.scrollIntoView({ block: "center", inline: "center" });
        } catch {}
      });
    });
  };

  return { prompt };
}
