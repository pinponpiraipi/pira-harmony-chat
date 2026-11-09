/** PIRA grid cipher: columns A–K × rows 1–17. E12 = 濁点, G12 = 半濁点, K17 = 小さい文字. */
const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"] as const;

// Each string lists rows 1..17 for that column ("" = unused cell).
const GRID: Record<(typeof COLS)[number], string[]> = {
  A: ["あ", "い", "う", "え", "お", "a", "b", "A", "B", "C", "1", ")", "ア", "イ", "ウ", "エ", "オ"],
  B: ["か", "き", "く", "け", "こ", "c", "d", "D", "E", "F", "2", "=", "カ", "キ", "ク", "ケ", "コ"],
  C: ["さ", "し", "す", "せ", "そ", "e", "f", "G", "H", "I", "3", "☆", "サ", "シ", "ス", "セ", "ソ"],
  D: ["た", "ち", "つ", "て", "と", "g", "h", "J", "K", "L", "4", "・", "タ", "チ", "ツ", "テ", "ト"],
  E: ["な", "に", "ぬ", "ね", "の", "i", "j", "M", "N", "O", "5", "", "ナ", "ニ", "ヌ", "ネ", "ノ"],
  F: ["は", "ひ", "ふ", "へ", "ほ", "k", "l", "P", "Q", "R", "6", "&", "ハ", "ヒ", "フ", "ヘ", "ホ"],
  G: ["ま", "み", "む", "め", "も", "m", "n", "S", "T", "U", "7", "", "マ", "ミ", "ム", "メ", "モ"],
  H: ["や", "ゆ", "よ", "o", "p", "q", "r", "V", "W", "X", "8", "^", "ヤ", "ユ", "ヨ", "*", "+"],
  I: ["ら", "り", "る", "れ", "ろ", "s", "t", "Y", "Z", ".", "9", "~", "ラ", "リ", "ル", "レ", "ロ"],
  J: ["わ", "を", "ん", "u", "v", "w", "x", "」", "、", "。", "(", "¥", "ワ", "ヲ", "ン", "-", "♡"],
  K: ["y", "z", ":", "/", "!", "?", "@", "#", "「", ",", "\\", "|", "{", "}", "[", "]", ""],
};

const DAKU = "E12";
const HANDAKU = "G12";
const SMALL = "K17";

const toCode = new Map<string, string>();
const toChar = new Map<string, string>();
for (const c of COLS) {
  GRID[c].forEach((ch, i) => {
    if (!ch) return;
    const code = `${c}${i + 1}`;
    toChar.set(code, ch);
    if (!toCode.has(ch)) toCode.set(ch, code);
  });
}

const DAKU_PAIRS = "かがきぎくぐけげこごさざしじすずせぜそぞただちぢつづてでとどはばひびふぶへべほぼうゔカガキギクグケゲコゴサザシジスズセゼソゾタダチヂツヅテデトドハバヒビフブヘベホボウヴ";
const HANDAKU_PAIRS = "はぱひぴふぷへぺほぽハパヒピフプヘペホポ";
const SMALL_PAIRS = "あぁいぃうぅえぇおぉつっやゃゆゅよょわゎアァイィウゥエェオォツッヤャユュヨョワヮ";

function pairs(s: string) {
  const base = new Map<string, string>();
  const mod = new Map<string, string>();
  const chars = [...s];
  for (let i = 0; i < chars.length; i += 2) {
    base.set(chars[i + 1]!, chars[i]!);
    mod.set(chars[i]!, chars[i + 1]!);
  }
  return { base, mod };
}
const D = pairs(DAKU_PAIRS);
const H = pairs(HANDAKU_PAIRS);
const S = pairs(SMALL_PAIRS);

/** Plain text → codes separated by spaces. A space becomes "_", a new line stays a new line. */
export function encodeCipher(plain: string) {
  return plain
    .split("\n")
    .map((line) =>
      [...line]
        .map((ch) => {
          if (ch === " " || ch === "　") return "_";
          if (toCode.has(ch)) return toCode.get(ch)!;
          const d = D.base.get(ch);
          if (d && toCode.has(d)) return toCode.get(d)! + DAKU;
          const h = H.base.get(ch);
          if (h && toCode.has(h)) return toCode.get(h)! + HANDAKU;
          const s = S.base.get(ch);
          if (s && toCode.has(s)) return toCode.get(s)! + SMALL;
          return ch;
        })
        .join(" "),
    )
    .join("\n");
}

/** Codes → plain text. Accepts spaces or no spaces between codes. */
export function decodeCipher(text: string) {
  return text
    .split("\n")
    .map((line) => {
      let out = "";
      const re = /([A-Ka-k])(1[0-7]|[1-9])|_|\s+|./g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        const tok = m[0];
        if (tok === "_") {
          out += " ";
          continue;
        }
        if (/^\s+$/.test(tok)) continue;
        if (!m[1]) {
          out += tok;
          continue;
        }
        const code = m[1].toUpperCase() + m[2];
        const last = out.slice(-1);
        if (code === DAKU && D.mod.has(last)) out = out.slice(0, -1) + D.mod.get(last)!;
        else if (code === HANDAKU && H.mod.has(last)) out = out.slice(0, -1) + H.mod.get(last)!;
        else if (code === SMALL && S.mod.has(last)) out = out.slice(0, -1) + S.mod.get(last)!;
        else out += toChar.get(code) ?? "";
      }
      return out;
    })
    .join("\n");
}
