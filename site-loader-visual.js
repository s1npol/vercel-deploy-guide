(() => {
  const loader = document.getElementById("siteLoader");
  const canvas = document.getElementById("siteLoaderVisual");
  if (!loader || !canvas || !canvas.getContext) return;

  const context = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
  });
  if (!context) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const maxDpr = 1.3;
  const minDpr = 0.75;
  const pixelBudget = 3200000;
  const frameInterval = 1000 / 30;
  const tau = Math.PI * 2;
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const smoothstep = (minimum, maximum, value) => {
    const amount = clamp((value - minimum) / Math.max(0.0001, maximum - minimum), 0, 1);
    return amount * amount * (3 - 2 * amount);
  };
  const wrap01 = (value) => ((value % 1) + 1) % 1;
  const wrappedDistance = (first, second) => {
    const distance = Math.abs(first - second);
    return Math.min(distance, 1 - distance);
  };

  let width = 1;
  let height = 1;
  let dpr = 1;
  let raf = 0;
  let lastFrame = 0;
  let stopped = false;
  let readyFrames = 0;
  let exitStartedAt = 0;
  let motionTime = 0;
  let previousDrawTimestamp = 0;
  let field = { x: 0, y: 0, width: 1, height: 1 };
  let segments = [];

  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = 160;
  noiseCanvas.height = 160;
  const noiseContext = noiseCanvas.getContext("2d");
  const noiseImage = noiseContext.createImageData(noiseCanvas.width, noiseCanvas.height);
  for (let index = 0; index < noiseImage.data.length; index += 4) {
    const value = 12 + Math.floor(Math.random() * 28);
    noiseImage.data[index] = value;
    noiseImage.data[index + 1] = value + 4;
    noiseImage.data[index + 2] = value + 13;
    noiseImage.data[index + 3] = 18;
  }
  noiseContext.putImageData(noiseImage, 0, 0);

  function seededValue(row, column) {
    const hash = Math.sin((row + 1) * 91.17 + (column + 1) * 47.31) * 43758.5453;
    return hash - Math.floor(hash);
  }

  function buildSegments() {
    const compact = width < 700;
    const rows = clamp(Math.round(field.height / (compact ? 12 : 10)), compact ? 28 : 42, compact ? 34 : 48);
    const columns = clamp(Math.round(field.width / (compact ? 9 : 14)), compact ? 58 : 78, compact ? 84 : 98);
    const xStep = field.width / Math.max(1, columns - 1);
    const yStep = field.height / Math.max(1, rows - 1);
    const next = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const seed = seededValue(row, column);
        next.push({
          row,
          column,
          seed,
          baseX: field.x + column * xStep,
          baseY: field.y + row * yStep,
          length: clamp(xStep * (0.58 + seed * 0.42), 7, compact ? 13 : 17),
          opacitySeed: seededValue(row + 79, column + 131),
          phaseSeed: seededValue(row + 211, column + 47),
          normalizedX: column / Math.max(1, columns - 1),
          normalizedY: row / Math.max(1, rows - 1),
        });
      }
    }

    segments = next;
  }

  function resize() {
    const rect = loader.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    const budgetDpr = Math.sqrt(pixelBudget / Math.max(1, width * height));
    dpr = clamp(Math.min(window.devicePixelRatio || 1, maxDpr, budgetDpr), minDpr, maxDpr);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const compact = width < 700;
    field = compact
      ? { x: width * 0.055, y: height * 0.305, width: width * 0.89, height: height * 0.39 }
      : { x: width * 0.04, y: height * 0.292, width: width * 0.92, height: height * 0.432 };
    buildSegments();
  }

  function flowOffset(normalizedX, normalizedY, time, exitProgress, phaseSeed = 0.5) {
    const vertical = normalizedY - 0.5;
    const slowTime = time * 0.18;
    const warpedX = normalizedX +
      Math.sin(vertical * 5.7 + slowTime * 0.31) * 0.021 +
      Math.sin(normalizedX * tau * 0.47 - slowTime * 0.42) * 0.012;
    const throatX = 0.52 + Math.sin(time * 0.083) * 0.032;
    const crestX = 0.76 + Math.sin(time * 0.061 + 1.1) * 0.044;
    const throat = Math.exp(-Math.pow((warpedX - throatX) / 0.16, 2));
    const crest = Math.exp(-Math.pow((warpedX - crestX) / 0.2, 2));
    const entry = Math.exp(-Math.pow((warpedX - 0.23) / 0.27, 2));
    const eddyA = Math.exp(-Math.pow((warpedX - 0.34) / 0.13, 2));
    const eddyB = Math.exp(-Math.pow((warpedX - 0.64) / 0.11, 2));
    const eddyC = Math.exp(-Math.pow((warpedX - 0.86) / 0.12, 2));

    // Layered currents and local eddies keep neighboring streamlines
    // continuous while giving the field an asymmetric, organic silhouette.
    const centerline =
      Math.sin(warpedX * tau * 0.72 - slowTime * 0.92 - 0.34) * field.height * 0.058 +
      Math.sin(warpedX * tau * 1.37 + slowTime * 0.41 + 1.16) * field.height * 0.028 +
      Math.sin(warpedX * tau * 2.08 - slowTime * 0.24 + 2.2) * field.height * 0.012 +
      (crest * 0.72 - throat * 0.28) * field.height * 0.035;
    const compression =
      vertical *
      field.height *
      (-0.12 * throat + 0.045 * crest + 0.025 * entry + Math.sin(warpedX * 8.4 - slowTime) * 0.018);
    const ribbonShear =
      vertical *
      Math.sin(warpedX * tau * 0.93 - slowTime * 0.56 + vertical * 0.72) *
      field.height *
      0.088 *
      (0.36 + Math.sin(normalizedX * Math.PI) * 0.64);
    const localEddies =
      (Math.sin(vertical * 5.1 + slowTime * 0.74) * eddyA * 0.021 +
        Math.sin(vertical * 7.3 - slowTime * 0.52 + 1.2) * eddyB * 0.028 +
        Math.sin(vertical * 4.6 + slowTime * 0.41 + 2.4) * eddyC * 0.018) *
      field.height;
    const layeredDrift =
      Math.sin(warpedX * tau * 1.16 - slowTime * 0.7 + vertical * 1.9) *
      field.height *
      (0.009 + Math.abs(vertical) * 0.013);
    const microFlow =
      Math.sin(warpedX * tau * 2.58 + slowTime * 0.34 + phaseSeed * 1.2) *
      field.height *
      0.003;
    const motionScale = 1 - exitProgress * 0.84;
    return (centerline + compression + ribbonShear + localEddies + layeredDrift + microFlow) * motionScale;
  }

  function drawBackground() {
    context.fillStyle = "#020713";
    context.fillRect(0, 0, width, height);

    const glow = context.createRadialGradient(
      width * 0.7,
      height * 0.5,
      0,
      width * 0.7,
      height * 0.5,
      Math.max(width, height) * 0.58,
    );
    glow.addColorStop(0, "rgba(7, 24, 69, 0.3)");
    glow.addColorStop(0.48, "rgba(3, 12, 31, 0.11)");
    glow.addColorStop(1, "rgba(1, 4, 11, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  }

  function drawGrid() {
    context.save();
    context.lineWidth = 1;
    context.strokeStyle = "rgba(137, 153, 181, 0.065)";
    context.beginPath();

    const xStep = width / 9;
    const yStep = height / 5;
    for (let x = xStep; x < width; x += xStep) {
      context.moveTo(Math.round(x) + 0.5, 0);
      context.lineTo(Math.round(x) + 0.5, height);
    }
    for (let y = yStep; y < height; y += yStep) {
      context.moveTo(0, Math.round(y) + 0.5);
      context.lineTo(width, Math.round(y) + 0.5);
    }
    context.stroke();
    context.restore();
  }

  function drawField(time, exitProgress) {
    const progress = clamp(Number.parseFloat(loader.dataset.progress || "0") / 100, 0, 1);
    const sweepProgress = progress < 0.96
      ? Math.pow(progress / 0.96, 1.35) * 0.72
      : 0.72 + smoothstep(0.96, 1, progress) * 0.28;
    const blueFront = 1.08 - sweepProgress * 1.18;
    const focusNormalizedX = clamp(blueFront, 0.04, 0.96);
    const focusX = field.x + field.width * focusNormalizedX;
    const focusY = field.y + field.height * (0.48 + Math.sin(time * 0.11) * 0.012);
    const streamSpeed = width < 700 ? 0.017 : 0.021;
    const travelingCrestX = wrap01(0.94 - time * 0.037);

    context.save();
    context.beginPath();
    context.rect(field.x, field.y, field.width, field.height);
    context.clip();

    context.fillStyle = "rgba(1, 5, 14, 0.62)";
    context.fillRect(field.x, field.y, field.width, field.height);

    const blueGlow = context.createRadialGradient(
      focusX,
      focusY,
      0,
      focusX,
      focusY,
      field.width * 0.22,
    );
    blueGlow.addColorStop(0, `rgba(35, 82, 255, ${0.2 * (1 - exitProgress * 0.5)})`);
    blueGlow.addColorStop(0.34, `rgba(18, 55, 204, ${0.095 * (1 - exitProgress * 0.5)})`);
    blueGlow.addColorStop(1, "rgba(5, 19, 72, 0)");
    context.fillStyle = blueGlow;
    context.fillRect(field.x, field.y, field.width, field.height);

    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const tangentDelta = 0.0045;

    for (const segment of segments) {
      const { normalizedX, normalizedY, seed, opacitySeed, phaseSeed } = segment;
      const rowSpeed = streamSpeed * (0.965 + Math.sin(normalizedY * tau + 0.7) * 0.035);
      const flowX = wrap01(normalizedX - time * rowSpeed);
      const edgeFlowFade =
        smoothstep(0, 0.045, flowX) *
        (1 - smoothstep(0.955, 1, flowX));
      const edgeVisibility = (0.66 + Math.sin(normalizedY * Math.PI) * 0.32) * edgeFlowFade;
      if (opacitySeed > edgeVisibility) continue;

      const yOffset = flowOffset(flowX, normalizedY, time, exitProgress, phaseSeed);
      const nextOffset = flowOffset(
        Math.min(1, flowX + tangentDelta),
        normalizedY,
        time,
        exitProgress,
        phaseSeed,
      );
      const tangentAngle = clamp(
        Math.atan2(nextOffset - yOffset, field.width * tangentDelta),
        -0.58,
        0.58,
      );
      const x = field.x + flowX * field.width;
      const y = segment.baseY + yOffset;
      const transition = smoothstep(blueFront - 0.075, blueFront + 0.075, flowX);
      const scanBand = Math.exp(-Math.pow((flowX - blueFront) / 0.072, 2));
      const crestDistance = wrappedDistance(flowX, travelingCrestX);
      const crestBand = Math.exp(-Math.pow(crestDistance / 0.095, 2));
      const centerBand = Math.exp(-Math.pow((normalizedY - 0.5) / 0.34, 2));
      const wavePulse = 0.62 + Math.sin(flowX * tau * 1.15 - time * 0.7 + normalizedY * 1.4) * 0.38;
      const highlight = Math.max(scanBand * 0.86, crestBand * centerBand * wavePulse) * edgeFlowFade;

      let bucket = 0;
      if (transition > 0.72) bucket = 3;
      else if (transition > 0.28) bucket = 2;
      else if (seed > 0.42) bucket = 1;
      if (highlight > 0.48 && seed > 0.28) bucket = 4;
      if (highlight > 0.76 && seed > 0.48 && centerBand > 0.35) bucket = 5;

      const length = segment.length * (0.92 + highlight * 0.16) * (1 - exitProgress * 0.08);
      paths[bucket].moveTo(x, y);
      paths[bucket].lineTo(
        x + Math.cos(tangentAngle) * length,
        y + Math.sin(tangentAngle) * length,
      );
    }

    const strokes = [
      { color: "rgba(118, 124, 137, 0.16)", blur: 0 },
      { color: "rgba(168, 170, 177, 0.3)", blur: 0 },
      { color: "rgba(203, 211, 228, 0.54)", blur: 0 },
      { color: "rgba(24, 68, 232, 0.42)", blur: 1 },
      { color: "rgba(50, 103, 255, 0.76)", blur: 4 },
      { color: "rgba(180, 207, 255, 0.96)", blur: 7 },
    ];

    context.lineWidth = width < 700 ? 0.75 : 0.9;
    context.lineCap = "round";
    strokes.forEach(({ color, blur }, index) => {
      context.strokeStyle = color;
      context.shadowColor = index > 2 ? "rgba(38, 82, 255, 0.62)" : "transparent";
      context.shadowBlur = blur;
      context.stroke(paths[index]);
    });

    context.restore();
  }

  function drawFrame(exitProgress) {
    context.save();
    context.globalAlpha = 1 - exitProgress * 0.72;
    context.lineWidth = 1;
    context.strokeStyle = "rgba(181, 190, 207, 0.3)";
    context.strokeRect(
      Math.round(field.x) + 0.5,
      Math.round(field.y) + 0.5,
      Math.round(field.width) - 1,
      Math.round(field.height) - 1,
    );

    context.strokeStyle = "rgba(189, 197, 211, 0.32)";
    context.beginPath();
    const tick = Math.max(5, Math.min(11, width * 0.006));
    const horizontalSteps = 14;
    const verticalSteps = 4;
    for (let index = 0; index <= horizontalSteps; index += 1) {
      const x = field.x + (field.width * index) / horizontalSteps;
      context.moveTo(x, field.y - tick);
      context.lineTo(x, field.y + tick);
      context.moveTo(x, field.y + field.height - tick);
      context.lineTo(x, field.y + field.height + tick);
    }
    for (let index = 0; index <= verticalSteps; index += 1) {
      const y = field.y + (field.height * index) / verticalSteps;
      context.moveTo(field.x - tick, y);
      context.lineTo(field.x + tick, y);
      context.moveTo(field.x + field.width - tick, y);
      context.lineTo(field.x + field.width + tick, y);
    }
    context.stroke();

    const crosses = [
      [width * 0.04, height * 0.06],
      [width * 0.96, height * 0.06],
      [width * 0.04, height * 0.94],
      [width * 0.96, height * 0.94],
      [width * 0.285, height * 0.235],
      [width * 0.715, height * 0.235],
      [width * 0.285, height * 0.765],
      [width * 0.715, height * 0.765],
    ];
    const crossSize = Math.max(4, Math.min(7, width * 0.004));
    context.beginPath();
    crosses.forEach(([x, y]) => {
      context.moveTo(x - crossSize, y);
      context.lineTo(x + crossSize, y);
      context.moveTo(x, y - crossSize);
      context.lineTo(x, y + crossSize);
    });
    context.stroke();
    context.restore();
  }

  function drawNoise() {
    const pattern = context.createPattern(noiseCanvas, "repeat");
    if (!pattern) return;
    context.save();
    context.globalAlpha = 0.065;
    context.globalCompositeOperation = "screen";
    context.fillStyle = pattern;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  function draw(timestamp = 0) {
    const elapsed = exitStartedAt ? timestamp - exitStartedAt : 0;
    const exitProgress = exitStartedAt ? smoothstep(0, 1450, elapsed) : 0;
    const frameDelta = previousDrawTimestamp
      ? clamp(timestamp - previousDrawTimestamp, 0, 80)
      : 0;
    previousDrawTimestamp = timestamp;
    motionTime += frameDelta * 0.001 * (1 - exitProgress * 0.78);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    drawGrid();
    drawField(motionTime, exitProgress);
    drawFrame(exitProgress);
    drawNoise();

    if (readyFrames < 2) {
      readyFrames += 1;
      if (readyFrames === 2) {
        canvas.dataset.visualReady = "true";
        loader.dataset.visualStatus = "ready";
        window.__siteLoaderVisualReady = true;
        window.dispatchEvent(new CustomEvent("site-loader:visual-ready"));
      }
    }
  }

  function tick(timestamp) {
    if (stopped) return;
    if (timestamp - lastFrame >= frameInterval) {
      lastFrame = timestamp;
      draw(timestamp);
    }
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    resizeObserver?.disconnect();
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", handleVisibility);
  }

  function beginExit() {
    if (exitStartedAt) return;
    exitStartedAt = performance.now();
    loader.dataset.visualStatus = "frozen";
    draw(exitStartedAt);
    stop();
  }

  function handleVisibility() {
    cancelAnimationFrame(raf);
    if (!document.hidden && !stopped && !reduceMotion) raf = requestAnimationFrame(tick);
  }

  const resizeObserver = "ResizeObserver" in window
    ? new ResizeObserver(() => {
        resize();
        draw(performance.now());
      })
    : null;

  resize();
  draw(performance.now());
  resizeObserver?.observe(loader);
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("site:before-reveal", beginExit, { once: true });

  if (!reduceMotion) raf = requestAnimationFrame(tick);
})();
