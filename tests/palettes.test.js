import assert from "node:assert/strict";
import test from "node:test";
import { PALETTES } from "../site/js/palettes.js";
import { COVER_HEIGHT, COVER_WIDTH, geometry } from "../site/js/render.js";

function channel(hex, start) {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const red = channel(hex, 1);
  const green = channel(hex, 3);
  const blue = channel(hex, 5);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a, b) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

test("封面比例是 5:2，字号区域留在画布内", () => {
  assert.equal(COVER_WIDTH / COVER_HEIGHT, 2.5);
  assert.equal(COVER_WIDTH, 2400);
  assert.equal(COVER_HEIGHT, 960);
  const box = geometry(COVER_WIDTH, COVER_HEIGHT);
  assert.ok(box.maxWidth > 1400);
  assert.ok(box.maxHeight > 600);
  assert.ok(box.padX > box.barX + box.barW);
});

test("至少 5 套配色，标题和副标题对比度足够", () => {
  assert.ok(PALETTES.length >= 5);
  const ids = new Set(PALETTES.map((palette) => palette.id));
  assert.equal(ids.size, PALETTES.length);
  for (const palette of PALETTES) {
    assert.ok(palette.name.length >= 2);
    assert.ok(contrast(palette.title, palette.bg) >= 7, palette.name);
    assert.ok(contrast(palette.sub, palette.bg) >= 4.5, palette.name);
    assert.ok(["rings", "rules", "seal", "diamond"].includes(palette.mark));
  }
});
