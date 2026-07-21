(function () {
  const root = document.querySelector(".portfolio-graft");
  if (!root) return;

  const canvas = root.querySelector("#pgVideoSource");
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  const heroVideo = root.querySelector("#pgHeroVideo");
  let time = 0;
  let heroFrameActive = true;
  let heroFrameInView = true;
  let heroFrameRunning = false;
  let siteExperienceActive = !document.body.classList.contains("site-loading");

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const mapRange = (value, inMin, inMax, outMin = 0, outMax = 1) => {
    const progress = clamp((value - inMin) / Math.max(0.0001, inMax - inMin));
    return outMin + (outMax - outMin) * progress;
  };
  const smoothStep = (value) => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };
  const smootherStep = (value) => {
    const t = clamp(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };

  function setVar(name, value) {
    root.style.setProperty(name, value);
  }

  function scrambleToDigits(label, progress) {
    const digits = "0123456789";
    const amount = mapRange(progress, 0.12, 0.58);
    const seed = Math.floor(progress * 1000);

    return [...label].map((char, index) => {
      if (char === " ") return " ";
      const threshold = (index + 1) / label.replaceAll(" ", "").length;
      if (amount < threshold * 0.86) return char;
      return digits[(seed + index * 7) % digits.length];
    }).join("");
  }

  function renderHeroFrame() {
    if (!canvas || !ctx) return;

    time += 0.006;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, "#020304");
    base.addColorStop(0.56, "#010203");
    base.addColorStop(1, "#010203");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const horizonX = width * 0.5;
    const horizonY = height * 0.86;
    const glow = ctx.createRadialGradient(horizonX, horizonY, 0, horizonX, horizonY, width * 0.7);
    glow.addColorStop(0, "rgba(194, 226, 255, 0.12)");
    glow.addColorStop(0.16, "rgba(78, 134, 202, 0.10)");
    glow.addColorStop(0.58, "rgba(2, 8, 18, 0.04)");
    glow.addColorStop(1, "rgba(1, 2, 3, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width * 0.5, height * 0.94);
    ctx.scale(1, 0.28);
    ctx.strokeStyle = `rgba(238, 248, 255, ${0.72 + Math.sin(time * 1.6) * 0.018})`;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = "rgba(134, 200, 255, 0.76)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, width * 0.72, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    ctx.restore();

    const flareY = height * 0.73;
    const flareHeight = height * 0.26;
    const beam = ctx.createLinearGradient(width * 0.5, flareY - flareHeight, width * 0.5, flareY + flareHeight);
    beam.addColorStop(0, "rgba(134, 200, 255, 0)");
    beam.addColorStop(0.48, "rgba(218, 242, 255, 0.42)");
    beam.addColorStop(0.52, "rgba(255, 255, 255, 0.84)");
    beam.addColorStop(1, "rgba(134, 200, 255, 0)");
    ctx.fillStyle = beam;
    ctx.fillRect(width * 0.5 - 0.75, flareY - flareHeight, 1.5, flareHeight * 2);

    for (let i = 0; i < 38; i += 1) {
      const x = (i * 149 + Math.sin(time * 0.8 + i) * 6) % width;
      const y = (i * 83) % height;
      ctx.fillStyle = `rgba(205, 231, 255, ${0.014 + (i % 3) * 0.006})`;
      ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, 1);
    }

    if (canvas.dataset.pgFrameReady !== "true") {
      canvas.dataset.pgFrameReady = "true";
      window.dispatchEvent(new CustomEvent("portfolio:hero-frame-ready"));
    }
  }

  function drawHeroFrame() {
    if (!canvas || heroFrameRunning) return;
    heroFrameRunning = true;

    const tick = () => {
      if (!siteExperienceActive || !heroFrameActive || document.hidden) {
        heroFrameRunning = false;
        return;
      }

      renderHeroFrame();
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  function setupHeroFrameVisibility() {
    if (!canvas || !ctx) return;
    renderHeroFrame();

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        heroFrameInView = entries.some((entry) => entry.isIntersecting);
        heroFrameActive = heroFrameInView;
        if (siteExperienceActive && heroFrameActive) {
          drawHeroFrame();
          heroVideo?.play?.().catch(() => {});
        } else {
          heroVideo?.pause?.();
        }
      }, { rootMargin: "40% 0px 40% 0px", threshold: 0 });
      observer.observe(root);
    }

    document.addEventListener("visibilitychange", () => {
      heroFrameActive = !document.hidden && heroFrameInView;
      if (heroFrameActive && siteExperienceActive) {
        drawHeroFrame();
        heroVideo?.play?.().catch(() => {});
      } else {
        heroVideo?.pause?.();
      }
    });
  }

  function startGeneratedVideo() {
    if (!canvas || !canvas.captureStream || !heroVideo) return;
    if (heroVideo.srcObject) {
      heroVideo.play().catch(() => {});
      return;
    }
    heroVideo.srcObject = canvas.captureStream(30);
    heroVideo.play().catch(() => {});
  }

  let playHeroTextStagger = () => {};
  let resetHeroTextStagger = () => {};
  function setupHeroTextStagger() {
    const content = root.querySelector(".pg-hero-content");
    if (!content || content.dataset.pgTextStaggerReady === "true") return;
    content.dataset.pgTextStaggerReady = "true";

    const titleLines = Array.from(content.querySelectorAll(".pg-title > span"));
    const kicker = content.querySelector(".pg-kicker");
    const rule = content.querySelector(".pg-blue-rule");
    const copy = content.querySelector(".pg-copy");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (reduceMotion || !window.gsap || !titleLines.length) {
      content.classList.add("pg-hero-text-stagger-complete");
      playHeroTextStagger = () => {};
      resetHeroTextStagger = () => {};
      return;
    }

    const gsap = window.gsap;
    const authoredCopyLines = copy
      ? Array.from(copy.children).filter((line) => line.classList.contains("pg-copy-line"))
      : [];
    let copyLines = authoredCopyLines.length ? authoredCopyLines : (copy ? [copy] : []);
    if (copy && !authoredCopyLines.length && window.SplitText) {
      try {
        const splitCopy = new window.SplitText(copy, {
          type: "lines",
          linesClass: "pg-copy-line"
        });
        if (splitCopy.lines?.length) copyLines = splitCopy.lines;
      } catch (error) {}
    }

    const animatedTargets = [...titleLines, kicker, rule, ...copyLines].filter(Boolean);
    const setInitialState = () => {
      gsap.set(titleLines, { autoAlpha: 0, yPercent: 34, filter: "blur(7px)" });
      if (kicker) gsap.set(kicker, { autoAlpha: 0, y: 12 });
      if (rule) gsap.set(rule, { autoAlpha: 0, scaleX: 0, transformOrigin: "left center" });
      if (copyLines.length) gsap.set(copyLines, { autoAlpha: 0, y: 10 });
    };

    setInitialState();
    content.dataset.pgTextStaggerState = "armed";

    let started = false;
    let timeline = null;
    playHeroTextStagger = () => {
      if (started) return;
      started = true;
      content.classList.remove("pg-hero-text-stagger-complete");
      content.dataset.pgTextStaggerState = "playing";
      content.dataset.pgTextStaggerRuns = String((Number(content.dataset.pgTextStaggerRuns) || 0) + 1);

      timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          content.classList.add("pg-hero-text-stagger-complete");
          content.dataset.pgTextStaggerState = "complete";
          timeline = null;
        }
      });

      timeline.to(titleLines, {
        autoAlpha: 1,
        yPercent: 0,
        filter: "blur(0px)",
        duration: 1.05,
        stagger: 0.26
      }, 0);

      if (kicker) {
        timeline.to(kicker, { autoAlpha: 1, y: 0, duration: 0.72 }, 0.68);
      }
      if (rule) {
        timeline.to(rule, { autoAlpha: 1, scaleX: 1, duration: 0.78 }, 0.84);
      }
      if (copyLines.length) {
        timeline.to(copyLines, {
          autoAlpha: 1,
          y: 0,
          duration: 0.76,
          stagger: 0.2
        }, 1.04);
      }
    };

    resetHeroTextStagger = () => {
      if (!started && content.dataset.pgTextStaggerState === "armed") return;
      timeline?.kill();
      timeline = null;
      gsap.killTweensOf(animatedTargets);
      started = false;
      content.classList.remove("pg-hero-text-stagger-complete");
      content.dataset.pgTextStaggerState = "armed";
      setInitialState();
    };
  }

  function setupIntroScroll() {
    const intro = root.querySelector(".pg-intro-sequence");
    const stage = root.querySelector(".pg-intro-stage");
    const introVideo = root.querySelector(".pg-intro-cover");
    const loopFade = root.querySelector(".pg-intro-loop-fade");
    const transitionVideo = root.querySelector(".pg-intro-transition");
    const brandCode = root.querySelector(".pg-brand-code");
    const pixelCode = root.querySelector(".pg-pixel-code");

    if (!intro || !stage) return;

    if (!siteExperienceActive) {
      introVideo?.pause?.();
      transitionVideo?.pause?.();
    }

    const updateIntro = () => {
      const rect = intro.getBoundingClientRect();
      const scrollable = Math.max(1, intro.offsetHeight - window.innerHeight);
      const progress = clamp(-rect.top / scrollable);
      const introInRange = rect.bottom > 0 && rect.top < window.innerHeight;
      const gifIn = smootherStep(mapRange(progress, 0.2, 0.42));
      const gifHold = 1 - smootherStep(mapRange(progress, 0.82, 0.98));
      const gifOpacity = Math.min(gifIn, gifHold) * 0.9;
      const copyOpacity = 1 - smootherStep(mapRange(progress, 0.7, 0.99));
      const stageOpacity = 1 - smootherStep(mapRange(progress, 0.78, 1));
      const metaOpacity = 1 - smootherStep(mapRange(progress, 0.7, 0.99));
      const labelOpacity = gifOpacity * 0.76 * smoothStep(mapRange(progress, 0.38, 0.5));
      const heroReveal = smootherStep(mapRange(progress, 0.5, 0.96));
      const heroTopMask = smootherStep(mapRange(progress, 0.72, 1));
      const heroFeather = (1 - heroTopMask) * 32;

      if (transitionVideo && !transitionVideo.src && transitionVideo.dataset.src && progress > 0.14) {
        transitionVideo.src = transitionVideo.dataset.src;
        transitionVideo.load();
        transitionVideo.play().catch(() => {});
      }

      [brandCode, pixelCode].forEach((node) => {
        if (!node) return;
        const label = node.dataset.label || "Sinpol Design";
        node.textContent = progress > 0.58
          ? scrambleToDigits("000000 000000", progress)
          : scrambleToDigits(label, progress);
      });

      setVar("--pg-intro-video-scale", (1 + progress * 0.14).toFixed(3));
      setVar("--pg-intro-video-opacity", (0.88 - smootherStep(progress) * 0.46).toFixed(3));
      setVar("--pg-intro-gif-opacity", gifOpacity.toFixed(3));
      setVar("--pg-intro-gif-scale", (1.035 + progress * 0.035).toFixed(3));
      setVar("--pg-intro-grid-opacity", (0.18 + gifOpacity * 0.92).toFixed(3));
      setVar("--pg-intro-line-scale", (0.78 + progress * 0.16).toFixed(3));
      setVar("--pg-intro-node-scale", (0.9 + progress * 0.08).toFixed(3));
      setVar("--pg-intro-frame-scale", (1 - progress * 0.018).toFixed(3));
      setVar("--pg-intro-copy-opacity", copyOpacity.toFixed(3));
      setVar("--pg-intro-meta-opacity", metaOpacity.toFixed(3));
      setVar("--pg-intro-pixel-opacity", metaOpacity.toFixed(3));
      setVar("--pg-intro-label-opacity", labelOpacity.toFixed(3));
      setVar("--pg-intro-black", (0.2 + smootherStep(progress) * 0.58).toFixed(3));
      setVar("--pg-intro-stage-opacity", Math.max(0, stageOpacity).toFixed(3));
      setVar("--pg-intro-stage-events", stageOpacity > 0.06 ? "auto" : "none");
      stage.style.visibility = stageOpacity > 0.02 ? "visible" : "hidden";
      setVar("--pg-hero-reveal-opacity", heroReveal.toFixed(3));
      setVar("--pg-hero-reveal-y", `${((1 - heroReveal) * 18).toFixed(1)}px`);
      setVar("--pg-hero-mask-top-alpha", heroTopMask.toFixed(3));
      setVar("--pg-hero-mask-feather", `${heroFeather.toFixed(2)}vh`);
      if (introInRange && heroReveal >= 0.18) playHeroTextStagger();
      else if (introInRange && heroReveal <= 0.04) resetHeroTextStagger();
    };

    if (siteExperienceActive) introVideo && introVideo.play().catch(() => {});
    if (siteExperienceActive && transitionVideo && transitionVideo.src) {
      transitionVideo.play().catch(() => {});
    }

    let introActive = true;
    let loopFadeRunning = false;
    const updateLoopFade = () => {
      if (!siteExperienceActive || !introActive || document.hidden) {
        loopFadeRunning = false;
        return;
      }
      if (!introVideo || !loopFade || !Number.isFinite(introVideo.duration) || introVideo.duration <= 0) {
        setVar("--pg-intro-loop-fade-opacity", "0");
        requestAnimationFrame(updateLoopFade);
        return;
      }

      const current = introVideo.currentTime;
      const duration = introVideo.duration;
      const fadeIn = mapRange(current, 0, 0.72, 0.72, 0);
      const fadeOut = mapRange(current, Math.max(0, duration - 0.95), duration, 0, 0.82);
      const transitionOpacity = Number.parseFloat(getComputedStyle(root).getPropertyValue("--pg-intro-gif-opacity")) || 0;
      const coverPresence = Math.max(0, 1 - transitionOpacity * 1.2);
      setVar("--pg-intro-loop-fade-opacity", (Math.max(fadeIn, fadeOut) * coverPresence).toFixed(3));
      requestAnimationFrame(updateLoopFade);
    };

    const startLoopFade = () => {
      if (loopFadeRunning || !siteExperienceActive || !introActive || document.hidden) return;
      loopFadeRunning = true;
      requestAnimationFrame(updateLoopFade);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        introActive = entries.some((entry) => entry.isIntersecting);
        if (introActive && siteExperienceActive) {
          introVideo?.play?.().catch(() => {});
          if (transitionVideo?.src) transitionVideo.play().catch(() => {});
          startLoopFade();
          requestUpdate();
        } else if (!introActive) {
          introVideo?.pause?.();
          transitionVideo?.pause?.();
        }
      }, { rootMargin: "35% 0px 35% 0px", threshold: 0 });
      observer.observe(intro);
    }

    let ticking = false;
    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateIntro();
        ticking = false;
      });
    };

    updateIntro();
    startLoopFade();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("site:revealed", () => {
      introVideo?.play?.().catch(() => {});
      if (transitionVideo?.src) transitionVideo.play().catch(() => {});
      startLoopFade();
      requestUpdate();
    }, { once: true });
  }

  function setupPanelGlow() {
    root.querySelectorAll(".pg-panel").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = x - cx;
        const dy = y - cy;
        const kx = dx === 0 ? Infinity : cx / Math.abs(dx);
        const ky = dy === 0 ? Infinity : cy / Math.abs(dy);
        const edge = clamp(1 / Math.min(kx, ky), 0, 1);
        let degrees = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (degrees < 0) degrees += 360;

        card.style.setProperty("--pg-edge-proximity", `${(edge * 100).toFixed(3)}`);
        card.style.setProperty("--pg-cursor-angle", `${degrees.toFixed(3)}deg`);
      });

      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--pg-edge-proximity", "0");
      });
    });
  }

  function setupHandoffVisual() {
    const hero = root.querySelector(".pg-hero");
    if (!hero) return;

    let ticking = false;
    let heroTextResetBelowBridge = false;
    const update = () => {
      const bridge = document.querySelector("section.home-selection");
      if (!bridge) return;

      const bridgeRect = bridge.getBoundingClientRect();
      const canvasPin = document.querySelector("#canvasPin");
      const canvasRect = canvasPin && canvasPin.getBoundingClientRect ? canvasPin.getBoundingClientRect() : null;
      const vh = Math.max(1, window.innerHeight);
      const inBridge = bridgeRect.top < vh && bridgeRect.bottom > 0;
      const bridgeIn = smootherStep(mapRange(vh - bridgeRect.top, 0, vh * 0.46));
      const bridgeOut = 1 - smootherStep(mapRange(-bridgeRect.bottom, 0, vh * 0.22));
      const canvasTakeover = canvasRect ? clamp(canvasRect.top / Math.max(1, vh * 0.96)) : 1;
      const opacity = inBridge ? clamp(bridgeIn * bridgeOut * canvasTakeover) : 0;

      if (bridgeRect.bottom < -vh * 0.18) {
        if (!heroTextResetBelowBridge) {
          resetHeroTextStagger();
          heroTextResetBelowBridge = true;
        }
      } else if (opacity >= 0.18) {
        playHeroTextStagger();
        heroTextResetBelowBridge = false;
      }

      hero.style.setProperty("--pg-bridge-opacity", opacity.toFixed(3));
      hero.classList.toggle("pg-bridge-fixed", opacity > 0.01);
      root.classList.toggle("pg-bridge-active", opacity > 0.01);
      document.body.classList.toggle("pg-bridge-active", opacity > 0.01);
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.setTimeout(update, 800);
    window.setTimeout(update, 1600);
  }

  let hostRefreshQueued = false;
  let loadingRefreshCompleted = false;
  let webflowRefreshInitialized = false;
  function refreshHostScroll() {
    if (!siteExperienceActive && loadingRefreshCompleted) return;
    if (hostRefreshQueued) return;
    hostRefreshQueued = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      hostRefreshQueued = false;
      const contactJumpLocked = document.documentElement.dataset.pgContactJumpLock === "true";
      const sectionJumpLocked = document.documentElement.dataset.pgNavJumpLock === "true";
      if (window.ScrollTrigger && window.ScrollTrigger.refresh) {
        window.ScrollTrigger.refresh();
      }
      if (!siteExperienceActive) loadingRefreshCompleted = true;
      if (!contactJumpLocked && !sectionJumpLocked && !webflowRefreshInitialized && window.Webflow && window.Webflow.require) {
        try {
          window.Webflow.require("ix2")?.init?.();
          webflowRefreshInitialized = true;
        } catch (error) {}
      }
    }));
  }

  function setupHostRefreshGuards() {
    let refreshTimer = 0;
    const queueRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refreshHostScroll, 120);
    };

    window.addEventListener("resize", queueRefresh);
    window.addEventListener("orientationchange", queueRefresh);
    root.querySelectorAll("img, video").forEach((asset) => {
      asset.addEventListener("load", queueRefresh, { once: true });
      asset.addEventListener("loadedmetadata", queueRefresh, { once: true });
      asset.addEventListener("loadeddata", queueRefresh, { once: true });
    });
  }

  function setupStaticTimelineCardHeight() {
    const cards = Array.from(document.querySelectorAll(".timeline_static_card_anim"));
    if (!cards.length) return;

    const desktopScale = 2.1;
    const mobileScale = 1.65;

    const syncHeight = (card) => {
      const raw = card.style.height || "";
      const match = raw.match(/^([\d.]+)(em|px)$/);
      if (!match) {
        card.style.removeProperty("--pg-static-card-height");
        return;
      }

      const rawValue = Number.parseFloat(match[1]);
      if (!Number.isFinite(rawValue) || rawValue <= 0) return;

      const isMobile = Boolean(card.closest(".timeline_main.mobile"));
      const scale = isMobile ? mobileScale : desktopScale;
      const scaled = rawValue * scale;
      const nextHeight = `${scaled.toFixed(4)}${match[2]}`;

      if (card.style.getPropertyValue("--pg-static-card-height") !== nextHeight) {
        card.style.setProperty("--pg-static-card-height", nextHeight);
      }
    };

    cards.forEach((card) => {
      syncHeight(card);
      new MutationObserver(() => syncHeight(card)).observe(card, {
        attributes: true,
        attributeFilter: ["style"],
      });
    });

    const syncAll = () => {
      cards.forEach(syncHeight);
    };

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(syncAll);
      cards.forEach((card) => resizeObserver.observe(card));
    }

    window.addEventListener("resize", syncAll, { passive: true });
    requestAnimationFrame(syncAll);
  }

  function setupTimelineProfileTextReveal() {
    const cards = Array.from(document.querySelectorAll(".timeline_profile_text_anim"));
    if (!cards.length) return;
    let syncFrame = 0;

    const syncVisibility = (card) => {
      const rect = card.getBoundingClientRect();
      const isMobileTimeline = !!card.closest(".timeline_main.mobile");
      const viewportResponsiveThreshold = window.innerHeight * (isMobileTimeline ? 0.08 : 0.1);
      const threshold = Math.max(28, Math.min(isMobileTimeline ? 96 : 120, viewportResponsiveThreshold));
      card.classList.toggle("is-profile-copy-visible", rect.height >= threshold);
    };

    const syncAll = () => {
      syncFrame = 0;
      cards.forEach(syncVisibility);
    };

    const requestSync = () => {
      if (syncFrame) return;
      syncFrame = requestAnimationFrame(syncAll);
    };

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(syncAll);
      cards.forEach((card) => resizeObserver.observe(card));
    }

    window.addEventListener("resize", requestSync, { passive: true });
    requestAnimationFrame(syncAll);
    window.setTimeout(syncAll, 300);
    window.setTimeout(syncAll, 900);
  }

  function setupContactPage() {
    if (document.querySelector("#pg-contact-final")) return;

    const section = document.createElement("section");
    section.id = "pg-contact-final";
    section.className = "pg-contact-final";
    section.setAttribute("aria-label", "Contact");
    section.innerHTML = `
      <div class="pg-contact-final__inner">
        <div class="pg-contact-final__title">
          <p>Contact</p>
          <h2 aria-label="Let the next product become visible.">
            <span>Let the next</span>
            <span>product</span>
            <span>become</span>
            <span>visible.</span>
          </h2>
        </div>
        <div class="pg-contact-final__panel">
          <p>\u5434\u6d77\u6db5 / \u4ea7\u54c1\u8bbe\u8ba1\u5e08</p>
          <p>1127254122@qq.com</p>
          <span>\u73b0\u5c45\u5e7f\u4e1c\uff0c\u53ef\u6c9f\u901a\u4ea7\u54c1\u8bbe\u8ba1\u30013D \u89c6\u89c9\u3001\u5de5\u4e1a\u9020\u578b\u4e0e\u9879\u76ee\u5408\u4f5c\u3002</span>
        </div>
      </div>
    `;

    const anchor = document.currentScript;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(section, anchor);
    } else {
      document.body.appendChild(section);
    }

    const rebound = document.querySelector(".custom_scroll");
    if (rebound) {
      section.insertAdjacentElement("afterend", rebound);
    }
  }

  function setupPrimaryNavFeedback() {
    const nav = document.querySelector(".pg-nav");
    if (!nav || nav.dataset.navFeedbackReady === "true") return;
    nav.dataset.navFeedbackReady = "true";

    const controls = () => Array.from(nav.querySelectorAll(".pg-contact"));
    const release = (control) => control?.classList.remove("is-pressed");
    const showFeedback = (control, event) => {
      if (!control || control.dataset.navFeedbackAt === String(event.timeStamp)) return;
      control.dataset.navFeedbackAt = String(event.timeStamp);
      control.querySelectorAll(".pg-nav-ripple").forEach((ripple) => ripple.remove());
      const rect = control.getBoundingClientRect();
      const keyboard = event.type === "keydown";
      const ripple = document.createElement("span");
      ripple.className = "pg-nav-ripple";
      ripple.setAttribute("aria-hidden", "true");
      ripple.style.setProperty("--pg-nav-ripple-x", `${keyboard ? rect.width / 2 : event.clientX - rect.left}px`);
      ripple.style.setProperty("--pg-nav-ripple-y", `${keyboard ? rect.height / 2 : event.clientY - rect.top}px`);
      control.appendChild(ripple);
      control.classList.remove("is-pressed");
      void control.offsetWidth;
      control.classList.add("is-pressed");
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      window.setTimeout(() => ripple.remove(), 820);
      window.setTimeout(() => release(control), 240);
    };

    window.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const control = event.target?.closest?.(".pg-contact");
      if (!control || !nav.contains(control)) return;
      showFeedback(control, event);
    }, true);

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const control = event.target?.closest?.(".pg-contact");
      if (!control || !nav.contains(control)) return;
      showFeedback(control, event);
    }, true);

    ["pointerup", "pointercancel", "blur"].forEach((type) => {
      window.addEventListener(type, () => {
        window.setTimeout(() => controls().forEach(release), type === "blur" ? 0 : 120);
      }, true);
    });
  }

  function setupPrimarySectionNav() {
    const nav = document.querySelector(".pg-nav");
    if (!nav || nav.dataset.sectionIndicatorReady === "true") return;
    nav.dataset.sectionIndicatorReady = "true";

    const profile =
      document.querySelector(".home-tabs_layout") ||
      document.querySelector("section.home-selection");
    const experience = document.querySelector(".timeline_wrapper");
    const selectedWork = document.querySelector(".home-benefits-blank");
    const contact = document.querySelector("#pg-contact-final");
    if (profile && !profile.id) profile.id = "pg-profile-anchor";
    if (experience && !experience.id) experience.id = "pg-experience";
    if (selectedWork && !selectedWork.id) selectedWork.id = "pg-selected-work";

    const indicators = Array.from(
      nav.querySelectorAll(".pg-nav-links [data-pg-section-indicator]")
    );
    if (!profile || !experience || !selectedWork || !indicators.length) return;

    const getTargetTop = (section) => {
      const navHeight = nav.getBoundingClientRect().height || 0;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      let navOffset = navHeight;
      if (section.id === "pg-selected-work") {
        const compact = window.matchMedia("(max-width: 1280px), (max-height: 900px)").matches;
        const laptop = window.matchMedia("(min-width: 821px) and (max-width: 1280px), (min-width: 821px) and (max-height: 900px)").matches;
        navOffset = laptop ? 0 : compact ? Math.min(18, navHeight * 0.28) : navHeight;
      }
      return Math.max(
        0,
        Math.min(section.getBoundingClientRect().top + window.scrollY - navOffset, maxScroll)
      );
    };

    const setScroll = (engine, top) => {
      if (engine?.scrollTo) engine.scrollTo(top, { immediate: true, force: true });
      else window.scrollTo(0, top);
    };

    let activeSelector = "";
    let syncFrame = 0;

    const setActiveIndicator = (selector) => {
      if (selector === activeSelector) return;
      activeSelector = selector;
      nav.dataset.activeChapter = selector.replace(/^#pg-/, "") || "intro";
      indicators.forEach((indicator) => {
        const active = indicator.dataset.pgSectionIndicator === selector;
        indicator.classList.toggle("is-active", active);
        if (active) indicator.setAttribute("aria-current", "page");
        else indicator.removeAttribute("aria-current");
      });
    };

    const syncSectionIndicator = () => {
      syncFrame = 0;
      const viewportHeight = Math.max(1, window.innerHeight);
      const navHeight = nav.getBoundingClientRect().height || 0;
      const marker = navHeight + viewportHeight * 0.32;
      const nativeTurn = document.documentElement.dataset.pgNativeTurn || "profile";

      // During the canvas turn, keep the previous chapter selected. The native
      // controller owns the animation and publishes its final endpoint state.
      if (nativeTurn === "forward" || nativeTurn === "reverse") return;

      const contactRect = contact?.getBoundingClientRect();
      if (contactRect && contactRect.top <= marker && contactRect.bottom > navHeight) {
        setActiveIndicator("");
        return;
      }

      const selectedRect = selectedWork.getBoundingClientRect();
      if (selectedRect.top <= marker && selectedRect.bottom > navHeight) {
        setActiveIndicator("#pg-selected-work");
        return;
      }

      if (nativeTurn === "experience") {
        const experienceRect = experience.getBoundingClientRect();
        if (experienceRect.top <= viewportHeight * 0.68 && experienceRect.bottom > navHeight) {
          setActiveIndicator("#pg-experience");
          return;
        }
      }

      if (nativeTurn === "profile") {
        const profileRect = profile.getBoundingClientRect();
        if (profileRect.top <= marker && profileRect.bottom > navHeight) {
          setActiveIndicator("#pg-profile-anchor");
          return;
        }
      }

      setActiveIndicator("");
    };

    const requestIndicatorSync = () => {
      if (syncFrame) return;
      syncFrame = requestAnimationFrame(syncSectionIndicator);
    };

    const restoreSelectedWorkReturn = () => {
      if (window.location.hash !== "#pg-selected-work") return;

      document.documentElement.dataset.pgReturnTarget = "selected-work";
      document.documentElement.dataset.pgNavJumpLock = "true";
      try {
        window.history.scrollRestoration = "manual";
      } catch (error) {}

      let returnStateRestored = false;
      const restoreState = () => {
        if (returnStateRestored) return;
        returnStateRestored = true;
        window.dispatchEvent(new CustomEvent("portfolio:return-selected-work"));
      };
      const align = (refresh = false) => {
        restoreState();
        const scrollEngine =
          window.__portfolioLenis || (typeof lenis !== "undefined" ? lenis : null);
        if (scrollEngine && !window.__portfolioLenis) window.__portfolioLenis = scrollEngine;
        scrollEngine?.start?.();
        if (refresh) window.ScrollTrigger?.refresh?.();
        setScroll(scrollEngine, getTargetTop(selectedWork));
        requestIndicatorSync();
      };
      let returnSettleRaf = 0;
      let returnSettleCancelled = false;
      const finishReturn = () => {
        if (returnSettleRaf) cancelAnimationFrame(returnSettleRaf);
        returnSettleRaf = 0;
        document.documentElement.dataset.pgReturnReady = "true";
        delete document.documentElement.dataset.pgNavJumpLock;
        requestIndicatorSync();
      };
      const settleReturn = () => {
        align(true);
        const startedAt = performance.now();
        const step = (now) => {
          if (returnSettleCancelled || now - startedAt >= 2600) {
            finishReturn();
            return;
          }
          align(false);
          returnSettleRaf = requestAnimationFrame(step);
        };
        returnSettleRaf = requestAnimationFrame(step);
      };
      const cancelSettleOnInput = () => {
        returnSettleCancelled = true;
      };
      ["wheel", "touchstart", "pointerdown", "keydown"].forEach((eventName) => {
        window.addEventListener(eventName, cancelSettleOnInput, { once: true, passive: true });
      });

      requestAnimationFrame(() => align(false));
      if (document.body.classList.contains("site-loading")) {
        window.addEventListener("site:before-reveal", () => align(true), { once: true });
        window.addEventListener("site:ready", settleReturn, { once: true });
      } else {
        requestAnimationFrame(settleReturn);
      }
    };

    if (!window.__pgProfileEndpointRepairReady) {
      window.__pgProfileEndpointRepairReady = true;
      let repairTimer = 0;
      const repairProfileEndpoint = () => {
        repairTimer = 0;
        if (
          document.documentElement.dataset.pgNavJumpLock === "true" ||
          document.documentElement.dataset.pgContactJumpLock === "true" ||
          document.documentElement.dataset.pgNativeTurn !== "profile"
        ) return;

        const wrapperWidth = document
          .querySelector(".canvas-wrapper")
          ?.getBoundingClientRect().width || 0;
        const viewportWidth = Math.max(1, window.innerWidth);
        const anchorTop = profile.getBoundingClientRect().top;
        const navHeight = nav.getBoundingClientRect().height || 0;
        const nearProfileEndpoint =
          anchorTop >= -8 &&
          anchorTop <= navHeight + 8 &&
          wrapperWidth > viewportWidth * 0.01 &&
          wrapperWidth <= viewportWidth * 0.2;
        if (!nearProfileEndpoint) return;

        const scrollEngine =
          window.__portfolioLenis || (typeof lenis !== "undefined" ? lenis : null);
        setScroll(scrollEngine, getTargetTop(profile));
        requestIndicatorSync();
      };
      const scheduleProfileEndpointRepair = () => {
        window.clearTimeout(repairTimer);
        repairTimer = window.setTimeout(repairProfileEndpoint, 640);
      };
      window.addEventListener("wheel", scheduleProfileEndpointRepair, { passive: true });
      window.addEventListener("touchend", scheduleProfileEndpointRepair, { passive: true });
    }

    new MutationObserver(requestIndicatorSync).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-pg-native-turn"],
    });
    window.addEventListener("scroll", requestIndicatorSync, { passive: true });
    window.addEventListener("resize", requestIndicatorSync, { passive: true });
    window.addEventListener("site:ready", requestIndicatorSync, { once: true });
    window.addEventListener("portfolio:project-open", requestIndicatorSync);
    window.addEventListener("portfolio:project-close", requestIndicatorSync);

    restoreSelectedWorkReturn();
    requestIndicatorSync();
  }

  function setupContactNavLink() {
    const link = document.querySelector(".pg-contact");
    if (!link || link.dataset.contactNavReady === "true") return;
    link.dataset.contactNavReady = "true";
    link.removeAttribute("href");
    link.setAttribute("type", "button");

    let contactScrollTween = null;

    const getContactTop = (section) => {
      const navHeight = document.querySelector(".pg-nav")?.getBoundingClientRect().height || 0;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      return Math.max(
        0,
        Math.min(section.getBoundingClientRect().top + window.scrollY - navHeight, maxScroll)
      );
    };

    const jumpToContact = () => {
      const section = document.querySelector("#pg-contact-final");
      if (!section) return;

      window.__portfolioNavRequestId = (Number(window.__portfolioNavRequestId) || 0) + 1;
      window.cancelAnimationFrame(window.__portfolioNavGlideRaf);
      window.clearTimeout(window.__pgNavJumpLockTimer);
      window.__portfolioNavGlideResolve?.(false);
      delete window.__portfolioNavGlideResolve;
      delete document.documentElement.dataset.pgNavJumpLock;
      window.clearTimeout(window.__pgContactJumpLockTimer);
      document.documentElement.dataset.pgContactJumpLock = "true";

      if (window.location.hash) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }

      contactScrollTween?.kill?.();
      contactScrollTween = null;

      const scrollEngine =
        window.__portfolioLenis || (typeof lenis !== "undefined" ? lenis : null);
      if (scrollEngine && !window.__portfolioLenis) {
        window.__portfolioLenis = scrollEngine;
      }
      const top = getContactTop(section);
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let completed = false;

      const nativeGlide = new CustomEvent("pg-contact-glide-request", {
        detail: { top, duration: 0.75, reducedMotion, handled: false },
      });
      window.dispatchEvent(nativeGlide);
      if (nativeGlide.detail.handled) return;

      const complete = () => {
        if (completed) return;
        completed = true;
        window.clearTimeout(window.__pgContactJumpLockTimer);

        const correctedTop = getContactTop(section);
        if (Math.abs(window.scrollY - correctedTop) > 3) {
          if (scrollEngine?.scrollTo) {
            scrollEngine.scrollTo(correctedTop, { immediate: true, force: true });
          } else {
            window.scrollTo(0, correctedTop);
          }
        }

        delete document.documentElement.dataset.pgContactJumpLock;
      };

      if (reducedMotion) {
        if (scrollEngine?.scrollTo) {
          scrollEngine.scrollTo(top, { immediate: true, force: true });
        } else {
          window.scrollTo(0, top);
        }
        complete();
        return;
      }

      if (scrollEngine?.scrollTo) {
        scrollEngine.scrollTo(top, {
          duration: 0.75,
          easing: (progress) => 1 - Math.pow(1 - progress, 4),
          lock: true,
          force: true,
          onComplete: complete,
        });
      } else if (window.gsap) {
        const proxy = { y: window.scrollY };
        contactScrollTween = window.gsap.to(proxy, {
          y: top,
          duration: 0.75,
          ease: "power4.out",
          overwrite: true,
          onUpdate: () => window.scrollTo(0, proxy.y),
          onComplete: complete,
        });
      } else {
        window.scrollTo({ top, behavior: "smooth" });
      }

      window.__pgContactJumpLockTimer = window.setTimeout(complete, 1100);
    };

    let lastContactJump = 0;
    const activateContactLink = (event) => {
      const target = event.target?.closest?.("[data-contact-jump='true'], .pg-contact");
      if (!target) return;
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const now = Date.now();
      if (now - lastContactJump < 900) return;
      lastContactJump = now;
      jumpToContact();
    };

    ["pointerdown", "touchstart", "click", "keydown"].forEach((type) => {
      window.addEventListener(type, activateContactLink, true);
      document.addEventListener(type, activateContactLink, true);
      link.addEventListener(type, activateContactLink, true);
    });

    document.addEventListener(
      "click",
      (event) => {
        if (document.documentElement.dataset.pgContactJumpLock !== "true") return;
        const anchor = event.target?.closest?.("a[href]");
        if (!anchor) return;
        const url = new URL(anchor.getAttribute("href"), window.location.href);
        if (url.hostname.endsWith("sui.io") && url.hash === "#pg-contact-final") {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          jumpToContact();
        }
      },
      true
    );
  }

  function setupBottomReboundEffect() {
    const rebound = document.querySelector(".custom_scroll");
    const effect = rebound?.querySelector?.(".rebound_effect");
    if (!rebound || !effect || rebound.dataset.pgReboundReady === "true") return;
    rebound.dataset.pgReboundReady = "true";

    let ticking = false;
    let layoutSyncTimer = 0;
    let reboundSettleTimer = 0;
    let reboundFallbackTimer = 0;
    let reboundRecoveryTween = null;
    let reboundRecoveryRunning = false;
    let forcedVelocityReleaseTimer = 0;

    const getHostReboundTrigger = () => {
      if (!window.ScrollTrigger?.getAll) return null;
      return window.ScrollTrigger.getAll().find((trigger) => {
        return trigger?.trigger === rebound &&
          String(trigger.vars?.start || "") === "top bottom" &&
          String(trigger.vars?.end || "") === "bottom bottom";
      }) || null;
    };

    const isAtReboundEdge = () => {
      const viewport = window.innerHeight || 1;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewport);
      const bottomTolerance = Math.max(8, viewport * 0.012);
      const rect = rebound.getBoundingClientRect();
      return maxScroll > 0 &&
        window.scrollY >= maxScroll - bottomTolerance &&
        rect.top < viewport &&
        rect.bottom > 0;
    };

    const clearReboundRecovery = () => {
      window.clearTimeout(reboundSettleTimer);
      window.clearTimeout(reboundFallbackTimer);
      reboundSettleTimer = 0;
      reboundFallbackTimer = 0;
    };

    const finishReboundRecovery = () => {
      reboundRecoveryRunning = false;
      rebound.dataset.pgReboundRecovery = "idle";
      reboundRecoveryTween = null;
    };

    const runFallbackRebound = () => {
      if (reboundRecoveryRunning || !isAtReboundEdge()) return;
      const trigger = getHostReboundTrigger();
      const target = Math.max(
        0,
        Number.isFinite(trigger?.start)
          ? trigger.start
          : rebound.getBoundingClientRect().top + window.scrollY - (window.innerHeight || 1)
      );
      const start = window.scrollY;
      if (start - target < 4) return;

      reboundRecoveryRunning = true;
      rebound.dataset.pgReboundRecovery = "fallback";
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (reduceMotion || !window.gsap) {
        window.scrollTo(0, target);
        finishReboundRecovery();
        return;
      }

      const proxy = { y: start };
      reboundRecoveryTween?.kill?.();
      reboundRecoveryTween = window.gsap.to(proxy, {
        y: target,
        duration: 1.08,
        ease: "power3.out",
        overwrite: true,
        onUpdate: () => window.scrollTo(0, proxy.y),
        onComplete: finishReboundRecovery,
        onInterrupt: finishReboundRecovery
      });
    };

    const nudgeHostRebound = () => {
      const trigger = getHostReboundTrigger();
      const hostUpdate = trigger?.vars?.onUpdate;
      if (!trigger || typeof hostUpdate !== "function" || trigger.progress < 0.72) return false;

      const originalGetVelocity = trigger.getVelocity;
      const forcedGetVelocity = () => 0;
      window.clearTimeout(forcedVelocityReleaseTimer);
      trigger.getVelocity = forcedGetVelocity;
      try {
        hostUpdate(trigger);
      } finally {
        forcedVelocityReleaseTimer = window.setTimeout(() => {
          if (trigger.getVelocity === forcedGetVelocity) trigger.getVelocity = originalGetVelocity;
        }, 120);
      }
      rebound.dataset.pgReboundRecovery = "host";
      return true;
    };

    const recoverReboundAfterIdle = () => {
      reboundSettleTimer = 0;
      if (reboundRecoveryRunning) return;
      if (!isAtReboundEdge()) {
        rebound.dataset.pgReboundRecovery = "idle";
        return;
      }
      nudgeHostRebound();
      window.clearTimeout(reboundFallbackTimer);
      reboundFallbackTimer = window.setTimeout(() => {
        reboundFallbackTimer = 0;
        if (isAtReboundEdge()) runFallbackRebound();
      }, 360);
    };

    const scheduleReboundRecovery = (delay = 180) => {
      if (reboundRecoveryRunning) return;
      window.clearTimeout(reboundSettleTimer);
      rebound.dataset.pgReboundRecovery = "armed";
      reboundSettleTimer = window.setTimeout(recoverReboundAfterIdle, delay);
    };

    const update = () => {
      ticking = false;
      const rect = rebound.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const visible = Math.min(viewport, rect.bottom) - Math.max(0, rect.top);
      const visibleRatio = clamp(visible / Math.max(1, Math.min(viewport, rect.height)));
      const compactViewport = window.matchMedia("(max-width: 820px)").matches;
      const ratio = compactViewport ? clamp(visibleRatio / 0.82) : visibleRatio;
      const eased = smootherStep(ratio);
      const settle = smootherStep(mapRange(eased, 0.72, 1));
      const y = Math.round((1 - eased) * 88 - settle * 10);
      const scale = 0.82 + eased * 0.26 - settle * 0.06;
      const opacity = 0.52 + eased * 0.48;

      rebound.style.setProperty("--pg-rebound-y", `${y}px`);
      rebound.style.setProperty("--pg-rebound-scale", scale.toFixed(3));
      rebound.style.setProperty("--pg-rebound-opacity", opacity.toFixed(3));
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    const requestLayoutSync = () => {
      requestUpdate();
      window.clearTimeout(layoutSyncTimer);
      layoutSyncTimer = window.setTimeout(() => {
        window.ScrollTrigger?.refresh?.();
        requestUpdate();
      }, 140);
    };

    window.addEventListener("scroll", () => {
      requestUpdate();
      if (isAtReboundEdge()) scheduleReboundRecovery(210);
    }, { passive: true });
    window.addEventListener("wheel", (event) => {
      const impulse = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (impulse > 0.5 && isAtReboundEdge()) {
        scheduleReboundRecovery(180);
        return;
      }
      if (impulse < -0.5) {
        clearReboundRecovery();
        reboundRecoveryTween?.kill?.();
        reboundRecoveryTween = null;
        reboundRecoveryRunning = false;
        rebound.dataset.pgReboundRecovery = "idle";
      }
    }, { passive: true, capture: true });
    window.addEventListener("touchend", () => {
      if (isAtReboundEdge()) scheduleReboundRecovery(240);
    }, { passive: true });
    window.addEventListener("touchcancel", () => {
      if (isAtReboundEdge()) scheduleReboundRecovery(240);
    }, { passive: true });
    window.addEventListener("resize", requestLayoutSync, { passive: true });
    window.addEventListener("orientationchange", requestLayoutSync, { passive: true });
    window.visualViewport?.addEventListener("resize", requestUpdate, { passive: true });

    if ("ResizeObserver" in window) {
      const reboundResizeObserver = new ResizeObserver(requestUpdate);
      reboundResizeObserver.observe(rebound);
    }

    requestUpdate();
  }

  function setupExternalNavigationGuard() {
    if (document.documentElement.dataset.pgExternalGuardReady === "true") return;
    document.documentElement.dataset.pgExternalGuardReady = "true";

    const safeProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);
    const isBlockedExternalUrl = (value) => {
      if (!value) return false;
      const raw = String(value).trim();
      if (!raw || raw === "#" || raw.startsWith("#")) return false;
      if (/^(javascript|data|vbscript):/i.test(raw)) return true;

      let url;
      try {
        url = new URL(raw, window.location.href);
      } catch {
        return true;
      }

      if (!safeProtocols.has(url.protocol)) return true;
      if (url.protocol === "mailto:" || url.protocol === "tel:") return false;
      return url.origin !== window.location.origin;
    };

    document.querySelectorAll("a[href]").forEach((anchor) => {
      if (!isBlockedExternalUrl(anchor.getAttribute("href"))) return;
      anchor.dataset.pgExternalBlocked = "true";
      anchor.removeAttribute("target");
      anchor.setAttribute("rel", "nofollow noopener");
      anchor.setAttribute("aria-disabled", "true");
    });

    const blockExternalNavigation = (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || !isBlockedExternalUrl(anchor.getAttribute("href"))) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    ["click", "auxclick"].forEach((type) => {
      document.addEventListener(type, blockExternalNavigation, true);
      window.addEventListener(type, blockExternalNavigation, true);
    });

    document.addEventListener(
      "submit",
      (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!isBlockedExternalUrl(form.getAttribute("action"))) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      },
      true
    );

    if (typeof window.open === "function" && !window.open.__pgExternalGuarded) {
      const originalOpen = window.open.bind(window);
      const guardedOpen = (url, target, features) => {
        if (isBlockedExternalUrl(url)) return null;
        return originalOpen(url, target, features);
      };
      guardedOpen.__pgExternalGuarded = true;
      window.open = guardedOpen;
    }
  }

  function setupPortfolioNavLayer() {
    const nav = document.querySelector(".pg-nav");
    if (!nav || nav.dataset.portfolioNavLayer === "true") return;
    nav.dataset.portfolioNavLayer = "true";
    document.body.appendChild(nav);
  }

  function setupContactOpening() {
    const section = document.querySelector("#pg-contact-final");
    if (!section || section.dataset.contactOpeningReady === "true") return;
    section.dataset.contactOpeningReady = "true";

    const eyebrow = section.querySelector(".pg-contact-final__title p");
    const titleLines = Array.from(section.querySelectorAll(".pg-contact-final__title h2 span"));
    const panel = section.querySelector(".pg-contact-final__panel");
    const panelItems = Array.from(section.querySelectorAll(".pg-contact-final__panel p, .pg-contact-final__panel span"));

    const sweep = document.createElement("div");
    sweep.className = "pg-contact-final__sweep";
    sweep.setAttribute("aria-hidden", "true");
    section.appendChild(sweep);

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion || !window.gsap) {
      section.classList.add("pg-contact-opening-complete");
      return;
    }

    const gsap = window.gsap;
    let premiumEase = "power4.out";
    let softEase = "power3.out";
    if (window.CustomEase) {
      window.CustomEase.create("pg-contact-premium", "0.16, 0.94, 0.22, 1");
      window.CustomEase.create("pg-contact-soft", "0.2, 0.84, 0.24, 1");
      premiumEase = "pg-contact-premium";
      softEase = "pg-contact-soft";
    }

    const setInitialState = () => {
      gsap.set(section, { "--pg-contact-line-scale": 0 });
      gsap.set(eyebrow, { autoAlpha: 0, y: 18, filter: "blur(10px)" });
      gsap.set(titleLines, { clearProps: "transform" });
      gsap.set(titleLines, {
        yPercent: 118,
        x: -36,
        autoAlpha: 0,
        scaleX: 1.08,
        scaleY: 1.12,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        filter: "blur(18px)",
        clipPath: "inset(0 0 100% 0)"
      });
      gsap.set(panel, { autoAlpha: 0, y: 44, filter: "blur(14px)" });
      gsap.set(panelItems, { autoAlpha: 0, y: 18 });
      gsap.set(sweep, { autoAlpha: 0, xPercent: -115, scaleX: 0.72 });
    };

    setInitialState();
    section.dataset.contactOpeningState = "armed";

    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: premiumEase },
      onComplete: () => {
        section.classList.add("pg-contact-opening-complete");
        section.dataset.contactOpeningState = "complete";
        gsap.set([eyebrow, titleLines, panel, panelItems, sweep], { clearProps: "filter,clipPath,transform,opacity,visibility" });
        gsap.set(section, { "--pg-contact-line-scale": 1 });
      }
    });

    tl.to(eyebrow, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.1 }, 0.08)
      .to(titleLines, {
        yPercent: 0,
        x: 0,
        autoAlpha: 1,
        scaleX: 1,
        scaleY: 1,
        filter: "blur(0px)",
        clipPath: "inset(0 0 0% 0)",
        duration: 1.65,
        stagger: 0.16
      }, 0.2)
      .to(section, { "--pg-contact-line-scale": 1, duration: 1.35, ease: softEase }, 0.95)
      .to(sweep, { autoAlpha: 0.62, xPercent: 18, scaleX: 1, duration: 1.65, ease: softEase }, 0.72)
      .to(sweep, { autoAlpha: 0, duration: 0.72, ease: "power2.out" }, 1.95)
      .to(panel, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.1, ease: softEase }, 1.45)
      .to(panelItems, { autoAlpha: 1, y: 0, duration: 0.86, stagger: 0.1, ease: softEase }, 1.68);

    const play = () => {
      if (section.dataset.contactOpeningPlayed === "true") return;
      section.dataset.contactOpeningPlayed = "true";
      section.dataset.contactOpeningState = "playing";
      section.dataset.contactOpeningRuns = String((Number(section.dataset.contactOpeningRuns) || 0) + 1);
      section.classList.remove("pg-contact-opening-complete");
      tl.play(0);
    };

    const reset = () => {
      if (section.dataset.contactOpeningPlayed !== "true") return;
      tl.pause(0);
      section.dataset.contactOpeningPlayed = "false";
      section.dataset.contactOpeningState = "armed";
      section.classList.remove("pg-contact-opening-complete");
      setInitialState();
    };

    if (window.ScrollTrigger) {
      window.ScrollTrigger.create({
        trigger: section,
        start: "top 72%",
        end: "bottom 28%",
        onEnter: play,
        onEnterBack: play,
        onLeave: reset,
        onLeaveBack: reset
      });
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio >= 0.28) play();
          else if (entry.intersectionRatio <= 0.02) reset();
        });
      }, { threshold: [0, 0.02, 0.28] });
      observer.observe(section);
    }
  }

  function setupProjectPageSlot() {
    const slot = document.querySelector(".home-benefits-blank");
    if (!slot || slot.dataset.projectPageReady === "true") return;
    slot.dataset.projectPageReady = "true";
    if (!document.querySelector('link[data-project-viewport-fit]')) {
      const viewportStyles = document.createElement("link");
      viewportStyles.rel = "stylesheet";
      viewportStyles.href = "project-viewport-fit.css?v=project-viewport-fit-7";
      viewportStyles.dataset.projectViewportFit = "true";
      document.head.appendChild(viewportStyles);
    }
    slot.classList.add("pg-project-page");
    slot.removeAttribute("aria-hidden");

    const projectItems = [
      ["PORTABLE LUNCH BOX", "food-container-h0.png", "rgb(204,153,51)", "FEBRUARY 2022", "Food Container", "FULLSTACK DEV & MOTION", "宁波中孚家用品", "Leakage, poor insulation, and inconvenient storage limit the user experience of traditional lunch boxes.", "便携饭盒", "01/便携饭盒", "projects/food-container/index.html"],
      ["Paul et Henriette", "ph-h0.jpg", "rgb(30,30,30)", "MAY 2021", "PHOTOGRAPHY", "FULLSTACK DEV & MOTION", "PAUL & HENRIETTE", "PORTFOLIO OF PAUL & HENRIETTE, A FRENCH PHOTOGRAPHERS DUO BASED IN PARIS."],
      ["Canals", "canals-h0.jpg", "rgb(255,241,206)", "DECEMBER 2019", "PERSONAL", "FULLSTACK DEV & MOTION", "MARCUS BROWN", "PERSONAL PROJECT ABOUT THE HISTORY OF THE AMSTERDAM CANALS."],
      ["Jacques Marie Mage", "jmm-h0.jpg", "rgb(30,30,30)", "APRIL 2022", "ECOMMERCE", "FRONT-END DEV & MOTION", "JACQUES MARIE MAGE", "ECOMMERCE FOR JACQUES MARIE MAGE, EYEWEAR DESIGNER AND MANUFACTURER."],
      ["Mank", "mank-h0.jpg", "rgb(217,217,217)", "MARCH 2021", "PROMOTIONAL", "FULLSTACK DEV & MOTION", "NETFLIX - WATSON DG", "THE DIGITAL ART BOOK OF MANK, A NETFLIX MOVIE DIRECTED BY DAVID FINCHER."],
      ["Waka Waka No. 1", "waka-1-h0.jpg", "rgb(42,42,42)", "OCTOBER 2019", "PROMOTIONAL", "FULLSTACK DEV & MOTION", "SHIN OKUDA", "STUDIO FOCUSING ON WOOD FURNITURE AND FUNCTIONAL OBJECTS BASED IN LOS ANGELES."],
      ["Capsulin", "capsulin-h0.jpg", "rgb(240,240,240)", "NOVEMBER 2021", "PROMOTIONAL", "FULL STACK DEV & MOTION", "INDEX STUDIO", "CAPSULIN ALUMINIUM, A ONE PAGE WEBSITE MADE WITH INDEX STUDIO IN NATIVE WEBGL."],
      ["Design Embraced", "design-embraced-h0.jpg", "rgb(217,146,153)", "SEPTEMBER 2019", "PORTFOLIO", "FULLSTACK DEV & MOTION", "ANTHONY GOODWIN", "PORTFOLIO OF ANTHONY GOODWIN, CREATIVE AND ART DIRECTOR AND DESIGNER."],
      ["New Company", "new-company-h0.jpg", "rgb(224,200,164)", "JUNE 2019", "PORTFOLIO", "FULLSTACK DEV & MOTION", "NEW COMPANY", "DIGITAL PORTFOLIO FOR A STRATEGY AND CREATIVE COMPANY."]
    ];

    const projects = projectItems.map((item) => ({
      title: item[0],
      image: `project-page-assets/images/${item[1]}`,
      color: item[2],
      completed: item[3],
      type: item[4],
      role: item[5],
      client: item[6],
      copy: item[7],
      cardTitle: item[8] || item[0],
      cardLabel: item[9] || "",
      href: item[10] || ""
    }));
    const pad = (value) => String(value).padStart(2, "0");
    const splitTitle = (title) => {
      const clean = title.replace(/\s+No\.?\s*/i, " No. ");
      const words = clean.split(" ");
      if (words.length < 2) return [clean];
      const pivot = Math.ceil(words.length / 2);
      return [words.slice(0, pivot).join(" "), words.slice(pivot).join(" ")];
    };

    slot.innerHTML = `
      <div class="pg-project" data-pg-project>
        <div class="pg-project__loader" aria-live="polite">001</div>
        <nav class="pg-project__ticks" data-project-ticks aria-label="Project quick navigation"></nav>
        <nav class="pg-project__nav" aria-label="Project page controls">
          <button class="pg-project__brand" type="button" data-project-home aria-label="Selected work">
            <span>SELECTED WORK</span>
          </button>
          <button class="pg-project__close" type="button" data-project-close>CLOSE</button>
        </nav>
        <section class="pg-project__carousel" aria-label="Selected work">
          <div class="pg-project__stage" data-project-stage></div>
        </section>
        <section class="pg-project__detail" id="pg-project-detail" aria-live="polite">
          <div class="pg-project__pager"><span data-project-index>01</span><span data-project-total>${pad(projects.length)}</span></div>
          <h2 class="pg-project__title" data-project-title></h2>
          <button class="pg-project__cta boton-elegante" type="button" data-project-cta>VIEW PROJECT</button>
          <div class="pg-project__meta" data-project-meta></div>
          <p class="pg-project__copy" data-project-copy></p>
        </section>
      </div>
    `;

    const projectRoot = slot.querySelector("[data-pg-project]");
    const stage = slot.querySelector("[data-project-stage]");
    const ticks = slot.querySelector("[data-project-ticks]");
    const loader = slot.querySelector(".pg-project__loader");
    const detailTitle = slot.querySelector("[data-project-title]");
    const detailCta = slot.querySelector("[data-project-cta]");
    const detailMeta = slot.querySelector("[data-project-meta]");
    const detailCopy = slot.querySelector("[data-project-copy]");
    const detailIndex = slot.querySelector("[data-project-index]");
    const cards = [];
    const tickButtons = [];
    let selected = 0;
    let target = 0;
    let current = 0;
    let pointerX = 0;
    let pointerY = 0;
    let raf = 0;
    let active = false;
    let lastWheelStepAt = 0;
    let phoneWheelAccumulator = 0;
    let phoneWheelGestureLocked = false;
    let phoneWheelReleaseTimer = 0;
    let openAlignRaf = 0;

    const clampIndex = (value) => Math.max(0, Math.min(projects.length - 1, value));

    const setTheme = (project) => {
      projectRoot.style.setProperty("--pp-accent", project.color);
    };

    const renderDetail = () => {
      const project = projects[selected];
      const isPublished = Boolean(project.href);
      detailIndex.textContent = pad(selected + 1);
      detailTitle.innerHTML = splitTitle(project.title).map((line) => `<span>${line}</span>`).join("");
      detailCta.dataset.projectHref = isPublished ? project.href : "";
      detailCta.disabled = !isPublished;
      detailCta.textContent = isPublished ? "VIEW PROJECT" : "COMING SOON";
      detailCta.setAttribute(
        "aria-label",
        isPublished
          ? `View project: ${project.cardTitle}`
          : `${project.cardTitle}: project page coming soon`
      );
      detailMeta.innerHTML = `
        <div><b>A</b><span>COMPLETED</span><br><span>${project.completed}</span></div>
        <div><b>B</b><span>TYPE</span><br><span>${project.type}</span></div>
        <div><b>C</b><span>ROLE</span><br><span>${project.role}</span></div>
        <div><b>D</b><span>CLIENT</span><br><span>${project.client}</span></div>
      `;
      detailCopy.textContent = project.copy;
    };

    const syncTickStates = () => {
      const workOpen = projectRoot.classList.contains("is-work");
      tickButtons.forEach((tick, tickIndex) => {
        const isSelected = tickIndex === selected;
        tick.classList.toggle("is-active", isSelected);
        tick.setAttribute("aria-pressed", String(isSelected));
        if (isSelected) tick.setAttribute("aria-current", "true");
        else tick.removeAttribute("aria-current");
        tick.setAttribute(
          "aria-label",
          `${workOpen ? "View" : "Open"} project ${pad(tickIndex + 1)}: ${projects[tickIndex].cardTitle}${isSelected ? ", current" : ""}`
        );
      });
    };

    const syncCardStates = () => {
      const workOpen = projectRoot.classList.contains("is-work");
      cards.forEach((card, cardIndex) => {
        const isSelected = cardIndex === selected;
        card.classList.toggle("is-active", isSelected);
        card.setAttribute("aria-pressed", String(isSelected));
        card.setAttribute("aria-expanded", String(workOpen && isSelected));
      });
      syncTickStates();
    };

    const selectProject = (index, options = {}) => {
      selected = clampIndex(index);
      target = selected;
      if (options.snap) current = selected;
      setTheme(projects[selected]);
      syncCardStates();
      renderDetail();
      requestLayout();
    };

    const cancelOpenAlignment = () => {
      if (openAlignRaf) cancelAnimationFrame(openAlignRaf);
      openAlignRaf = 0;
    };

    const alignOpenProject = () => {
      cancelOpenAlignment();
      const navHeight = document.querySelector(".pg-nav")?.getBoundingClientRect().height || 0;
      const phoneFrame = window.matchMedia("(max-width: 820px)").matches;
      const compactFrame = window.matchMedia("(max-width: 1280px), (max-height: 900px)").matches;
      const laptopFrame = window.matchMedia("(min-width: 821px) and (max-width: 1280px), (min-width: 821px) and (max-height: 900px)").matches;
      const navOffset = laptopFrame ? 0 : compactFrame ? Math.min(18, navHeight * 0.28) : navHeight;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const destination = Math.max(0, Math.min(slot.getBoundingClientRect().top + window.scrollY - navOffset, maxScroll));
      const start = window.scrollY;
      const distance = destination - start;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(distance) < 2) {
        window.scrollTo(0, destination);
        return;
      }
      const duration = phoneFrame ? 420 : compactFrame ? 620 : 780;
      const startedAt = performance.now();
      const step = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = phoneFrame ? progress * progress * (3 - 2 * progress) : 1 - Math.pow(1 - progress, 4);
        window.scrollTo(0, start + distance * eased);
        if (progress < 1) {
          openAlignRaf = requestAnimationFrame(step);
          return;
        }
        openAlignRaf = 0;
      };
      openAlignRaf = requestAnimationFrame(step);
    };

    const setMode = (mode) => {
      const workOpen = mode === "work";
      projectRoot.classList.toggle("is-work", workOpen);
      slot.classList.toggle("pg-project-open", workOpen);
      syncCardStates();
      if (workOpen) {
        requestAnimationFrame(() => alignOpenProject());
      } else {
        cancelOpenAlignment();
      }
    };

    const openWork = (index) => {
      selectProject(index, { snap: true });
      setMode("work");
    };

    const moveProject = (direction) => {
      const next = clampIndex(selected + direction);
      if (next === selected) return;
      selectProject(next);
    };

    const isInsideProjectPage = (event) => {
      const hovered = document.elementFromPoint(event.clientX, event.clientY);
      if (hovered?.closest?.(".pg-project__card, .pg-project__close")) return true;
      const rect = projectRoot.getBoundingClientRect();
      const phone = window.matchMedia("(max-width: 820px)").matches;
      const compact = window.matchMedia("(max-width: 1280px), (max-height: 900px)").matches;
      const zone = phone ? {
        left: rect.left + rect.width * 0.06,
        right: rect.left + rect.width * 0.94,
        top: rect.top + rect.height * 0.22,
        bottom: rect.top + rect.height * 0.72
      } : {
        left: rect.left + rect.width * (compact ? 0.24 : 0.13),
        right: rect.left + rect.width * (compact ? 0.76 : 0.82),
        top: rect.top + rect.height * (compact ? 0.25 : 0.18),
        bottom: rect.top + rect.height * (compact ? 0.56 : 0.64)
      };
      return rect.bottom > 0 && rect.top < window.innerHeight && event.clientX >= zone.left && event.clientX <= zone.right && event.clientY >= zone.top && event.clientY <= zone.bottom;
    };

    const layoutCards = () => {
      if (!active) {
        raf = 0;
        return;
      }
      current += (target - current) * 0.075;
      const rect = projectRoot.getBoundingClientRect();
      const gap = Math.max(128, Math.min(210, rect.width * 0.145));
      const driftX = pointerX * 28;
      const driftY = pointerY * 18;

      cards.forEach((card, index) => {
        const diff = index - current;
        const abs = Math.abs(diff);
        const x = diff * gap + driftX;
        const y = Math.sin((index + current) * 0.68) * 42 + driftY;
        const z = 150 - abs * 95;
        const rot = diff * -7 + pointerX * 5;
        const scale = Math.max(0.72, 1.08 - abs * 0.055);
        const opacity = abs > 9 ? 0 : Math.max(0.14, 1 - abs * 0.085);
        card.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), ${z}px) rotateY(${rot}deg) rotateZ(${diff * 0.35}deg) scale(${scale})`;
        card.style.opacity = opacity.toFixed(3);
        card.style.zIndex = String(1000 - Math.round(abs * 10));
      });
      if (Math.abs(target - current) > 0.001) {
        raf = requestAnimationFrame(layoutCards);
      } else {
        current = target;
        raf = 0;
      }
    };

    const requestLayout = () => {
      if (!active || raf) return;
      raf = requestAnimationFrame(layoutCards);
    };

    const start = () => {
      if (active) return;
      active = true;
      requestLayout();
    };

    const stop = () => {
      active = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const showTickPress = (tick) => {
      tick.classList.remove("is-pressed");
      void tick.offsetWidth;
      tick.classList.add("is-pressed");
      window.setTimeout(() => tick.classList.remove("is-pressed"), 520);
    };

    projects.forEach((project, index) => {
      const tick = document.createElement("button");
      tick.className = "pg-project__tick";
      tick.type = "button";
      tick.setAttribute("aria-controls", "pg-project-detail");
      tick.setAttribute("aria-pressed", "false");
      tick.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showTickPress(tick);
        openWork(index);
      });
      ticks.appendChild(tick);
      tickButtons.push(tick);
    });

    projects.forEach((project, index) => {
      const card = document.createElement("button");
      card.className = "pg-project__card";
      card.type = "button";
      card.setAttribute("aria-label", project.cardTitle);
      card.setAttribute("aria-controls", "pg-project-detail");
      card.setAttribute("aria-pressed", "false");
      card.setAttribute("aria-expanded", "false");
      card.innerHTML = `<img src="${project.image}" loading="${index < 3 ? "eager" : "lazy"}" alt=""><span class="pg-project__card-label">${project.cardLabel || `${pad(index + 1)} / ${project.cardTitle}`}</span>`;
      card.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openWork(index);
      });
      stage.appendChild(card);
      cards.push(card);
    });

    slot.querySelector("[data-project-home]").addEventListener("click", () => setMode("home"));
    window.addEventListener("portfolio:return-selected-work", () => {
      cancelOpenAlignment();
      selectProject(0, { snap: true });
      setMode("home");
    });
    detailCta.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const projectHref = detailCta.dataset.projectHref;
      if (!projectHref || detailCta.dataset.navigating === "true") return;
      detailCta.dataset.navigating = "true";
      detailCta.classList.remove("is-pressed");
      void detailCta.offsetWidth;
      detailCta.classList.add("is-pressed");
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => {
        window.location.assign(projectHref);
      }, reduceMotion ? 0 : 180);
    });
    const closeControl = slot.querySelector("[data-project-close]");
    closeControl.addEventListener("click", (event) => {
      event.preventDefault();
      if (closeControl.dataset.closing === "true") return;
      closeControl.dataset.closing = "true";
      closeControl.classList.remove("is-pressed");
      void closeControl.offsetWidth;
      closeControl.classList.add("is-pressed");

      const nav = closeControl.closest(".pg-project__nav");
      if (nav) {
        const navRect = nav.getBoundingClientRect();
        const closeRect = closeControl.getBoundingClientRect();
        const ripple = document.createElement("span");
        ripple.className = "pg-project__close-ripple";
        ripple.setAttribute("aria-hidden", "true");
        ripple.style.setProperty("--pg-close-ripple-x", `${closeRect.left + closeRect.width / 2 - navRect.left}px`);
        ripple.style.setProperty("--pg-close-ripple-y", `${closeRect.top + closeRect.height / 2 - navRect.top}px`);
        nav.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
        window.setTimeout(() => ripple.remove(), 900);
      }

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => {
        setMode("home");
        closeControl.dataset.closing = "false";
      }, reduceMotion ? 0 : 120);
      window.setTimeout(() => closeControl.classList.remove("is-pressed"), reduceMotion ? 0 : 360);
    });
    projectRoot.addEventListener("pointermove", (event) => {
      const rect = projectRoot.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      requestLayout();
    });

    window.addEventListener("wheel", (event) => {
      if (!isInsideProjectPage(event)) return;
      cancelOpenAlignment();
      const phoneFrame = window.matchMedia("(max-width: 820px)").matches;
      const impulse = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (phoneFrame) {
        const direction = impulse > 0 ? 1 : -1;
        if (clampIndex(selected + direction) === selected) {
          phoneWheelAccumulator = 0;
          phoneWheelGestureLocked = false;
          window.clearTimeout(phoneWheelReleaseTimer);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (Math.abs(impulse) < 1) return;
        phoneWheelAccumulator += impulse;
        window.clearTimeout(phoneWheelReleaseTimer);
        phoneWheelReleaseTimer = window.setTimeout(() => {
          phoneWheelAccumulator = 0;
          phoneWheelGestureLocked = false;
        }, 260);
        if (phoneWheelGestureLocked || Math.abs(phoneWheelAccumulator) < 42) return;
        phoneWheelGestureLocked = true;
        moveProject(phoneWheelAccumulator > 0 ? 1 : -1);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (Math.abs(impulse) < 2) return;
      const now = performance.now();
      if (now - lastWheelStepAt < 170) return;
      lastWheelStepAt = now;
      moveProject(impulse > 0 ? 1 : -1);
    }, { passive: false, capture: true });

    window.addEventListener("keydown", (event) => {
      if (!active) return;
      if (event.key === "Escape") setMode("home");
      if (event.key === "ArrowRight") moveProject(1);
      if (event.key === "ArrowLeft") moveProject(-1);
      if (event.key === "Enter" && !projectRoot.classList.contains("is-work")) openWork(selected);
    });

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0.12);
      if (visible) start();
      else stop();
    }, { threshold: [0, 0.12, 0.5] });
    observer.observe(slot);

    let n = 1;
    const timer = window.setInterval(() => {
      n += Math.ceil((101 - n) * 0.09);
      loader.textContent = String(Math.min(n, 100)).padStart(3, "0");
      if (n >= 100) {
        window.clearInterval(timer);
        window.setTimeout(() => projectRoot.classList.add("is-loaded"), 180);
      }
    }, 32);

    window.addEventListener("resize", () => {
      requestLayout();
      if (projectRoot.classList.contains("is-work")) {
        if (window.matchMedia("(max-width: 820px)").matches) {
          cancelOpenAlignment();
          return;
        }
        window.setTimeout(() => alignOpenProject(), 80);
      }
    }, { passive: true });
    window.addEventListener("touchstart", cancelOpenAlignment, { passive: true });
    selectProject(0, { snap: true });
  }

  function setupProjectPageSnap() {
    const slot = document.querySelector(".home-benefits-blank");
    if (!slot || slot.dataset.projectSnapReady === "true") return;
    slot.dataset.projectSnapReady = "true";

    let hasSnappedInView = false;
    let isSnapping = false;
    let lastSnapAt = 0;
    let alignmentRaf = 0;
    let scrollSettleTimer = 0;
    let touchActive = false;
    let lastScrollY = window.scrollY;
    let lastScrollDirection = 0;
    const isPhoneFrame = () => window.matchMedia("(max-width: 820px)").matches;
    const isCompactFrame = () => window.matchMedia("(max-width: 1280px), (max-height: 900px)").matches;
    const getSnapThreshold = () => (isPhoneFrame() ? 0.74 : isCompactFrame() ? 0.44 : 0.55);
    const getResetThreshold = () => (isPhoneFrame() ? 0.14 : isCompactFrame() ? 0.24 : 0.35);
    const navigationBusy = () => {
      return document.documentElement.dataset.pgNavJumpLock === "true";
    };

    const getVisibleRatio = () => {
      const rect = slot.getBoundingClientRect();
      const visible = Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top);
      return Math.max(0, Math.min(1, visible / Math.max(1, Math.min(window.innerHeight, rect.height))));
    };

    const getNavOffset = () => {
      const navHeight = document.querySelector(".pg-nav")?.getBoundingClientRect().height || 0;
      const laptopFrame = window.matchMedia("(min-width: 821px) and (max-width: 1280px), (min-width: 821px) and (max-height: 900px)").matches;
      if (laptopFrame) return 0;
      return isCompactFrame() ? Math.min(18, navHeight * 0.28) : navHeight;
    };

    const isAligned = () => {
      const tolerance = isPhoneFrame() ? 24 : isCompactFrame() ? 30 : 42;
      return Math.abs(slot.getBoundingClientRect().top - getNavOffset()) <= tolerance;
    };

    const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cancelAlignment = () => {
      if (alignmentRaf) cancelAnimationFrame(alignmentRaf);
      alignmentRaf = 0;
      isSnapping = false;
    };

    const alignProjectPage = () => {
      const navOffset = getNavOffset();
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const top = Math.max(0, Math.min(slot.getBoundingClientRect().top + window.scrollY - navOffset, maxScroll));
      cancelAlignment();
      const start = window.scrollY;
      const distance = top - start;
      if (reducedMotion() || Math.abs(distance) < 2) {
        window.scrollTo(0, top);
        hasSnappedInView = true;
        return;
      }
      isSnapping = true;
      const phoneFrame = isPhoneFrame();
      const duration = phoneFrame ? 480 : isCompactFrame() ? 540 : 640;
      const startedAt = performance.now();
      const step = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = phoneFrame
          ? progress * progress * (3 - 2 * progress)
          : progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        window.scrollTo(0, start + distance * eased);
        if (progress < 1) {
          alignmentRaf = requestAnimationFrame(step);
          return;
        }
        alignmentRaf = 0;
        isSnapping = false;
        hasSnappedInView = true;
      };
      alignmentRaf = requestAnimationFrame(step);
    };

    const maybeSnap = (direction = lastScrollDirection) => {
      if (isSnapping || navigationBusy()) return;
      const ratio = getVisibleRatio();
      const snapThreshold = getSnapThreshold();
      const resetThreshold = getResetThreshold();
      if (ratio < resetThreshold) {
        hasSnappedInView = false;
        return;
      }
      if (isAligned()) {
        hasSnappedInView = true;
        return;
      }
      const distanceToAlignment = slot.getBoundingClientRect().top - getNavOffset();
      const maxSnapDistance = isPhoneFrame()
        ? Math.min(240, window.innerHeight * 0.26)
        : isCompactFrame()
          ? Math.min(300, window.innerHeight * 0.34)
          : Math.min(520, window.innerHeight * 0.3);
      if (Math.abs(distanceToAlignment) > maxSnapDistance) return;
      if (!direction || (direction > 0 && distanceToAlignment <= 0) || (direction < 0 && distanceToAlignment >= 0)) return;
      if (hasSnappedInView || ratio < snapThreshold) return;
      const now = performance.now();
      if (now - lastSnapAt < (isCompactFrame() ? 520 : 900)) return;
      hasSnappedInView = true;
      lastSnapAt = now;
      alignProjectPage();
      return true;
    };

    window.addEventListener("scroll", () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      if (Math.abs(delta) > 0.5) lastScrollDirection = delta > 0 ? 1 : -1;
      lastScrollY = currentScrollY;
      window.clearTimeout(scrollSettleTimer);
      if (navigationBusy()) {
        cancelAlignment();
        return;
      }
      if (isSnapping || touchActive) return;
      const settleDelay = isPhoneFrame() ? 220 : isCompactFrame() ? 150 : 180;
      scrollSettleTimer = window.setTimeout(() => maybeSnap(lastScrollDirection), settleDelay);
    }, { passive: true });

    window.addEventListener("wheel", (event) => {
      const impulse = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(impulse) > 0.5) lastScrollDirection = impulse > 0 ? 1 : -1;
      window.clearTimeout(scrollSettleTimer);
      cancelAlignment();
      if (navigationBusy() || isPhoneFrame()) {
        return;
      }
      const settleDelay = isCompactFrame() ? 150 : 180;
      scrollSettleTimer = window.setTimeout(() => maybeSnap(lastScrollDirection), settleDelay);
    }, { passive: true, capture: true });

    window.addEventListener("resize", () => {
      cancelAlignment();
      if (isPhoneFrame()) {
        window.clearTimeout(scrollSettleTimer);
        if (getVisibleRatio() < getResetThreshold()) hasSnappedInView = false;
        return;
      }
      hasSnappedInView = false;
      window.setTimeout(() => {
        if (slot.querySelector(".pg-project.is-work")) {
          hasSnappedInView = true;
          alignProjectPage();
          return;
        }
        lastScrollY = window.scrollY;
      }, 80);
    }, { passive: true });

    window.addEventListener("portfolio:project-open", () => {
      hasSnappedInView = true;
      if (navigationBusy() || isPhoneFrame()) return;
      requestAnimationFrame(() => alignProjectPage());
    });

    window.addEventListener("touchstart", () => {
      touchActive = true;
      window.clearTimeout(scrollSettleTimer);
      cancelAlignment();
    }, { passive: true });
    window.addEventListener("touchmove", cancelAlignment, { passive: true });
    const releaseTouch = () => {
      touchActive = false;
      window.clearTimeout(scrollSettleTimer);
      if (navigationBusy()) return;
      scrollSettleTimer = window.setTimeout(() => maybeSnap(lastScrollDirection), 240);
    };
    window.addEventListener("touchend", releaseTouch, { passive: true });
    window.addEventListener("touchcancel", releaseTouch, { passive: true });

    requestAnimationFrame(() => {
      lastScrollY = window.scrollY;
    });
  }

  setupHeroFrameVisibility();
  drawHeroFrame();
  if (siteExperienceActive) startGeneratedVideo();
  setupHeroTextStagger();
  setupIntroScroll();
  setupPanelGlow();
  setupHandoffVisual();
  setupHostRefreshGuards();
  setupStaticTimelineCardHeight();
  setupTimelineProfileTextReveal();
  setupContactPage();
  setupBottomReboundEffect();
  setupPortfolioNavLayer();
  setupPrimaryNavFeedback();
  setupPrimarySectionNav();
  setupContactNavLink();
  setupExternalNavigationGuard();
  setupProjectPageSnap();
  setupContactOpening();
  setupProjectPageSlot();
  window.addEventListener("load", refreshHostScroll);
  refreshHostScroll();

  window.addEventListener("site:revealed", () => {
    siteExperienceActive = true;
    heroFrameActive = true;
    drawHeroFrame();
    startGeneratedVideo();
  }, { once: true });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.add("pg-ready");
      root.dataset.pgReady = "true";
      window.dispatchEvent(new CustomEvent("portfolio:ready"));
    });
  });
})();

