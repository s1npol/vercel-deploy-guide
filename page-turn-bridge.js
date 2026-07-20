(() => {
  if (window.__portfolioPageTurnBridgeReady) return;
  window.__portfolioPageTurnBridgeReady = true;

  const root = document.documentElement;
  const canvasContextPrototype = window.CanvasRenderingContext2D?.prototype;
  if (
    canvasContextPrototype?.drawImage &&
    !canvasContextPrototype.drawImage.__pgBrokenImageGuard
  ) {
    const originalDrawImage = canvasContextPrototype.drawImage;
    const guardedDrawImage = function (source) {
      const brokenImage =
        source instanceof HTMLImageElement &&
        source.complete &&
        (!source.naturalWidth || !source.naturalHeight);
      if (brokenImage) {
        root.dataset.pgSequenceFrameSkipped = "true";
        return;
      }
      return originalDrawImage.apply(this, arguments);
    };
    guardedDrawImage.__pgBrokenImageGuard = true;
    canvasContextPrototype.drawImage = guardedDrawImage;
  }

  const state = {
    phase: "unbound",
    forward: null,
    reverse: null,
    monitorFrame: 0,
    monitorRun: 0,
    lastForwardAt: 0,
    lastReverseAt: 0,
    forwardWatchdog: 0,
    rescueTimeline: null,
  };

  const clearForwardWatchdog = () => {
    window.clearTimeout(state.forwardWatchdog);
    state.forwardWatchdog = 0;
  };

  const emit = (phase, source = "legacy") => {
    state.phase = phase;
    root.dataset.pgPageTurnState = phase;
    if (phase === "before" || phase === "after") {
      clearForwardWatchdog();
      delete root.dataset.pgPageTurnError;
    }
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

  const getScrollEngine = () =>
    window.__portfolioLenis || (typeof lenis !== "undefined" ? lenis : null);

  const alignExperience = () => {
    const target =
      document.querySelector("#pg-experience") ||
      document.querySelector(".timeline_wrapper");
    if (!target) return;
    const navHeight = document.querySelector(".pg-nav")?.getBoundingClientRect().height || 0;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const top = Math.max(
      0,
      Math.min(target.getBoundingClientRect().top + window.scrollY - navHeight, maxScroll),
    );
    const engine = getScrollEngine();
    engine?.start?.();
    if (engine?.scrollTo) engine.scrollTo(top, { immediate: true, force: true });
    else window.scrollTo(0, top);
  };

  const revealExperience = (immediate = false) => {
    const heading = document.querySelector(".timeline_heading");
    const columns = document.querySelectorAll(".timeline_colum_left");
    const progress = document.querySelectorAll(
      ".timeline_progress_main, .timeline_progress",
    );
    const gsap = window.gsap;

    if (!gsap) {
      if (heading) {
        heading.style.opacity = "1";
        heading.style.transform = "none";
      }
      columns.forEach((column) => {
        column.style.opacity = "1";
        column.style.transform = "none";
      });
      progress.forEach((element) => {
        element.style.opacity = "1";
      });
      return;
    }

    const duration = immediate ? 0 : 0.52;
    if (heading) {
      gsap.to(heading, {
        y: "0%",
        scale: 1,
        opacity: 1,
        duration,
        ease: "power3.out",
        overwrite: true,
      });
    }
    if (columns.length) {
      gsap.to(columns, {
        y: "0%",
        opacity: 1,
        duration,
        stagger: immediate ? 0 : 0.045,
        ease: "power3.out",
        overwrite: true,
      });
    }
    if (progress.length) {
      gsap.to(progress, {
        opacity: 1,
        duration: immediate ? 0 : 0.4,
        overwrite: true,
      });
    }
  };

  const stopMonitor = () => {
    if (state.monitorFrame) cancelAnimationFrame(state.monitorFrame);
    state.monitorFrame = 0;
    state.monitorRun += 1;
  };

  const settleAfterInstant = (source = "fallback", shouldAlign = false) => {
    stopMonitor();
    clearForwardWatchdog();
    state.rescueTimeline?.kill?.();
    state.rescueTimeline = null;
    const canvas = document.querySelector("#canvasPin");
    const gsap = window.gsap;

    if (gsap && canvas) {
      gsap.killTweensOf(canvas);
      gsap.set(canvas, { position: "fixed", y: "-100%", opacity: 1 });
    } else if (canvas) {
      canvas.style.transform = "translate3d(0, -100%, 0)";
      canvas.style.opacity = "1";
    }
    revealExperience(true);
    getScrollEngine()?.start?.();
    if (shouldAlign) alignExperience();
    window.ScrollTrigger?.refresh?.();
    emit("after", source);
  };

  const settleBeforeInstant = (source = "fallback") => {
    stopMonitor();
    clearForwardWatchdog();
    state.rescueTimeline?.kill?.();
    state.rescueTimeline = null;
    const canvas = document.querySelector("#canvasPin");
    const gsap = window.gsap;

    if (gsap && canvas) {
      gsap.killTweensOf(canvas);
      gsap.set(canvas, { position: "fixed", y: "99.26svh", opacity: 1 });
    } else if (canvas) {
      canvas.style.transform = "translate3d(0, 99.26svh, 0)";
      canvas.style.opacity = "1";
    }
    getScrollEngine()?.start?.();
    emit("before", source);
  };

  const rescueForward = (source = "stalled") => {
    if (state.phase === "after" || state.phase === "forward-recovery") return;
    stopMonitor();
    clearForwardWatchdog();

    const canvas = document.querySelector("#canvasPin");
    const gsap = window.gsap;
    const engine = getScrollEngine();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    emit("forward-recovery", source);

    if (!canvas || !gsap || reducedMotion) {
      settleAfterInstant("recovery-instant", true);
      return;
    }

    state.rescueTimeline?.kill?.();
    gsap.killTweensOf(canvas);
    const visual = readVisualState();
    const needsEntry = visual.canvasTop > visual.viewportHeight * 0.36;
    const entryDuration = needsEntry ? 0.48 : 0.08;
    revealExperience(false);

    state.rescueTimeline = gsap.timeline({
      defaults: { overwrite: true },
      onComplete: () => {
        state.rescueTimeline = null;
        engine?.start?.();
        alignExperience();
        window.ScrollTrigger?.refresh?.();
        emit("after", "recovery-complete");
      },
    });
    state.rescueTimeline
      .set(canvas, { position: "fixed", opacity: 1 })
      .to(canvas, {
        y: "0svh",
        duration: entryDuration,
        ease: "power3.out",
      })
      .to(canvas, {
        y: "-100%",
        duration: 0.72,
        ease: "power3.inOut",
      }, `+=${needsEntry ? 0.08 : 0}`);
  };

  const startForwardWatchdog = () => {
    clearForwardWatchdog();
    state.forwardWatchdog = window.setTimeout(() => {
      if (state.phase !== "forward") return;
      const visual = readVisualState();
      if (visual.canvasTop > visual.viewportHeight * 0.72) {
        rescueForward("canvas-entry-stall");
        return;
      }

      state.forwardWatchdog = window.setTimeout(() => {
        if (state.phase !== "forward") return;
        const latest = readVisualState();
        if (
          latest.canvasTop > -latest.viewportHeight * 0.55 ||
          latest.headingOpacity <= 0.08
        ) {
          rescueForward("sequence-settle-stall");
        }
      }, 3500);
    }, 700);
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
        if (direction === "forward") rescueForward("monitor-timeout");
        else settleBeforeInstant("reverse-timeout");
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
      startForwardWatchdog();
      return true;
    } catch (error) {
      root.dataset.pgPageTurnError = error instanceof Error ? error.message : String(error);
      console.warn("[portfolio] legacy page turn failed; using visual recovery", error);
      emit("forward-error", "exception");
      requestAnimationFrame(() => rescueForward("legacy-error"));
      return true;
    }
  };

  const invokeReverse = (callback, context, args = []) => {
    const now = performance.now();
    if (now - state.lastReverseAt < 180) return false;
    state.lastReverseAt = now;
    emit("reverse", "request");
    try {
      clearForwardWatchdog();
      callback?.apply(context, args);
      monitor("reverse");
      return true;
    } catch (error) {
      root.dataset.pgPageTurnError = error instanceof Error ? error.message : String(error);
      console.warn("[portfolio] legacy reverse page turn failed; restoring Profile", error);
      emit("reverse-error", "exception");
      requestAnimationFrame(() => settleBeforeInstant("reverse-error"));
      return true;
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

  let lastObservedScrollY = window.scrollY;
  let boundaryFrame = 0;
  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;
    const movingDown = currentScrollY > lastObservedScrollY + 0.5;
    lastObservedScrollY = currentScrollY;
    if (!movingDown || boundaryFrame) return;
    if (
      root.dataset.pgNavJumpLock === "true" ||
      root.dataset.pgContactJumpLock === "true"
    ) {
      return;
    }
    if (state.phase !== "before" && state.phase !== "ready") return;

    boundaryFrame = requestAnimationFrame(() => {
      boundaryFrame = 0;
      if (state.phase !== "before" && state.phase !== "ready") return;
      const trigger = document.querySelector("[home-trigger]");
      if (!trigger || typeof state.forward !== "function") return;
      const rect = trigger.getBoundingClientRect();
      if (rect.top < 0 && rect.bottom <= window.innerHeight + 2) {
        state.forward();
      }
    });
  }, { passive: true });

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
      settleAfterInstant("fallback");
    },
    settleBefore() {
      settleBeforeInstant("fallback");
    },
  };
})();
