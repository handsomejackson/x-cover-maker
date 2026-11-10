import { layoutLines, lineText, measureLine, positionLine } from "./typography.js";

export const COVER_WIDTH = 2400;
export const COVER_HEIGHT = 960;

const TITLE_LH = 1.36;
const SUB_LH = 1.5;

let grainCanvas = null;

function grain() {
  if (grainCanvas) return grainCanvas;
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.createImageData(size, size);
  let seed = 20260321;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed & 255;
      const index = (y * size + x) * 4;
      const on = noise > 172;
      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = on ? (noise % 48) + 18 : 0;
    }
  }
  ctx.putImageData(image, 0, 0);
  grainCanvas = canvas;
  return grainCanvas;
}

export function geometry(width, height) {
  const inset = Math.round(width * 0.028);
  const barX = inset + Math.round(width * 0.02);
  const barW = Math.max(10, Math.round(width * 0.0055));
  const padX = barX + barW + Math.round(width * 0.028);
  const padRight = Math.round(width * 0.132);
  const padY = Math.round(height * 0.1);
  return {
    inset,
    barX,
    barW,
    padX,
    padRight,
    padY,
    maxWidth: width - padX - padRight,
    maxHeight: height - padY * 2,
  };
}

function fontString(size, role) {
  if (role === "serif") {
    return `700 ${size}px "Cover Serif", "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", serif`;
  }
  return `400 ${size}px "Cover Sans", "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;
}

function measureAtom(ctx, atom, size, role) {
  ctx.font = fontString(size, role);
  return ctx.measureText(atom.text).width;
}

function layoutRole(ctx, text, size, role, maxWidth) {
  if (!text) return [];
  const cache = new Map();
  const measure = (atom) => {
    const key = atom.text;
    if (cache.has(key)) return cache.get(key);
    const width = measureAtom(ctx, atom, size, role);
    cache.set(key, width);
    return width;
  };
  return layoutLines(text, maxWidth, measure, size);
}

function lineAdvance(lines, size, lh) {
  return lines.length * size * lh;
}

export function blockMetrics(titleLines, titleSize, subLines, subSize) {
  const basis = titleSize || subSize || 0;
  const dashH = basis ? Math.max(6, Math.round(basis * 0.055)) : 0;
  const dashGap = basis ? basis * 0.38 : 0;
  const titleH = lineAdvance(titleLines, titleSize, TITLE_LH);
  const mid = titleLines.length && subLines.length ? titleSize * 0.34 : 0;
  const subH = lineAdvance(subLines, subSize, SUB_LH);
  return {
    dashH,
    dashGap,
    titleH,
    mid,
    subH,
    height: dashH + dashGap + titleH + mid + subH,
  };
}

function attemptFits(lines, size) {
  const limit = size * 0.22;
  return lines.every((line) => line.length <= 1 || (line.tighten || 0) <= limit + 0.5);
}

function makeMeasure(ctx, size, role) {
  const cache = new Map();
  return (atom) => {
    const key = atom.text;
    if (cache.has(key)) return cache.get(key);
    const width = measureAtom(ctx, atom, size, role);
    cache.set(key, width);
    return width;
  };
}

function evaluate(ctx, title, subtitle, titleSize, maxWidth, maxHeight) {
  const subSize = subtitle ? Math.max(1, Math.round(titleSize * 0.34)) : 0;
  const titleLines = layoutRole(ctx, title, titleSize, "serif", maxWidth);
  const subLines = subtitle ? layoutRole(ctx, subtitle, subSize, "sans", maxWidth) : [];
  const metrics = blockMetrics(titleLines, titleSize, subLines, subSize);
  const titleMeasure = makeMeasure(ctx, titleSize, "serif");
  const subMeasure = makeMeasure(ctx, subSize || titleSize, "sans");
  const heightOk = metrics.height <= maxHeight + 0.5;
  const widthOk = attemptFits(titleLines, titleSize)
    && attemptFits(subLines, subSize || titleSize);
  const overflow = [...titleLines, ...subLines].some((line) => {
    const measure = titleLines.includes(line) ? titleMeasure : subMeasure;
    const em = titleLines.includes(line) ? titleSize : subSize;
    if (line.length <= 1) return measureLine(line, measure, em) > maxWidth + 0.5;
    return false;
  });
  return {
    titleSize,
    subSize,
    titleLines,
    subLines,
    metrics,
    ok: heightOk && widthOk && !overflow,
    heightOk: heightOk && !overflow,
  };
}

function evaluateSubOnly(ctx, subtitle, subSize, maxWidth, maxHeight) {
  const subLines = layoutRole(ctx, subtitle, subSize, "sans", maxWidth);
  const metrics = blockMetrics([], 0, subLines, subSize);
  const measure = makeMeasure(ctx, subSize, "sans");
  const overflow = subLines.some((line) => line.length <= 1 && measureLine(line, measure, subSize) > maxWidth + 0.5);
  const heightOk = metrics.height <= maxHeight + 0.5 && !overflow;
  const quality = attemptFits(subLines, subSize);
  return {
    titleSize: 0,
    subSize,
    titleLines: [],
    subLines,
    metrics,
    ok: heightOk && quality,
    heightOk,
  };
}

function searchSize(lo, hi, predicate) {
  let best = null;
  let low = lo;
  let high = hi;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (predicate(mid)) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function fitText(ctx, title, subtitle, geo, width) {
  const { maxWidth, maxHeight } = geo;
  if (!title && !subtitle) {
    return {
      titleSize: 0,
      subSize: 0,
      titleLines: [],
      subLines: [],
      metrics: blockMetrics([], 0, [], 0),
    };
  }

  if (!title) {
    const maxSub = Math.round(width * 0.034);
    const quality = searchSize(8, maxSub, (size) => evaluateSubOnly(ctx, subtitle, size, maxWidth, maxHeight).ok);
    const chosen = quality || searchSize(4, maxSub, (size) => evaluateSubOnly(ctx, subtitle, size, maxWidth, maxHeight).heightOk) || 4;
    return evaluateSubOnly(ctx, subtitle, chosen, maxWidth, maxHeight);
  }

  const maxTitle = Math.round(width * 0.072);
  const quality = searchSize(8, maxTitle, (size) => evaluate(ctx, title, subtitle, size, maxWidth, maxHeight).ok);
  const chosen = quality || searchSize(4, maxTitle, (size) => evaluate(ctx, title, subtitle, size, maxWidth, maxHeight).heightOk) || 4;
  return evaluate(ctx, title, subtitle, chosen, maxWidth, maxHeight);
}

function paintBackground(ctx, width, height, palette) {
  const wash = ctx.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, palette.bg);
  wash.addColorStop(1, palette.bgAlt);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.84, height * 0.58, width * 0.02, width * 0.8, height * 0.55, width * 0.36);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(width * 0.42, height * 0.48, height * 0.15, width * 0.5, height * 0.5, width * 0.62);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, palette.light ? "rgba(70,52,32,0.07)" : "rgba(0,0,0,0.30)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = palette.light ? "multiply" : "screen";
  ctx.globalAlpha = palette.light ? 0.32 : 0.38;
  const pattern = ctx.createPattern(grain(), "repeat");
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function drawFrame(ctx, width, height, palette, geo) {
  ctx.save();
  ctx.strokeStyle = palette.frame;
  ctx.lineWidth = Math.max(3, Math.round(width * 0.0016));
  ctx.strokeRect(geo.inset, geo.inset, width - geo.inset * 2, height - geo.inset * 2);
  ctx.fillStyle = palette.accent;
  const barH = height - geo.inset * 2 - Math.round(height * 0.08);
  const barY = geo.inset + Math.round(height * 0.04);
  ctx.fillRect(geo.barX, barY, geo.barW, barH);
  ctx.restore();
}

function drawOrnament(ctx, width, height, palette, geo) {
  const colLeft = width - geo.padRight + Math.round(width * 0.02);
  const colWidth = geo.padRight - Math.round(width * 0.045);
  const cx = colLeft + colWidth * 0.48;
  const cy = height * 0.7;
  ctx.save();
  ctx.strokeStyle = palette.ornament;
  ctx.fillStyle = palette.ornament;
  ctx.lineWidth = Math.max(3, Math.round(width * 0.0015));
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";

  if (palette.mark === "rings") {
    const radius = Math.min(colWidth * 0.34, height * 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
    ctx.stroke();
  } else if (palette.mark === "rules") {
    const right = colLeft + colWidth * 0.9;
    let y = cy - height * 0.02;
    const thick = Math.max(5, Math.round(height * 0.008));
    const gap = Math.round(height * 0.022);
    [0.78, 0.52, 0.3].forEach((fraction) => {
      const ruleW = colWidth * fraction;
      ctx.fillRect(right - ruleW, y, ruleW, thick);
      y += thick + gap;
    });
  } else if (palette.mark === "seal") {
    const side = Math.min(colWidth * 0.62, height * 0.22);
    const x = cx - side / 2;
    const y = cy - side / 2;
    ctx.lineWidth = Math.max(4, Math.round(width * 0.0018));
    ctx.strokeRect(x, y, side, side);
    const margin = side * 0.16;
    ctx.strokeRect(x + margin, y + margin, side - margin * 2, side - margin * 2);
  } else {
    const radius = Math.min(colWidth * 0.28, height * 0.13);
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius);
    ctx.lineTo(cx - radius, cy);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawLines(ctx, lines, size, role, color, originX, top, lh) {
  if (!lines.length || !size) return;
  const measure = makeMeasure(ctx, size, role);
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = fontString(size, role);
  const sample = ctx.measureText("国Ag");
  const ascent = sample.actualBoundingBoxAscent || size * 0.8;
  lines.forEach((line, index) => {
    const baseline = Math.round(top + index * size * lh + ascent);
    const positioned = positionLine(line, measure, size);
    positioned.forEach((item) => {
      ctx.font = fontString(size, role);
      ctx.fillText(item.text, originX + item.x, baseline);
    });
  });
  ctx.restore();
}

export function renderCover(ctx, width, height, state) {
  const palette = state.palette;
  const title = (state.title || "").trim();
  const subtitle = (state.subtitle || "").trim();
  const geo = geometry(width, height);
  const showGuides = Boolean(state.debug);

  ctx.clearRect(0, 0, width, height);
  paintBackground(ctx, width, height, palette);
  drawFrame(ctx, width, height, palette, geo);
  drawOrnament(ctx, width, height, palette, geo);

  const fitted = fitText(ctx, title, subtitle, geo, width);
  const { metrics } = fitted;

  if (title || subtitle) {
    let y = (height - metrics.height) / 2 - height * 0.012;
    y = Math.max(geo.padY, Math.min(y, height - geo.padY - metrics.height));

    ctx.fillStyle = palette.accent;
    const dashW = Math.round(Math.min(geo.maxWidth * 0.11, Math.max(fitted.titleSize, fitted.subSize) * 1.35));
    ctx.fillRect(geo.padX, Math.round(y), dashW, metrics.dashH);
    y += metrics.dashH + metrics.dashGap;

    if (fitted.titleLines.length) {
      drawLines(ctx, fitted.titleLines, fitted.titleSize, "serif", palette.title, geo.padX, y, TITLE_LH);
      y += metrics.titleH + metrics.mid;
    }
    if (fitted.subLines.length) {
      drawLines(ctx, fitted.subLines, fitted.subSize, "sans", palette.sub, geo.padX, y, SUB_LH);
    }
  }

  if (showGuides) {
    ctx.save();
    ctx.strokeStyle = "rgba(220,40,40,0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(geo.padX, geo.padY, geo.maxWidth, geo.maxHeight);
    ctx.restore();
  }

  const tightens = [...fitted.titleLines, ...fitted.subLines].map((line) => line.tighten || 0);
  return {
    width,
    height,
    titleSize: fitted.titleSize,
    subSize: fitted.subSize,
    titleLines: fitted.titleLines.map(lineText),
    subLines: fitted.subLines.map(lineText),
    maxTighten: tightens.length ? Math.max(...tightens) : 0,
  };
}
