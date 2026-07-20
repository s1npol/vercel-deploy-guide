(() => {
  if (window.__portfolioPageTurnBridgeReady) return;
  window.__portfolioPageTurnBridgeReady = true;

  const root = document.documentElement;
  const state = {
    phase: "unbound",
    forward: null,
    reverse: null,
    monitorFrame: 0,
    monitorRun: 0,
    lastForwardAt: 0,
    lastReverseAt: 0,
  };

  const emit = (phase, source = "legacy") => {
    state.phase = phase;
    root.dataset.pgPageTurnState = phase;
    window.dispatchEvent(new CustomEvent("portfolio:page-turn-state", {
      detail: { phase, source },
    }));
    if (phase === "before" || phase === "after") {
      window.dispatchEvent(new CustomEvent("portfolio:page-turn-settled", {
        detail: { phase, source },
      }));
    }
  };

  const readVisualState = () => {
    const canvas = document.querySelector("#canvasPin");
    const heading = document.querySelector(".timeline_heading");
    const viewportHeight = Math.max(1, window.innerHeight);
    if (!canvas) {
      return {
        canvasTop: viewportHeight,
        headingOpacity: heading ? Number.parseFloat(getComputedStyle(heading).opacity) || 0 : 1,
        viewportHeight,
      };
    }
    return {
      canvasTop: canvas.getBoundingClientRect().top,
      headingOpacity: heading ? Number.parseFloat(getComputedStyle(heading).opacity) || 0 : 1,
      viewportHeight,
    };
  };

  const stopMonitor = () => {
    if (state.monitorFrame) cancelAnimationFrame(state.monitorFrame);
    state.monitorFrame = 0;
    state.monitorRun += 1;
  };

  const monitor = (direction) => {
    stopMonitor();
    const run = state.monitorRun;
    const startedAt = performance.now();
    const timeout = direction === "forward" ? 7200 : 6200;

    const step = (now) => {
      if (run !== state.monitorRun) return;
      const visual = readVisualState();
      const forwardReady =
        visual.canvasTop <= -visual.viewportHeight * 0.9 &&
        visual.headingOpacity > 0.08;
      const reverseReady = visual.canvasTop >= visual.viewportHeight * 0.9;

      if ((direction === "forward" && forwardReady) || (direction === "reverse" && reverseReady)) {
        state.monitorFrame = 0;
        emit(direction === "forward" ? "after" : "before", "visual-settle");
        return;
      }

      if (now - startedAt >= timeout) {
        state.monitorFrame = 0;
        emit(direction === "forward" ? "forward-timeout" : "reverse-timeout", "timeout");
        return;
      }

      state.monitorFrame = requestAnimationFrame(step);
    };

    state.monitorFrame = requestAnimationFrame(step);
  };

  const invokeForward = (callback, context, args = []) => {
    const now = performance.now();
    if (now - state.lastForwardAt < 180) return false;
    state.lastForwardAt = now;
    emit("forward", "request");
    try {
      callback?.apply(context, args);
      monitor("forward");
      return true;
    } catch (error) {
      emit("forward-error", "exception");
      return false;
    }
  };

  const invokeReverse = (callback, context, args = []) => {
    const now = performance.now();
    if (now - state.lastReverseAt < 180) return false;
    state.lastReverseAt = now;
    emit("reverse", "request");
    try {
      callback?.apply(context, args);
      monitor("reverse");
      return true;
    } catch (error) {
      emit("reverse-error", "exception");
      return false;
    }
  };

  const captureScrollTrigger = (config) => {
    if (!config || typeof config !== "object") return config;

    if (config.id === "canvasScroll" && typeof config.onLeave === "function") {
      const originalForward = config.onLeave;
      const guardedForward = function (...args) {
        return invokeForward(originalForward, this, args);
      };
      config.onLeave = guardedForward;
      state.forward = () => guardedForward();
    }

    if (
      config.trigger === "[home-trigger]" &&
      typeof config.onEnterBack === "function"
    ) {
      const originalReverse = config.onEnterBack;
      const guardedReverse = function (...args) {
        return invokeReverse(originalReverse, this, args);
      };
      config.onEnterBack = guardedReverse;
      state.reverse = () => guardedReverse();
    }

    if (state.forward && state.reverse && state.phase === "unbound") {
      emit("ready", "capture");
    }

    return config;
  };

  if (window.gsap?.to && !window.gsap.to.__pgPageTurnBridge) {
    const originalTo = window.gsap.to;
    const bridgedTo = function (targets, vars) {
      if (vars?.scrollTrigger) captureScrollTrigger(vars.scrollTrigger);
      return originalTo.apply(this, arguments);
    };
    bridgedTo.__pgPageTurnBridge = true;
    window.gsap.to = bridgedTo;
  }

  if (window.ScrollTrigger?.create && !window.ScrollTrigger.create.__pgPageTurnBridge) {
    const originalCreate = window.ScrollTrigger.create;
    const bridgedCreate = function (config) {
      captureScrollTrigger(config);
      return originalCreate.apply(this, arguments);
    };
    bridgedCreate.__pgPageTurnBridge = true;
    window.ScrollTrigger.create = bridgedCreate;
  }

  window.__portfolioPageTurn = {
    getState() {
      return state.phase;
    },
    isReady() {
      return typeof state.forward === "function" && typeof state.reverse === "function";
    },
    forward() {
      if (!state.forward) return false;
      return state.forward();
    },
    reverse() {
      if (!state.reverse) return false;
      return state.reverse();
    },
    sync() {
      const visual = readVisualState();
      if (visual.canvasTop <= -visual.viewportHeight * 0.9 && visual.headingOpacity > 0.08) {
        emit("after", "sync");
      } else if (visual.canvasTop >= visual.viewportHeight * 0.9) {
        emit("before", "sync");
      }
      return state.phase;
    },
    settleAfter() {
      stopMonitor();
      const canvas = document.querySelector("#canvasPin");
      const heading = document.querySelector(".timeline_heading");
      const columns = document.querySelectorAll(".timeline_colum_left");
      const progress = document.querySelectorAll(".timeline_progress_main, .timeline_progress");
      const engine =
        window.__portfolioLenis || (typeof lenis !== "undefined" ? lenis : null);

      if (window.gsap && canvas) {
        window.gsap.killTweensOf(canvas);
        window.gsap.set(canvas, { y: "-100%", opacity: 1 });
        if (heading) window.gsap.set(heading, { y: "0%", scale: 1, opacity: 1 });
        if (columns.length) window.gsap.set(columns, { y: "0%", opacity: 1 });
        if (progress.length) window.gsap.set(progress, { opacity: 1 });
      }
      engine?.start?.();
      emit("after", "fallback");
    },
    settleBefore() {
      stopMonitor();
      const canvas = document.querySelector("#canvasPin");
      const engine =
        window.__portfolioLenis || (typeof lenis !== "undefined" ? lenis : null);
      if (window.gsap && canvas) {
        window.gsap.killTweensOf(canvas);
        window.gsap.set(canvas, { position: "fixed", y: "99.26svh", opacity: 1 });
      }
      engine?.start?.();
      emit("before", "fallback");
    },
  };
})();
