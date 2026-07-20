(() => {
  const loader = document.getElementById("siteLoader");
  const percent = document.getElementById("siteLoaderPercent");
  const progress = loader?.querySelector(".site-loader__progress");
  const ghostValues = loader?.querySelectorAll(".site-loader__ghost-value") || [];
  const label = loader?.querySelector(".site-loader__status-label");
  if (!loader) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const minimumVisibleMs = reduceMotion ? 700 : 2200;
  // The legacy host runtime is optional for the portfolio shell. Never let it
  // hold the first view hostage when a network-bound Webflow animation fails.
  const maximumWaitAfterDomMs = 7200;
  const absoluteWatchdogMs = 14000;
  const revealDurationMs = reduceMotion ? 320 : 920;
  const completionHoldMs = reduceMotion ? 80 : 420;
  const startedAt = performance.now();
  const tasks = new Map([
    ["dom", 0],
    ["fonts", 0],
    ["hero", 0],
    ["runtime", 0],
    ["host", 0],
    ["visual", 0],
    ["app", 0],
  ]);

  const taskLabels = new Map([
    ["dom", "Building structure"],
    ["fonts", "Loading typography"],
    ["hero", "Rendering hero"],
    ["runtime", "Preparing motion"],
    ["host", "Synchronizing page transitions"],
    ["visual", "Shaping flow field"],
    ["app", "Finalizing layout"],
  ]);

  let shown = 0;
  let raf = 0;
  let finished = false;
  let forcedRelease = false;

  const setTask = (name) => {
    if (!tasks.has(name) || tasks.get(name) === 1) return;
    tasks.set(name, 1);
    loader.dataset.lastReadyTask = name;
  };

  const allTasksReady = () => Array.from(tasks.values()).every(Boolean);
  const rawTarget = () => {
    const ready = Array.from(tasks.values()).reduce((sum, value) => sum + value, 0);
    return (ready / tasks.size) * 100;
  };

  const target = () => {
    const elapsed = performance.now() - startedAt;
    if (allTasksReady() && elapsed < minimumVisibleMs) return 96;
    return Math.min(100, rawTarget());
  };

  const updateLabel = () => {
    if (!label) return;
    const pending = Array.from(tasks.keys()).find((name) => !tasks.get(name));
    label.textContent = pending ? taskLabels.get(pending) : "Experience ready";
  };

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  const prepareSiteForReveal = async () => {
    document.body.classList.add("site-prepared");
    window.dispatchEvent(new CustomEvent("site:before-reveal", {
      detail: { forced: forcedRelease },
    }));

    await nextFrame();
    await nextFrame();
    window.ScrollTrigger?.refresh?.();
    window.dispatchEvent(new CustomEvent("site:prepared"));
    await nextFrame();
  };

  const waitForLoaderFade = () => new Promise((resolve) => {
    let settled = false;
    const done = (event) => {
      if (settled || (event && (event.target !== loader || event.propertyName !== "opacity"))) return;
      settled = true;
      loader.removeEventListener("transitionend", done);
      resolve();
    };
    loader.addEventListener("transitionend", done);
    window.setTimeout(done, revealDurationMs + 180);
  });

  const warmNextViewport = () => {
    const warm = () => {
      const assets = Array.from(document.querySelectorAll(
        ".timeline_wrapper img, .pg-project img"
      )).slice(0, 8);
      assets.forEach((asset) => {
        asset.loading = "eager";
        asset.decode?.().catch?.(() => {});
      });
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(warm, { timeout: 1200 });
    } else {
      window.setTimeout(warm, 350);
    }
  };

  const finish = async () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    loader.dataset.release = forcedRelease ? "timeout" : "ready";
    document.documentElement.dataset.siteLoaderRelease = loader.dataset.release;
    document.documentElement.dataset.siteLoaderFallbackTasks = loader.dataset.fallbackTasks || "";
    document.documentElement.dataset.siteLoaderRuntime = loader.dataset.runtimeStatus || "ready";
    document.documentElement.dataset.siteLoaderPageTurn = loader.dataset.pageTurnStatus || "ready";
    loader.classList.add("is-complete");

    await new Promise((resolve) => window.setTimeout(resolve, completionHoldMs));
    await prepareSiteForReveal();

    document.body.classList.remove("site-loading", "site-prepared");
    document.documentElement.classList.add("site-loaded", "site-revealing");
    loader.classList.add("is-leaving");
    loader.setAttribute("aria-hidden", "true");
    window.dispatchEvent(new CustomEvent("site:reveal-start"));

    await waitForLoaderFade();
    loader.remove();
    document.documentElement.classList.remove("site-revealing");
    document.documentElement.classList.add("site-revealed");
    window.dispatchEvent(new CustomEvent("site:revealed"));

    await nextFrame();
    await nextFrame();
    window.dispatchEvent(new CustomEvent("site:ready"));
    warmNextViewport();
  };

  const paint = () => {
    updateLabel();
    const goal = target();
    shown += (goal - shown) * (goal === 100 ? 0.13 : 0.07);
    if (goal === 100 && 100 - shown < 0.12) shown = 100;
    const value = Math.min(100, Math.floor(shown));
    const formattedValue = String(value).padStart(3, "0");
    if (percent) percent.textContent = formattedValue;
    ghostValues.forEach((node) => {
      node.textContent = formattedValue;
    });
    if (progress) progress.setAttribute("aria-valuenow", String(value));
    loader.dataset.progress = shown.toFixed(2);
    loader.style.setProperty("--loader-progress", shown.toFixed(2));
    const normalizedProgress = shown / 100;
    const sweepProgress = normalizedProgress < 0.96
      ? Math.pow(normalizedProgress / 0.96, 1.35) * 0.72
      : 0.72 + Math.pow((normalizedProgress - 0.96) / 0.04, 2) *
        (3 - 2 * ((normalizedProgress - 0.96) / 0.04)) * 0.28;
    loader.style.setProperty("--loader-sweep", (sweepProgress * 100).toFixed(2));
    if (shown >= 100) return finish();
    raf = requestAnimationFrame(paint);
  };

  const waitForCondition = (test, timeoutMs) => new Promise((resolve) => {
    const deadline = performance.now() + timeoutMs;
    const check = () => {
      if (test()) return resolve(true);
      if (performance.now() >= deadline) return resolve(false);
      window.setTimeout(check, 50);
    };
    check();
  });

  const waitForVideo = (video) => new Promise((resolve) => {
    if (!video || video.readyState >= 2) return resolve();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    video.addEventListener("loadeddata", done, { once: true });
    video.addEventListener("canplay", done, { once: true });
    video.addEventListener("error", done, { once: true });
    window.setTimeout(done, 6500);
  });

  const waitForFonts = async () => {
    if (!document.fonts) return setTask("fonts");
    const criticalFonts = [
      { font: '400 16px "TWK Everett"', sample: "SINPOL DESIGN" },
      { font: '700 16px "TWK Everett"', sample: "PORTFOLIO" },
      { font: '400 16px "TWK Everett Mono"', sample: "INDUSTRIAL PRODUCT DESIGN" },
      { font: '400 16px "Noto Sans SC"', sample: "从概念草图到产品落地" },
      { font: '800 16px "Noto Sans SC"', sample: "产品设计师吴海涵" },
    ];
    try {
      await Promise.all(
        criticalFonts.map(({ font, sample }) => document.fonts.load(font, sample)),
      );
    } catch (error) {
      loader.dataset.fontStatus = "fallback";
    }
    setTask("fonts");
  };

  const waitForHero = async () => {
    const introVideo = document.querySelector(".portfolio-graft .pg-intro-cover");
    const canvas = document.querySelector(".portfolio-graft #pgVideoSource");
    const canvasReady = waitForCondition(
      () => canvas?.dataset.pgFrameReady === "true",
      6500,
    );
    const results = await Promise.all([waitForVideo(introVideo), canvasReady]);
    loader.dataset.heroStatus = results[1] === false ? "fallback" : "ready";
    setTask("hero");
  };

  const waitForRuntime = async () => {
    const ready = await waitForCondition(
      () => Boolean(window.gsap && window.ScrollTrigger),
      7000,
    );
    loader.dataset.runtimeStatus = ready ? "ready" : "fallback";
    setTask("runtime");
  };

  const waitForVisual = async () => {
    const ready = await waitForCondition(
      () => Boolean(
        window.__siteLoaderVisualReady ||
        document.getElementById("siteLoaderVisual")?.dataset.visualReady === "true"
      ),
      5000,
    );
    loader.dataset.visualStatus = ready ? "ready" : "fallback";
    setTask("visual");
  };

  const markAppReady = () => setTask("app");
  let hostReadinessStarted = false;
  const markHostReady = async (event) => {
    if (hostReadinessStarted) return;
    hostReadinessStarted = true;
    const status = event?.detail?.status || "ready";
    loader.dataset.hostStatus = status;

    if (status === "ready") {
      const transitionsReady = await waitForCondition(() => {
        const seq = document.querySelector(".seqtrigger");
        const triggers = window.ScrollTrigger?.getAll?.() || [];
        return triggers.some((trigger) => {
          const targetNode = trigger.trigger;
          return targetNode === seq || targetNode?.closest?.(".seqtrigger");
        });
      }, 3000);
      loader.dataset.pageTurnStatus = transitionsReady ? "ready" : "fallback";
    } else {
      loader.dataset.pageTurnStatus = "fallback";
    }

    window.ScrollTrigger?.refresh?.();
    requestAnimationFrame(() => requestAnimationFrame(() => setTask("host")));

  };

  window.SiteLoader = {
    markAppReady,
    markHostReady,
    getStatus() {
      return Object.fromEntries(tasks);
    },
  };

  window.addEventListener("portfolio:ready", markAppReady, { once: true });
  window.addEventListener("portfolio:host-runtime-ready", markHostReady, { once: true });

  const onReady = () => {
    setTask("dom");
    waitForFonts();
    waitForHero();
    waitForRuntime();
    waitForVisual();

    const root = document.querySelector(".portfolio-graft");
    if (root?.dataset.pgReady === "true") markAppReady();
    if (window.__portfolioHostRuntimeReady) {
      markHostReady({ detail: { status: "ready" } });
    }

    window.setTimeout(() => {
      if (allTasksReady()) return;
      forcedRelease = true;
      loader.dataset.fallbackTasks = Array.from(tasks.keys())
        .filter((key) => !tasks.get(key))
        .join(",");
      tasks.forEach((_, key) => setTask(key));
    }, maximumWaitAfterDomMs);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady, { once: true });
  } else {
    onReady();
  }

  window.setTimeout(() => {
    if (allTasksReady()) return;
    forcedRelease = !allTasksReady();
    loader.dataset.fallbackTasks = Array.from(tasks.keys())
      .filter((key) => !tasks.get(key))
      .join(",");
    tasks.forEach((_, key) => setTask(key));
  }, absoluteWatchdogMs);

  requestAnimationFrame(paint);

})();
