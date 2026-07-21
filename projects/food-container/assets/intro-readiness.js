(() => {
  const BUTTON_SELECTOR = ".aethera-hero__cta";
  const READY_LABEL = "了解更多";
  const LOADING_LABEL = "LOADING";
  const PROJECT_HERO_SRC = "./assets/daily-lunch-screen-hero.webp";
  const SAFETY_TIMEOUT_MS = 8000;
  const MINIMUM_LOADING_MS = 650;
  const FONT_TIMEOUT_MS = 2200;
  const VIDEO_TIMEOUT_MS = 5000;

  let isReady = false;
  let activeButton = null;
  let safetyTimer = 0;

  const wait = (duration) =>
    new Promise((resolve) => window.setTimeout(resolve, duration));

  const withTimeout = (promise, duration) =>
    Promise.race([promise.catch(() => undefined), wait(duration)]);

  const preloadProjectHero = () =>
    new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = resolve;
      image.onerror = resolve;
      image.src = PROJECT_HERO_SRC;

      if (image.complete) resolve();
    });

  const waitForFonts = () => {
    if (!document.fonts?.ready) return Promise.resolve();
    return document.fonts.ready;
  };

  const waitForIntroVideo = () =>
    new Promise((resolve) => {
      let settled = false;
      let videoObserver;

      const finish = () => {
        if (settled) return;
        settled = true;
        videoObserver?.disconnect();
        resolve();
      };

      const bindVideo = () => {
        const video = document.querySelector(".aethera-hero__media video");
        if (!video) return false;

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          finish();
          return true;
        }

        video.addEventListener("loadeddata", finish, { once: true });
        video.addEventListener("canplay", finish, { once: true });
        video.addEventListener("error", finish, { once: true });
        return true;
      };

      if (bindVideo()) return;

      videoObserver = new MutationObserver(() => {
        if (bindVideo()) videoObserver.disconnect();
      });
      videoObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });

  const setLoadingState = (button) => {
    if (!button || isReady) return;

    activeButton = button;
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("aria-busy", "true");
    button.classList.add("is-loading");
    button.textContent = LOADING_LABEL;
  };

  const setReadyState = () => {
    if (isReady) return;
    isReady = true;
    window.clearTimeout(safetyTimer);

    const button = activeButton || document.querySelector(BUTTON_SELECTOR);
    if (!button) return;
    buttonObserver.disconnect();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const reveal = () => {
      button.textContent = READY_LABEL;
      button.disabled = false;
      button.removeAttribute("aria-disabled");
      button.removeAttribute("aria-busy");
      button.classList.remove("is-loading", "is-resolving");
      button.classList.add("is-ready");
      window.setTimeout(() => button.classList.remove("is-ready"), 360);
    };

    if (reducedMotion) {
      reveal();
      return;
    }

    button.classList.add("is-resolving");
    window.setTimeout(reveal, 140);
  };

  const syncButton = () => {
    const button = document.querySelector(BUTTON_SELECTOR);
    if (!button || button === activeButton) return;

    if (isReady) {
      activeButton = button;
      button.textContent = READY_LABEL;
      button.disabled = false;
      button.removeAttribute("aria-disabled");
      button.removeAttribute("aria-busy");
      button.classList.remove("is-loading", "is-resolving");
      buttonObserver.disconnect();
      return;
    }

    setLoadingState(button);
  };

  document.addEventListener(
    "click",
    (event) => {
      if (isReady || !event.target.closest?.(BUTTON_SELECTOR)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  const buttonObserver = new MutationObserver(syncButton);
  buttonObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  syncButton();

  safetyTimer = window.setTimeout(setReadyState, SAFETY_TIMEOUT_MS);

  Promise.all([
    wait(MINIMUM_LOADING_MS),
    preloadProjectHero(),
    withTimeout(waitForFonts(), FONT_TIMEOUT_MS),
    withTimeout(waitForIntroVideo(), VIDEO_TIMEOUT_MS),
  ]).then(setReadyState);
})();
