const OriginalLenis = window.Lenis;

if (typeof OriginalLenis === "function" && !window.__portfolioLenisCaptureReady) {
  const CapturedLenis = new Proxy(OriginalLenis, {
    construct(Target, args, NewTarget) {
      const instance = Reflect.construct(
        Target,
        args,
        NewTarget === CapturedLenis ? Target : NewTarget
      );
      window.__portfolioLenis = instance;
      return instance;
    },
  });

  window.Lenis = CapturedLenis;
  window.__portfolioLenisCaptureReady = true;
}
