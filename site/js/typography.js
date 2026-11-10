// 封面排版：中文标点不落在行首，开括号不落在行尾，英文单词尽量整词换行。

const OPEN_LIST = [
  "「", "『", "【", "〖", "〔", "〈", "《", "（", "(", "[", "{",
  "“", "‘", "〝", "｢", "<",
];
const CLOSE_LIST = [
  "」", "』", "】", "〗", "〕", "〉", "》", "）", ")", "]", "}",
  "”", "’", "〞", "〟", "｣", ">",
  "，", "。", "、", "．", "；", "：", "？", "！",
  "…", "—", "～", "·", "・", "‧",
  "%", "‰", "℃", "°", "々", "〻", "ー",
  ",", ".", "!", "?", ";", ":",
];

const OPEN = new Set(OPEN_LIST);
const CLOSE = new Set(CLOSE_LIST);

export function isNonEnder(ch) {
  return OPEN.has(ch);
}

export function isNonStarter(ch) {
  return CLOSE.has(ch);
}

function isLatinCore(ch) {
  return /[A-Za-z0-9]/.test(ch);
}

function isDigit(ch) {
  return /[0-9]/.test(ch);
}

function isIdeograph(ch) {
  const c = ch.codePointAt(0);
  return (
    (c >= 0x3040 && c <= 0x30ff) ||
    (c >= 0x3400 && c <= 0x9fff) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xff00 && c <= 0xffef) ||
    (c >= 0x20000 && c <= 0x3ffff)
  );
}

function glueInsideWord(ch, prev, next) {
  if (!prev || !next) return false;
  if ((ch === "'" || ch === "’" || ch === "-" || ch === "/" || ch === ".") && isLatinCore(prev) && isLatinCore(next)) {
    return true;
  }
  if ((ch === "," || ch === ":") && isDigit(prev) && isDigit(next)) {
    return true;
  }
  return false;
}

export function tokenize(text) {
  const chars = Array.from(text);
  const atoms = [];
  let asciiDoubleOpen = true;
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];

    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && chars[i + 1] === "\n") i += 1;
      atoms.push({ type: "break", text: "\n" });
      i += 1;
      continue;
    }

    if (/\s/u.test(ch)) {
      let t = ch;
      i += 1;
      while (i < chars.length && chars[i] !== "\n" && chars[i] !== "\r" && /\s/u.test(chars[i])) {
        t += chars[i];
        i += 1;
      }
      atoms.push({ type: "space", text: t });
      continue;
    }

    if (isLatinCore(ch)) {
      let t = ch;
      i += 1;
      while (i < chars.length) {
        const curr = chars[i];
        const prev = chars[i - 1];
        const next = chars[i + 1];
        if (isLatinCore(curr) || glueInsideWord(curr, prev, next)) {
          t += curr;
          i += 1;
          continue;
        }
        break;
      }
      atoms.push({ type: "latin", text: t });
      continue;
    }

    if (ch === '"') {
      atoms.push({ type: asciiDoubleOpen ? "open" : "close", text: ch });
      asciiDoubleOpen = !asciiDoubleOpen;
      i += 1;
      continue;
    }

    let type = "symbol";
    if (OPEN.has(ch)) type = "open";
    else if (CLOSE.has(ch)) type = "close";
    else if (isIdeograph(ch)) type = "cjk";
    atoms.push({ type, text: ch });
    i += 1;
  }

  return atoms;
}

export function atomGap(prev, next, em) {
  if (!prev || !next || !em) return 0;
  const cjk = prev.type === "cjk" && next.type === "latin";
  const lat = prev.type === "latin" && next.type === "cjk";
  if (cjk || lat) return em * 0.12;
  if (prev.type === "open" && next.type === "latin") return em * 0.05;
  if (prev.type === "latin" && next.type === "close") return em * 0.04;
  return 0;
}

export function measureLine(line, measure, em) {
  let width = 0;
  for (let i = 0; i < line.length; i += 1) {
    width += measure(line[i]);
    if (i) width += atomGap(line[i - 1], line[i], em);
  }
  return width;
}

function splitLong(text, maxWidth, measureText) {
  const parts = [];
  let rest = text;
  while (rest.length > 1 && measureText(rest) > maxWidth) {
    let best = 1;
    let hyphen = -1;
    for (let i = 1; i < rest.length; i += 1) {
      if (measureText(rest.slice(0, i)) <= maxWidth) {
        best = i;
        const boundary = rest[i - 1];
        if (boundary === "-" || boundary === "/") hyphen = i;
      } else {
        break;
      }
    }
    const cut = hyphen > 0 ? hyphen : best;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) parts.push(rest);
  return parts;
}

function nextSolid(atoms, index) {
  for (let i = index; i < atoms.length; i += 1) {
    if (atoms[i].type === "break") return null;
    if (atoms[i].type !== "space") return atoms[i];
  }
  return null;
}

const AVOID_LINE_END = new Set(Array.from("把被将让使向从对给为与和及或"));

function retargetBreak(cur) {
  let closeAt = -1;
  for (let index = cur.length - 1; index >= 0; index -= 1) {
    if (cur[index].type === "close") {
      closeAt = index;
      break;
    }
  }
  if (closeAt >= 0) {
    const tailCount = cur.length - closeAt - 1;
    const headCount = closeAt + 1;
    if (tailCount >= 1 && tailCount <= 8 && headCount >= 4) {
      return {
        head: cur.slice(0, closeAt + 1),
        tail: cur.slice(closeAt + 1),
      };
    }
  }
  const last = cur[cur.length - 1];
  if (last && last.type === "cjk" && AVOID_LINE_END.has(last.text) && cur.length >= 5) {
    return { head: cur.slice(0, -1), tail: [last] };
  }
  return null;
}

export function layoutLines(text, maxWidth, measure, em = 0) {
  const atoms = tokenize(text);
  const lines = [];
  let cur = [];
  const width = (line) => measureLine(line, measure, em);

  function commit() {
    while (cur.length && cur[0].type === "space") cur.shift();
    while (cur.length && cur[cur.length - 1].type === "space") cur.pop();
    if (cur.length) lines.push(cur);
    cur = [];
  }

  function putPieces(parts) {
    for (let p = 0; p < parts.length; p += 1) {
      const piece = { type: "latin", text: parts[p] };
      if (cur.length && width(cur.concat([piece])) > maxWidth) commit();
      cur.push(piece);
      if (p < parts.length - 1) commit();
    }
  }

  for (let i = 0; i < atoms.length; i += 1) {
    const atom = atoms[i];

    if (atom.type === "break") {
      commit();
      continue;
    }
    if (atom.type === "space" && cur.length === 0) continue;

    if (atom.type === "latin" && measure(atom) > maxWidth) {
      const parts = splitLong(atom.text, maxWidth, (piece) => measure({ type: "latin", text: piece }));
      putPieces(parts);
      continue;
    }

    if (atom.type === "open" && cur.length) {
      const nxt = nextSolid(atoms, i + 1);
      if (nxt && measure(nxt) <= maxWidth) {
        const openW = width(cur.concat([atom]));
        const pairW = width(cur.concat([atom, nxt]));
        if (openW <= maxWidth && pairW > maxWidth) {
          commit();
          cur.push(atom);
          continue;
        }
      }
    }

    const nextW = width(cur.concat([atom]));
    if (cur.length === 0 || nextW <= maxWidth) {
      cur.push(atom);
      continue;
    }

    if (atom.type !== "close" && atom.type !== "space") {
      const split = retargetBreak(cur);
      if (split) {
        cur = split.head;
        commit();
        cur = split.tail;
        i -= 1;
        continue;
      }
    }

    if (atom.type === "close") {
      const overflow = nextW - maxWidth;
      const limit = Math.max(em * 1.05, width(cur) * 0.1);
      if (overflow <= limit) {
        cur.push(atom);
        cur.tighten = overflow;
        continue;
      }
      const pulled = [];
      while (cur.length && (cur[cur.length - 1].type === "space" || pulled.length === 0)) {
        pulled.unshift(cur.pop());
      }
      if (!cur.length) {
        cur = pulled.concat([atom]);
        cur.tighten = Math.max(0, width(cur) - maxWidth);
        continue;
      }
      commit();
      cur = pulled.concat([atom]);
      const pulledW = width(cur);
      if (pulledW > maxWidth) cur.tighten = pulledW - maxWidth;
      continue;
    }

    const trail = [];
    while (cur.length && cur[cur.length - 1].type === "open") trail.unshift(cur.pop());
    commit();
    cur = atom.type === "space" ? trail : trail.concat([atom]);
  }
  commit();

  for (let pass = 0; pass < 5; pass += 1) {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (!lines[i].length) lines.splice(i, 1);
    }
    let changed = false;
    for (let i = 0; i < lines.length - 1; i += 1) {
      const line = lines[i];
      const next = lines[i + 1];
      while (next.length && next[0].type === "close" && line.length) {
        line.push(next.shift());
        changed = true;
      }
      while (line.length && next.length && line[line.length - 1].type === "open") {
        next.unshift(line.pop());
        changed = true;
      }
    }
    if (!changed) break;
  }

  const result = lines.filter((line) => line.length);
  for (const line of result) {
    const lineWidth = width(line);
    line.tighten = Math.max(0, lineWidth - maxWidth);
  }
  return result;
}

export function lineText(line) {
  return line.map((atom) => atom.text).join("");
}

export function positionLine(line, measure, em) {
  const widths = line.map((atom) => measure(atom));
  const gaps = line.map((atom, index) => (index === 0 ? 0 : atomGap(line[index - 1], atom, em)));
  const natural = widths.reduce((sum, w) => sum + w, 0) + gaps.reduce((sum, g) => sum + g, 0);
  const tighten = Math.min(line.tighten || 0, Math.max(0, natural));
  const slots = Math.max(0, line.length - 1);
  const adjust = slots ? tighten / slots : 0;
  const hang = line[0] && line[0].type === "open" ? widths[0] * 0.18 : 0;
  let x = -hang;
  return line.map((atom, index) => {
    if (index > 0) x += gaps[index] - adjust;
    const item = { text: atom.text, type: atom.type, x, width: widths[index] };
    x += widths[index];
    return item;
  });
}
