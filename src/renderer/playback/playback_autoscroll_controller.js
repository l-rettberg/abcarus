function createPlaybackAutoScrollController({
  windowRef,
  consoleRef = console,
  getRenderPane,
  getOutElement,
  getPlayheadElement,
  isPlaybackBusy,
  clampNumber,
  getRenderZoomFactor,
  isDebugEnabled,
} = {}) {
  let playbackAutoScrollMode = "keep";
  let playbackAutoScrollHorizontal = true;
  let playbackAutoScrollPauseMs = 1800;
  let playbackAutoScrollManualUntil = 0;
  let playbackAutoScrollIgnoreUntil = 0;
  let playbackAutoScrollAnim = null; // {raf,startAt,duration,fromTop,fromLeft,toTop,toLeft}
  let playbackAutoScrollProgrammatic = false;
  let playbackAutoScrollLastAt = 0;
  let playbackAutoScrollDebugLastAt = 0;

  const nowMs = () => {
    const perf = windowRef && windowRef.performance;
    return perf && typeof perf.now === "function" ? perf.now() : Date.now();
  };

  const raf = (fn) => {
    if (windowRef && typeof windowRef.requestAnimationFrame === "function") {
      return windowRef.requestAnimationFrame(fn);
    }
    return setTimeout(() => fn(nowMs()), 16);
  };

  const cancelRaf = (id) => {
    if (windowRef && typeof windowRef.cancelAnimationFrame === "function") {
      windowRef.cancelAnimationFrame(id);
      return;
    }
    clearTimeout(id);
  };

  function normalizeAutoScrollMode(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (!s) return "keep";
    if (s.startsWith("off")) return "off";
    if (s.startsWith("page")) return "page";
    if (s.startsWith("center")) return "center";
    return "keep";
  }

  function setModeForDev(raw) {
    playbackAutoScrollMode = normalizeAutoScrollMode(raw);
    return playbackAutoScrollMode;
  }

  function resetManualPause() {
    playbackAutoScrollManualUntil = 0;
  }

  function setFromSettings(settings) {
    if (!settings || typeof settings !== "object") return;
    playbackAutoScrollMode = normalizeAutoScrollMode(settings.playbackAutoScrollMode);
    playbackAutoScrollHorizontal = settings.playbackAutoScrollHorizontal !== false;
    playbackAutoScrollPauseMs = clampNumber(settings.playbackAutoScrollPauseMs, 0, 5000, playbackAutoScrollPauseMs);
    if (normalizeAutoScrollMode(playbackAutoScrollMode) === "off") {
      cancelPlaybackAutoScroll();
    }
  }

  function debugAutoScroll(tag, detail) {
    if (typeof isDebugEnabled === "function" && !isDebugEnabled()) return;
    const now = nowMs();
    if (now - playbackAutoScrollDebugLastAt < 600) return;
    playbackAutoScrollDebugLastAt = now;
    try {
      const debug = (detail && typeof detail === "object") ? { ...detail } : {};
      debug.zoom = Math.round(getRenderZoomFactor() * 100) / 100;
      try {
        const getStyle = windowRef && windowRef.getComputedStyle;
        debug.cssZoom = String(getStyle(windowRef.document.documentElement).getPropertyValue("--render-zoom") || "").trim();
      } catch {
        debug.cssZoom = "";
      }
      try {
        const out = typeof getOutElement === "function" ? getOutElement() : null;
        const getStyle = windowRef && windowRef.getComputedStyle;
        debug.outZoom = out && getStyle ? String(getStyle(out).zoom || "").trim() : "";
      } catch {
        debug.outZoom = "";
      }
      const pane = typeof getRenderPane === "function" ? getRenderPane() : null;
      if (pane) {
        debug.pane = {
          top: Math.round(pane.scrollTop),
          left: Math.round(pane.scrollLeft),
          scrollH: Math.round(pane.scrollHeight),
          scrollW: Math.round(pane.scrollWidth),
          clientH: Math.round(pane.clientHeight),
          clientW: Math.round(pane.clientWidth),
        };
      }
      const msgParts = [`[abcarus][autoscroll] ${tag}`];
      if (debug.mode) msgParts.push(`mode=${debug.mode}`);
      if (Number.isFinite(debug.zoom)) msgParts.push(`z=${debug.zoom}`);
      if (debug.cssZoom) msgParts.push(`css=${debug.cssZoom}`);
      if (debug.outZoom) msgParts.push(`out=${debug.outZoom}`);
      if (Number.isFinite(debug.clampedTop) && Number.isFinite(debug.nextTop)) {
        msgParts.push(`top=${debug.clampedTop}/${Math.round(debug.nextTop)}`);
      }
      if (Number.isFinite(debug.cursorTop) && Number.isFinite(debug.cursorBottom) && Number.isFinite(debug.viewTop) && Number.isFinite(debug.viewBottom)) {
        msgParts.push(`cursorY=${debug.cursorTop}..${debug.cursorBottom}`);
        msgParts.push(`viewY=${debug.viewTop}..${debug.viewBottom}`);
      }
      if (debug.pane && Number.isFinite(debug.pane.scrollH) && Number.isFinite(debug.pane.clientH)) {
        msgParts.push(`scrollY=${debug.pane.top}/${Math.max(0, debug.pane.scrollH - debug.pane.clientH)}`);
      }
      consoleRef.log(msgParts.join(" "), debug);
    } catch {}
  }

  function initPlaybackAutoScrollListeners() {
    const pane = typeof getRenderPane === "function" ? getRenderPane() : null;
    if (!pane) return;
    const markManual = () => {
      const ms = clampNumber(playbackAutoScrollPauseMs, 0, 5000, 1800);
      playbackAutoScrollManualUntil = nowMs() + ms;
    };
    pane.addEventListener("wheel", () => markManual(), { passive: true });
    pane.addEventListener("pointerdown", () => markManual(), { passive: true });
    pane.addEventListener("scroll", () => {
      const now = nowMs();
      if (now < playbackAutoScrollIgnoreUntil) return;
      if (playbackAutoScrollProgrammatic) return;
      if (playbackAutoScrollAnim && playbackAutoScrollAnim.raf != null) return;
      markManual();
    }, { passive: true });
  }

  function cancelPlaybackAutoScroll() {
    if (playbackAutoScrollAnim && playbackAutoScrollAnim.raf != null) {
      try { cancelRaf(playbackAutoScrollAnim.raf); } catch {}
    }
    playbackAutoScrollAnim = null;
    playbackAutoScrollProgrammatic = false;
  }

  function animateRenderPaneScrollTo(targetTop, targetLeft, durationMs) {
    const pane = typeof getRenderPane === "function" ? getRenderPane() : null;
    if (!pane) return;
    const maxTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
    const maxLeft = Math.max(0, pane.scrollWidth - pane.clientWidth);
    const toTop = Math.max(0, Math.min(maxTop, Number(targetTop) || 0));
    const toLeft = Math.max(0, Math.min(maxLeft, Number(targetLeft) || 0));

    const fromTop = pane.scrollTop;
    const fromLeft = pane.scrollLeft;
    const dx = Math.abs(toLeft - fromLeft);
    const dy = Math.abs(toTop - fromTop);
    if (dx < 1 && dy < 1) return;

    const now = nowMs();
    const duration = clampNumber(durationMs, 0, 2000, 250);
    cancelPlaybackAutoScroll();
    playbackAutoScrollProgrammatic = true;
    playbackAutoScrollIgnoreUntil = now + Math.min(2500, Math.max(200, duration + 100));

    playbackAutoScrollAnim = {
      raf: null,
      startAt: now,
      duration,
      fromTop,
      fromLeft,
      toTop,
      toLeft,
    };

    const step = (tNow) => {
      const currentPane = typeof getRenderPane === "function" ? getRenderPane() : null;
      if (!currentPane || !playbackAutoScrollAnim) return;
      const a = playbackAutoScrollAnim;
      const t = a.duration > 0 ? Math.max(0, Math.min(1, (tNow - a.startAt) / a.duration)) : 1;
      const ease = 1 - Math.pow(1 - t, 3);
      const nextTop = a.fromTop + (a.toTop - a.fromTop) * ease;
      const nextLeft = a.fromLeft + (a.toLeft - a.fromLeft) * ease;
      currentPane.scrollTop = nextTop;
      currentPane.scrollLeft = nextLeft;
      if (t < 1) {
        a.raf = raf(step);
      } else {
        playbackAutoScrollAnim = null;
        playbackAutoScrollProgrammatic = false;
      }
    };
    playbackAutoScrollAnim.raf = raf(step);
  }

  function maybeAutoScrollRenderToCursor(el) {
    const pane = typeof getRenderPane === "function" ? getRenderPane() : null;
    if (!pane) return;
    if (!el) {
      debugAutoScroll("skip:no-el");
      return;
    }
    if (!isPlaybackBusy()) {
      debugAutoScroll("skip:not-busy");
      return;
    }

    const mode = normalizeAutoScrollMode(playbackAutoScrollMode);
    if (mode === "off") {
      debugAutoScroll("skip:mode-off");
      return;
    }

    const now = nowMs();
    if (now < playbackAutoScrollManualUntil) {
      debugAutoScroll("skip:manual-pause", {
        mode,
        remainingMs: Math.round(playbackAutoScrollManualUntil - now),
        programmatic: Boolean(playbackAutoScrollProgrammatic),
        animating: Boolean(playbackAutoScrollAnim && playbackAutoScrollAnim.raf != null),
      });
      return;
    }
    if (now - playbackAutoScrollLastAt < 80) {
      debugAutoScroll("skip:throttle", { mode });
      return;
    }
    playbackAutoScrollLastAt = now;

    const targetEl = (typeof getPlayheadElement === "function" ? getPlayheadElement() : null) || el;
    if (!targetEl) {
      debugAutoScroll("skip:no-target-el", { mode });
      return;
    }
    const containerRect = pane.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    const viewTop = pane.scrollTop;
    const viewBottom = viewTop + pane.clientHeight;
    const viewLeft = pane.scrollLeft;
    const viewRight = viewLeft + pane.clientWidth;

    const h = pane.clientHeight || 1;
    const w = pane.clientWidth || 1;
    const playheadH = targetRect.height;
    const topMargin = Math.max(40, h * 0.15);
    const bottomMargin = mode === "keep"
      ? Math.max(40, h * 0.15 + playheadH * 2.2)
      : Math.max(40, h * (mode === "page" ? 0.25 : 0.15), playheadH * 0.8);
    const leftMargin = Math.max(40, w * 0.12);
    const rightMargin = Math.max(40, w * 0.12);

    const allowH = Boolean(playbackAutoScrollHorizontal);

    if (mode === "keep" || mode === "center") {
      const padTop = mode === "keep" ? topMargin : 0;
      const padBottom = mode === "keep" ? bottomMargin : 0;
      const padLeft = allowH ? (mode === "keep" ? leftMargin : 0) : 0;
      const padRight = allowH ? (mode === "keep" ? rightMargin : 0) : 0;

      try {
        pane.style.scrollPaddingTop = `${Math.round(padTop)}px`;
        pane.style.scrollPaddingBottom = `${Math.round(padBottom)}px`;
        pane.style.scrollPaddingLeft = `${Math.round(padLeft)}px`;
        pane.style.scrollPaddingRight = `${Math.round(padRight)}px`;
      } catch {}

      const fromTop = viewTop;
      const fromLeft = viewLeft;
      let toTop = viewTop;
      let toLeft = viewLeft;
      try {
        playbackAutoScrollProgrammatic = true;
        playbackAutoScrollIgnoreUntil = now + 250;
        targetEl.scrollIntoView({
          block: mode === "center" ? "center" : "nearest",
          inline: allowH ? (mode === "center" ? "center" : "nearest") : "nearest",
          behavior: "auto",
        });
        toTop = pane.scrollTop;
        toLeft = allowH ? pane.scrollLeft : fromLeft;
      } catch {
      } finally {
        try {
          pane.scrollTop = fromTop;
          pane.scrollLeft = fromLeft;
        } catch {}
        playbackAutoScrollProgrammatic = false;
      }

      const relTop = targetRect.top - containerRect.top;
      const relBottom = relTop + targetRect.height;
      const relLeft = targetRect.left - containerRect.left;
      const relRight = relLeft + targetRect.width;

      const duration = 0;
      const maxTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
      const maxLeft = Math.max(0, pane.scrollWidth - pane.clientWidth);
      const clampedTop = Math.max(0, Math.min(maxTop, Number(toTop) || 0));
      const clampedLeft = Math.max(0, Math.min(maxLeft, Number(toLeft) || 0));
      const dx = Math.abs(clampedLeft - viewLeft);
      const dy = Math.abs(clampedTop - viewTop);
      debugAutoScroll(dx < 1 && dy < 1 ? "noop" : "scroll", {
        mode,
        viewTop: Math.round(viewTop),
        viewBottom: Math.round(viewBottom),
        viewLeft: Math.round(viewLeft),
        viewRight: Math.round(viewRight),
        cursorTop: Math.round(viewTop + relTop),
        cursorBottom: Math.round(viewTop + relBottom),
        cursorLeft: Math.round(viewLeft + relLeft),
        cursorRight: Math.round(viewLeft + relRight),
        nextTop: Math.round(toTop),
        nextLeft: Math.round(toLeft),
        clampedTop: Math.round(clampedTop),
        clampedLeft: Math.round(clampedLeft),
        maxTop: Math.round(maxTop),
        maxLeft: Math.round(maxLeft),
        topMargin: Math.round(topMargin),
        bottomMargin: Math.round(bottomMargin),
        leftMargin: Math.round(leftMargin),
        rightMargin: Math.round(rightMargin),
      });
      if (dx < 1 && dy < 1) return;
      animateRenderPaneScrollTo(clampedTop, clampedLeft, duration);
      return;
    }

    const relTop = targetRect.top - containerRect.top;
    const relBottom = relTop + targetRect.height;
    const relLeft = targetRect.left - containerRect.left;
    const relRight = relLeft + targetRect.width;

    let nextTop = viewTop;
    let nextLeft = viewLeft;

    if (mode === "center") {
      const desiredTop = h * 0.5 - targetRect.height * 0.5;
      nextTop = viewTop + (relTop - desiredTop);
    } else if (mode === "page") {
      const desiredTop = h * 0.1;
      if (relBottom > h - bottomMargin) {
        nextTop = viewTop + (relTop - desiredTop);
      } else if (relTop < topMargin) {
        nextTop = viewTop + (relTop - desiredTop);
      }
    } else {
      if (relTop < topMargin) {
        nextTop = viewTop + (relTop - topMargin);
      } else if (relBottom > h - bottomMargin) {
        nextTop = viewTop + (relBottom - (h - bottomMargin));
      }
    }

    if (allowH) {
      if (mode === "center") {
        const desiredLeft = w * 0.5 - targetRect.width * 0.5;
        nextLeft = viewLeft + (relLeft - desiredLeft);
      } else {
        if (relLeft < leftMargin) {
          nextLeft = viewLeft + (relLeft - leftMargin);
        } else if (relRight > w - rightMargin) {
          nextLeft = viewLeft + (relRight - (w - rightMargin));
        }
      }
    }

    const duration = 0;
    const maxTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
    const maxLeft = Math.max(0, pane.scrollWidth - pane.clientWidth);
    const clampedTop = Math.max(0, Math.min(maxTop, Number(nextTop) || 0));
    const clampedLeft = Math.max(0, Math.min(maxLeft, Number(nextLeft) || 0));
    const dx = Math.abs(clampedLeft - viewLeft);
    const dy = Math.abs(clampedTop - viewTop);
    debugAutoScroll(dx < 1 && dy < 1 ? "noop" : "scroll", {
      mode,
      viewTop: Math.round(viewTop),
      viewBottom: Math.round(viewBottom),
      viewLeft: Math.round(viewLeft),
      viewRight: Math.round(viewRight),
      cursorTop: Math.round(viewTop + relTop),
      cursorBottom: Math.round(viewTop + relBottom),
      cursorLeft: Math.round(viewLeft + relLeft),
      cursorRight: Math.round(viewLeft + relRight),
      topMargin: Math.round(topMargin),
      bottomMargin: Math.round(bottomMargin),
      leftMargin: Math.round(leftMargin),
      rightMargin: Math.round(rightMargin),
      nextTop: Math.round(nextTop),
      nextLeft: Math.round(nextLeft),
      clampedTop: Math.round(clampedTop),
      clampedLeft: Math.round(clampedLeft),
      maxTop: Math.round(maxTop),
      maxLeft: Math.round(maxLeft),
      relTop: Math.round(relTop),
      relBottom: Math.round(relBottom),
      relLeft: Math.round(relLeft),
      relRight: Math.round(relRight),
    });
    if (dx < 1 && dy < 1) return;
    animateRenderPaneScrollTo(clampedTop, clampedLeft, duration);
  }

  return {
    normalizeAutoScrollMode,
    setModeForDev,
    resetManualPause,
    setFromSettings,
    debugAutoScroll,
    initPlaybackAutoScrollListeners,
    cancelPlaybackAutoScroll,
    animateRenderPaneScrollTo,
    maybeAutoScrollRenderToCursor,
  };
}

export { createPlaybackAutoScrollController };
