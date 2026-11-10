import { PALETTES } from "./palettes.js";
import { COVER_HEIGHT, COVER_WIDTH, renderCover } from "./render.js";

const canvas = document.querySelector("#cover");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
const titleEl = document.querySelector("#title");
const subtitleEl = document.querySelector("#subtitle");
const paletteGroup = document.querySelector("#palettes");
const downloadBtn = document.querySelector("#download");
const downloadLabel = document.querySelector("#download-label");
const fitNote = document.querySelector("#fit-note");
const emptyHint = document.querySelector("#empty-hint");
const fontStatus = document.querySelector("#font-status");
const stage = document.querySelector(".stage");

canvas.width = COVER_WIDTH;
canvas.height = COVER_HEIGHT;

let paletteId = PALETTES[0].id;
let lastResult = null;
let frame = 0;
let fontsReady = false;
const defaultLabel = downloadLabel.textContent;

function selectedPalette() {
  return PALETTES.find((palette) => palette.id === paletteId) || PALETTES[0];
}

function buildPalettes() {
  PALETTES.forEach((palette) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette";
    button.role = "radio";
    button.dataset.id = palette.id;
    button.setAttribute("aria-checked", palette.id === paletteId ? "true" : "false");
    button.setAttribute("aria-label", palette.name);

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = `linear-gradient(145deg, ${palette.bgAlt}, ${palette.bg})`;

    const bar = document.createElement("span");
    bar.className = "swatch-bar";
    bar.style.background = palette.accent;

    const line = document.createElement("span");
    line.className = "swatch-line";
    line.style.background = palette.title;
    swatch.append(bar, line);

    const name = document.createElement("span");
    name.className = "swatch-name";
    name.textContent = palette.name;
    button.append(swatch, name);
    button.addEventListener("click", () => selectPalette(palette.id));
    paletteGroup.append(button);
  });
}

function selectPalette(id) {
  paletteId = id;
  paletteGroup.querySelectorAll(".palette").forEach((button) => {
    button.setAttribute("aria-checked", button.dataset.id === id ? "true" : "false");
  });
  schedule();
}

function fileName(title) {
  const clean = title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, "");
  const short = Array.from(clean).slice(0, 18).join("") || "未命名";
  return `封面-${short}.png`;
}

function describeFit(result, title, subtitle) {
  if (!title && !subtitle) return "";
  const size = result.titleSize || result.subSize;
  if (size <= 28) return "文字很长，字号已缩小到能完整放下，不会截断。";
  if (size < 130) return "标题较长，已自动换行并缩小字号。";
  return "";
}

function render() {
  if (!fontsReady) return null;
  const title = titleEl.value;
  const subtitle = subtitleEl.value;
  const palette = selectedPalette();
  const debug = new URLSearchParams(location.search).has("debug");
  lastResult = renderCover(ctx, canvas.width, canvas.height, {
    title,
    subtitle,
    palette,
    debug,
  });
  const hasText = Boolean(title.trim() || subtitle.trim());
  emptyHint.hidden = hasText;
  emptyHint.style.color = palette.sub;
  fitNote.textContent = describeFit(lastResult, title.trim(), subtitle.trim());
  const label = title.trim() || subtitle.trim() || "空白封面";
  canvas.setAttribute("aria-label", `封面预览：${label}`);
  stage.style.setProperty("--stage-tint", palette.bg);
}

function schedule() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(render);
}

function download() {
  render();
  const name = fileName(titleEl.value || subtitleEl.value || "");
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    downloadLabel.textContent = "已开始下载";
    window.setTimeout(() => {
      downloadLabel.textContent = defaultLabel;
    }, 1800);
  }, "image/png");
}

async function loadFonts() {
  const sample = "封面中文标题排版，。：「」《》ABCXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const timeout = new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("timeout")), 12000);
  });
  await Promise.race([
    Promise.all([
      document.fonts.load('700 120px "Cover Serif"', sample),
      document.fonts.load('400 48px "Cover Sans"', sample),
    ]),
    timeout,
  ]);
  await document.fonts.ready;
  if (!document.fonts.check('700 120px "Cover Serif"') || !document.fonts.check('400 48px "Cover Sans"')) {
    throw new Error("font unavailable");
  }
}

function bind() {
  titleEl.addEventListener("input", schedule);
  subtitleEl.addEventListener("input", schedule);
  downloadBtn.addEventListener("click", download);
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      download();
    }
  });
  paletteGroup.addEventListener("keydown", (event) => {
    const keys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"];
    if (!keys.includes(event.key)) return;
    const buttons = [...paletteGroup.querySelectorAll(".palette")];
    const index = buttons.findIndex((button) => button.dataset.id === paletteId);
    if (index < 0) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = buttons[(index + direction + buttons.length) % buttons.length];
    next.focus();
    selectPalette(next.dataset.id);
  });
}

async function start() {
  buildPalettes();
  bind();
  try {
    await loadFonts();
    fontsReady = true;
    document.body.classList.remove("is-loading");
    fontStatus.hidden = true;
    downloadBtn.disabled = false;
    render();
  } catch (error) {
    fontStatus.hidden = false;
    fontStatus.textContent = "中文字体没有加载成功，请刷新页面后再导出。";
    console.error(error);
  }
}

window.__xCover = {
  palettes: PALETTES.map((palette) => palette.id),
  getResult: () => lastResult,
  setInput({ title, subtitle, palette }) {
    if (typeof title === "string") titleEl.value = title;
    if (typeof subtitle === "string") subtitleEl.value = subtitle;
    if (palette) selectPalette(palette);
    render();
    return lastResult;
  },
};

start();
