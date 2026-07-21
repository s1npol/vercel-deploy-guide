(() => {
  const BUTTON_SELECTOR = ".aethera-hero__cta";
  const STYLE_SELECTOR = "[data-project-styles]";
  const MODULE_ATTRIBUTE = "data-project-module";
  const READY_LABEL = "了解更多";
  const LOADING_LABEL = "LOADING";
  const PROJECT_HERO_SRC = "./assets/daily-lunch-screen-hero.webp";
  const PROJECT_ENTRY_KEY = "aethera-project-entered";
  const SAFETY_TIMEOUT_MS = 12000;
  const MINIMUM_LOADING_MS = 650;
  const FONT_TIMEOUT_MS = 2200;
  const VIDEO_TIMEOUT_MS = 11000;
  const STYLE_TIMEOUT_MS = 4500;

  let readinessResolved = false;
  let isReady = false;
  let activeButton = null;
  let safetyTimer = 0;

  const wait = (duration) =>
    new Promise((resolve) => window.setTimeout(resolve, duration));

  const withTimeout = (promise, duration) =>
    Promise.race([promise.catch(() => undefined), wait(duration)]);

  const isReturningToProject = (() => {
    try {
      return window.sessionStorage.getItem(PROJECT_ENTRY_KEY) === "true";
    } catch {
      return false;
    }
  })();

  const prepareProjectStyles = () =>
    new Promise((resolve) => {
      const stylesheet = document.querySelector(STYLE_SELECTOR);
      if (!stylesheet) {
        resolve();
        return;
      }

      let settled = false;
      const finish = (status) => {
        if (settled) return;
        settled = true;
        stylesheet.media = "all";
        stylesheet.dataset.projectStyleStatus = status;
        window.requestAnimationFrame(() => {
          document.documentElement.classList.add("project-styles-ready");
          resolve();
        });
      };

      stylesheet.addEventListener("load", () => finish("ready"), { once: true });
      stylesheet.addEventListener("error", () => finish("fallback"), { once: true });

      if (stylesheet.sheet) {
        finish("ready");
        return;
      }

      window.setTimeout(() => finish("timeout"), STYLE_TIMEOUT_MS);
    });

  const launchProjectApp = async () => {
    await prepareProjectStyles();

    const currentScript = document.currentScript ||
      document.querySelector(`script[${MODULE_ATTRIBUTE}]`);
    const moduleSource = currentScript?.getAttribute(MODULE_ATTRIBUTE);
    if (!moduleSource || document.querySelector("script[data-project-app-module]")) {
      return;
    }

    const module = document.createElement("script");
    module.type = "module";
    module.crossOrigin = "anonymous";
    module.src = moduleSource;
    module.dataset.projectAppModule = "true";
    document.head.appendChild(module);
  };

  const appLaunchPromise = launchProjectApp();

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
      let boundVideo = null;
      let timeout = 0;

      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        videoObserver?.disconnect();
        if (boundVideo) {
          boundVideo.removeEventListener("loadeddata", finish);
          boundVideo.removeEventListener("canplay", finish);
          boundVideo.removeEventListener("error", finish);
        }
        resolve();
      };

      const bindVideo = () => {
        const video = document.querySelector(".aethera-hero__media video");
        if (!video || video === boundVideo) return false;
        boundVideo = video;
        video.preload = "auto";

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          finish();
          return true;
        }

        video.addEventListener("loadeddata", finish, { once: true });
        video.addEventListener("canplay", finish, { once: true });
        video.addEventListener("error", finish, { once: true });
        return true;
      };

      if (!bindVideo()) {
        videoObserver = new MutationObserver(bindVideo);
        videoObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      }

      timeout = window.setTimeout(finish, VIDEO_TIMEOUT_MS);
    });

  const isAppButton = (button) =>
    Boolean(button && !button.closest(".project-intro-shell"));

  const setLoadingState = (button) => {
    if (!button || isReady) return;

    activeButton = button;
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("aria-busy", "true");
    button.classList.add("is-loading");
    button.textContent = LOADING_LABEL;
  };

  const revealReadyButton = (button) => {
    isReady = true;
    activeButton = button;
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

  const setReadyState = () => {
    readinessResolved = true;
    window.clearTimeout(safetyTimer);

    const button = document.querySelector(BUTTON_SELECTOR);
    if (!isAppButton(button)) return;
    revealReadyButton(button);
  };

  const syncButton = () => {
    const button = document.querySelector(BUTTON_SELECTOR);
    if (!button || button === activeButton) return;

    if (readinessResolved && isAppButton(button)) {
      revealReadyButton(button);
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

  const readinessTasks = [
    appLaunchPromise,
    wait(MINIMUM_LOADING_MS),
    preloadProjectHero(),
    appLaunchPromise.then(() => withTimeout(waitForFonts(), FONT_TIMEOUT_MS)),
  ];

  if (!isReturningToProject) {
    readinessTasks.push(appLaunchPromise.then(waitForIntroVideo));
  }

  Promise.all(readinessTasks).then(setReadyState);
})();
