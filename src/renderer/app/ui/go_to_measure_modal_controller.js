function createGoToMeasureModalElements() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal";
  backdrop.setAttribute("aria-hidden", "true");

  const dialog = document.createElement("div");
  dialog.className = "modal-card compact-modal-card";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Go to Measure");

  const header = document.createElement("div");
  header.className = "modal-header";

  const title = document.createElement("div");
  title.className = "modal-title";
  title.textContent = "Go to Measure";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "modal-close";
  close.setAttribute("aria-label", "Close Go to Measure");
  close.title = "Close";
  close.textContent = "×";
  header.append(title, close);

  const body = document.createElement("div");
  body.className = "modal-body";

  const label = document.createElement("label");
  label.className = "compact-modal-label";
  label.textContent = "Measure number:";

  const input = document.createElement("input");
  input.className = "compact-modal-input";
  input.type = "number";
  input.inputMode = "numeric";
  input.min = "0";
  input.step = "1";
  input.autocomplete = "off";
  input.spellcheck = false;

  label.appendChild(input);
  body.appendChild(label);

  const buttons = document.createElement("div");
  buttons.className = "modal-footer";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";

  const ok = document.createElement("button");
  ok.type = "button";
  ok.className = "primary";
  ok.textContent = "OK";

  buttons.append(cancel, ok);
  dialog.append(header, body, buttons);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  return { backdrop, dialog, input, ok, cancel, close };
}

export function createGoToMeasureModalController() {
  let elements = null;

  const getElements = () => {
    if (!elements) elements = createGoToMeasureModalElements();
    return elements;
  };

  const prompt = async () => {
    const { backdrop, dialog, input, ok, cancel, close } = getElements();
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");

    const prevActive = document.activeElement;

    const cleanup = () => {
      backdrop.classList.remove("open");
      backdrop.setAttribute("aria-hidden", "true");
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
      const onClose = () => finish(null);

      const teardown = () => {
        ok.removeEventListener("click", onOk);
        cancel.removeEventListener("click", onCancel);
        close.removeEventListener("click", onClose);
        document.removeEventListener("keydown", onKeyDown, true);
      };

      ok.addEventListener("click", onOk);
      cancel.addEventListener("click", onCancel);
      close.addEventListener("click", onClose);
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
