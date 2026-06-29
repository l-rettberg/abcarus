async function createQrDataUrl(text, { size = 96 } = {}) {
  const value = String(text || "").trim();
  const QRCodeCtor = window && typeof window.QRCode === "function" ? window.QRCode : null;
  if (!value || !QRCodeCtor) return "";
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.width = `${Math.max(1, size)}px`;
  holder.style.height = `${Math.max(1, size)}px`;
  document.body.appendChild(holder);
  try {
    const options = {
      text: value,
      width: Math.max(1, size),
      height: Math.max(1, size),
    };
    if (QRCodeCtor.CorrectLevel && QRCodeCtor.CorrectLevel.M) {
      options.correctLevel = QRCodeCtor.CorrectLevel.M;
    }
    new QRCodeCtor(holder, options);
    const canvas = holder.querySelector("canvas");
    if (canvas && typeof canvas.toDataURL === "function") {
      return canvas.toDataURL("image/png");
    }
    const img = holder.querySelector("img");
    return img && img.src ? String(img.src) : "";
  } catch {
    return "";
  } finally {
    holder.remove();
  }
}

export {
  createQrDataUrl,
};
