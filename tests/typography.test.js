import assert from "node:assert/strict";
import test from "node:test";
import {
  isNonEnder,
  isNonStarter,
  layoutLines,
  lineText,
  positionLine,
  tokenize,
} from "../site/js/typography.js";

function measure(atom) {
  let width = 0;
  for (const ch of atom.text) {
    if (ch === " " || ch === "\u3000") width += 4;
    else if (/[A-Za-z0-9]/.test(ch)) width += 6;
    else width += 10;
  }
  return width;
}

function linesOf(text, maxWidth, em = 10) {
  return layoutLines(text, maxWidth, measure, em).map(lineText);
}

function compact(text) {
  return text.replace(/\s/gu, "");
}

function assertTypography(text, maxWidth) {
  const lines = linesOf(text, maxWidth);
  const message = JSON.stringify(lines);
  assert.equal(compact(lines.join("")), compact(text), message);
  lines.forEach((line, index) => {
    const chars = Array.from(line);
    if (!chars.length) return;
    if (index > 0) {
      assert.equal(isNonStarter(chars[0]), false, `行首不该出现 ${chars[0]}：${message}`);
    }
    if (index < lines.length - 1) {
      assert.equal(isNonEnder(chars.at(-1)), false, `行尾不该出现 ${chars.at(-1)}：${message}`);
    }
  });
  return lines;
}

const SAMPLES = [
  "当生成式模型开始理解中文标点与停顿，封面排版就不再只是把字放大而已",
  "当生成式模型开始理解中文的标点、停顿与换行，一张封面就不再只是把标题放大，而是让每一行都站得住。",
  "他说：「你好，世界。」然后把这句话放进封面。",
  "「引号」、（括号）、破折号——以及省略号……都不应掉到行首。",
  "用 Cursor 与 GitHub Pages 做一张 X Article Cover，给中英文混排。",
  "Cursor 与中文排版：做一张 X Article Cover",
  "100% 的把握，以及 3.14 这个数字和 10:30 的时间。",
  "A quiet cover for long writing on X",
  "夜航",
  "在字与字之间，留下刚好的呼吸",
];

test("常见标题在不同宽度下不丢字，也不把标点放到行首", () => {
  for (const text of SAMPLES) {
    for (const width of [30, 46, 64, 80, 110, 150, 220, 360]) {
      assertTypography(text, width);
    }
  }
});

test("显式换行会分成两行", () => {
  assert.deepEqual(linesOf("第一行\n第二行", 400), ["第一行", "第二行"]);
});

test("英文单词尽量保持完整", () => {
  const lines = linesOf("用 GitHub 做封面", 50);
  assert.ok(lines.some((line) => line.includes("GitHub")), JSON.stringify(lines));
  assert.equal(lines.some((line) => line.includes("Git") && !line.includes("GitHub")), false);
});

test("超长英文单词会被拆开且不丢字符", () => {
  const word = "Supercalifragilisticexpialidocious";
  const lines = linesOf(word, 40);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(""), word);
});

test("数字、缩写和英文所有格保持成词", () => {
  assert.deepEqual(tokenize("3.14").map((atom) => atom.text), ["3.14"]);
  assert.deepEqual(tokenize("10:30").map((atom) => atom.text), ["10:30"]);
  assert.deepEqual(tokenize("don't stop").map((atom) => atom.text), ["don't", " ", "stop"]);
  assert.deepEqual(tokenize("U.S.A").map((atom) => atom.text), ["U.S.A"]);
  assert.deepEqual(tokenize("用Cursor").map((atom) => atom.type), ["cjk", "latin"]);
});

test("优先在标点后换行，避免把词拆开", () => {
  for (const width of [100, 110, 130]) {
    assert.deepEqual(linesOf("在字与字之间，留下刚好的呼吸", width), [
      "在字与字之间，",
      "留下刚好的呼吸",
    ], `width ${width}`);
  }
  assert.deepEqual(linesOf("在字与字之间，留下刚好的呼吸", 140), [
    "在字与字之间，留下刚好的呼吸",
  ]);
});

test("行尾不留下把、与、和", () => {
  const lines = linesOf("一张封面就不再只是把标题放大", 100);
  assert.equal(lines[0].endsWith("把"), false, JSON.stringify(lines));
  assert.equal(lines[1].startsWith("把"), true, JSON.stringify(lines));
  assertTypography("一张封面就不再只是把标题放大", 100);
});

test("定位后的右边缘与测量宽度一致", () => {
  const text = "用 Cursor 做一张中英混排的封面，然后收住。";
  const maxWidth = 120;
  const em = 10;
  for (const line of layoutLines(text, maxWidth, measure, em)) {
    const positioned = positionLine(line, measure, em);
    const end = positioned.at(-1).x + positioned.at(-1).width;
    const start = positioned[0].x;
    let natural = 0;
    for (let i = 0; i < line.length; i += 1) {
      natural += measure(line[i]);
    }
    // 只核对挤压后没有超出行宽；开括号允许向左伸出一点。
    assert.ok(end <= maxWidth + 0.6, `${lineText(line)} end=${end}`);
    assert.ok(end - start <= natural + 0.6);
  }
});
