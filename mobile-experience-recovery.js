(() => {
  "use strict";

  if (window.__portfolioMobileExperienceRecoveryReady) return;
  window.__portfolioMobileExperienceRecoveryReady = true;

  const MOBILE_QUERY = "(max-width: 780px)";
  const root = document.documentElement;
  root.dataset.pgMobileExperienceRecoveryReady = "true";
  let lastScrollY = window.scrollY;
  let lastDirection = 0;
  let touchStartY = null;
  let checkFrame = 0;
  let recoveryTimer = 0;
  let recoveryRunning = false;
  let recoveryAttempt = 0;
  let foregroundStallSince = 0;
  let pageTurnRetryTimer = 0;

  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;
  const isLocked = () =>
    root.dataset.pgContactJumpLock === "true" ||
    root.dataset.pgNavJumpLock === "true";

  const getElements = () => ({
    triggerNode: document.querySelector("[home-trigger]"),
    canvas: document.querySelector("#canvasPin"),
    timeline: document.querySelector(".timeline_wrapper"),
    heading: document.querySelector(".timeline_heading"),
    columns: Array.from(document.querySelectorAll(".timeline_colum_left")),
  });

  const opacityOf = (element) => {
    if (!element) return 1;
    const value = Number.parseFloat(getComputedStyle(element).opacity);
    return Number.isFinite(value) ? value : 1;
  };

  const isTransitionDeadZone = () => {
    if (!isMobile() || isLocked()) return false;

    const { triggerNode, canvas, timeline, heading } = getElements();
    if (!triggerNode || !canvas || !timeline || !heading) return false;

    const viewportHeight = Math.max(1, window.innerHeight);
    const triggerRect = triggerNode.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const timelineRect = timeline.getBoundingClientRect();
    const timelineHidden = opacityOf(heading) <= 0.04;
    const canvasWaitingBelow = canvasRect.top >= viewportHeight * 0.58;
    const crossedPageTurn =
      triggerRect.top <= Math.max(8, viewportHeight * 0.018) &&
      triggerRect.bottom > -viewportHeight * 0.72;
    const timelineIsNext =
      timelineRect.top > -viewportHeight * 0.5 &&
      timelineRect.top < viewportHeight * 1.35;

    return (
      timelineHidden &&
      canvasWaitingBelow &&
      crossedPageTurn &&
      timelineIsNext
    );
  };

  const isTransitionForegroundStall = () => {
    if (!isMobile() || isLocked()) return false;

    const { triggerNode, canvas, timeline, heading, columns } = getElements();
    if (!triggerNode || !canvas || !timeline || !heading) return false;

    const viewportHeight = Math.max(1, window.innerHeight);
    const triggerRect = triggerNode.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const timelineRect = timeline.getBoundingClientRect();
    const visibleColumns = columns.filter(
      (column) => getComputedStyle(column).display !== "none",
    );
    const timelineStillHidden =
      opacityOf(heading) <= 0.04 &&
      visibleColumns.every((column) => opacityOf(column) <= 0.04);
    const canvasCoveringViewport =
      canvasRect.top > -viewportHeight * 0.12 &&
      canvasRect.top < viewportHeight * 0.12;
    const pageTurnHasCrossed =
      triggerRect.bottom <= viewportHeight * 0.12 &&
      timelineRect.top > -viewportHeight * 0.45 &&
      timelineRect.top < viewportHeight * 0.42;

    return timelineStillHidden && canvasCoveringViewport && pageTurnHasCrossed;
  };

  const getCanvasTrigger = () =>
    window.ScrollTrigger?.getById?.("canvasScroll") || null;

  const callNativePageTurn = (trigger) => {
    if (typeof trigger?.vars?.onLeave !== "function") return false;
    trigger.vars.onLeave(trigger);
    return true;
  };

  const retryNativePageTurn = (
    trigger,
    { resetTransition = false, keepCanvasPosition = false } = {},
  ) => {
    const canvas = document.querySelector("#canvasPin");
    if (!canvas || !window.gsap) return false;

    if (
      resetTransition &&
      typeof trigger?.vars?.onEnterBack === "function"
    ) {
      trigger.vars.onEnterBack(trigger);
    }

    if (!keepCanvasPosition) {
      window.gsap.killTweensOf(canvas);
      window.gsap.set(canvas, {
        y: "99.26svh",
        opacity: 1,
        position: "fixed",
      });
    }

    window.clearTimeout(pageTurnRetryTimer);
    let retryCount = 0;
    const attempt = () => {
      if (lastDirection < 0 || isLocked()) {
        recoveryRunning = false;
        return;
      }

      const liveTrigger = getCanvasTrigger() || trigger;
      callNativePageTurn(liveTrigger);
      retryCount += 1;

      pageTurnRetryTimer = window.setTimeout(() => {
        if (window.gsap?.isTweening?.(canvas)) {
          recoveryRunning = false;
          root.dataset.pgMobileExperienceState = "transitioning";
          return;
        }

        if (retryCount < 24) {
          root.dataset.pgMobileExperienceState = "waiting-for-reverse";
          pageTurnRetryTimer = window.setTimeout(attempt, 140);
          return;
        }

        recoveryRunning = false;
        root.dataset.pgMobileExperienceState = "waiting-for-trigger";
        window.ScrollTrigger?.refresh?.();
      }, 72);
    };

    requestAnimationFrame(attempt);
    return true;
  };

  const recover = () => {
    recoveryTimer = 0;
    if (recoveryRunning || !isTransitionDeadZone()) return;

    const trigger = getCanvasTrigger();
    if (!trigger) {
      window.ScrollTrigger?.refresh?.();
      root.dataset.pgMobileExperienceState = "waiting-for-trigger";
      scheduleRecovery(180);
      return;
    }

    recoveryRunning = true;
    recoveryAttempt += 1;
    root.dataset.pgMobileExperienceState = "recovering";
    root.dataset.pgMobileExperienceAttempt = String(recoveryAttempt);
    callNativePageTurn(trigger);

    window.setTimeout(() => {
      const canvas = document.querySelector("#canvasPin");
      const nativeTweenIsRunning =
        Boolean(canvas && window.gsap?.isTweening?.(canvas));
      if (isTransitionDeadZone() && !nativeTweenIsRunning) {
        root.dataset.pgMobileExperienceState = "restarted";
        retryNativePageTurn(trigger, { resetTransition: true });
      } else {
        root.dataset.pgMobileExperienceState = "transitioning";
        window.setTimeout(() => {
          recoveryRunning = false;
          if (isTransitionDeadZone() && lastDirection >= 0) {
            scheduleRecovery(180);
          } else if (!isTransitionDeadZone()) {
            root.dataset.pgMobileExperienceState = "ready";
          }
        }, 1450);
      }
    }, 220);
  };

  const recoverForegroundStall = () => {
    if (recoveryRunning || !isTransitionForegroundStall()) return;

    const trigger = getCanvasTrigger();
    if (!trigger) {
      window.ScrollTrigger?.refresh?.();
      root.dataset.pgMobileExperienceState = "waiting-for-trigger";
      return;
    }

    recoveryRunning = true;
    recoveryAttempt += 1;
    foregroundStallSince = 0;
    root.dataset.pgMobileExperienceState = "stall-restarted";
    root.dataset.pgMobileExperienceAttempt = String(recoveryAttempt);
    retryNativePageTurn(trigger, { keepCanvasPosition: true });
  };

  function scheduleRecovery(delay = 96) {
    window.clearTimeout(recoveryTimer);
    recoveryTimer = window.setTimeout(recover, delay);
  }

  const check = () => {
    checkFrame = 0;
    const currentY = window.scrollY;
    if (currentY > lastScrollY + 0.5) lastDirection = 1;
    else if (currentY < lastScrollY - 0.5) lastDirection = -1;
    lastScrollY = currentY;

    if (!isMobile()) return;
    if (lastDirection < 0) {
      window.clearTimeout(recoveryTimer);
      window.clearTimeout(pageTurnRetryTimer);
      recoveryTimer = 0;
      pageTurnRetryTimer = 0;
      recoveryRunning = false;
      foregroundStallSince = 0;
      return;
    }

    if (isTransitionDeadZone()) scheduleRecovery();

    if (isTransitionForegroundStall()) {
      const canvas = document.querySelector("#canvasPin");
      if (canvas && window.gsap?.isTweening?.(canvas)) {
        foregroundStallSince = 0;
      } else if (!foregroundStallSince) {
        foregroundStallSince = performance.now();
      } else if (performance.now() - foregroundStallSince >= 1800) {
        recoverForegroundStall();
      }
    } else {
      foregroundStallSince = 0;
      if (
        root.dataset.pgMobileExperienceState &&
        opacityOf(document.querySelector(".timeline_heading")) > 0.08
      ) {
        root.dataset.pgMobileExperienceState = "ready";
      }
    }
  };

  const requestCheck = () => {
    if (checkFrame) return;
    checkFrame = requestAnimationFrame(check);
  };

  window.addEventListener("scroll", requestCheck, { passive: true });
  window.addEventListener(
    "wheel",
    (event) => {
      if (event.deltaY > 0) lastDirection = 1;
      else if (event.deltaY < 0) lastDirection = -1;
      requestCheck();
    },
    { passive: true },
  );
  window.addEventListener(
    "touchstart",
    (event) => {
      touchStartY = event.touches?.[0]?.clientY ?? null;
    },
    { passive: true },
  );
  window.addEventListener(
    "touchend",
    (event) => {
      const endY = event.changedTouches?.[0]?.clientY ?? null;
      if (touchStartY != null && endY != null) {
        if (touchStartY - endY > 8) lastDirection = 1;
        else if (endY - touchStartY > 8) lastDirection = -1;
      }
      touchStartY = null;
      requestCheck();
    },
    { passive: true },
  );

  ["resize", "orientationchange", "site:revealed", "portfolio:host-runtime-ready"]
    .forEach((type) => window.addEventListener(type, requestCheck, { passive: true }));

  window.setTimeout(requestCheck, 360);
  window.setTimeout(requestCheck, 1100);
  window.setInterval(requestCheck, 280);
})();
