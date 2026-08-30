/**
 * Цвета предметов.
 *
 * Оттенок не вычисляется из хэша напрямую: близкие хэши давали два почти
 * одинаковых зелёных в одной неделе. Вместо этого — палитра заведомо
 * различимых оттенков; предмет получает слот по хэшу имени (значит, цвет
 * держится от недели к неделе), а занятый слот сдвигается на следующий
 * свободный, поэтому внутри одной недели цвета не повторяются.
 *
 * Светлота каждого оттенка подбирается так, чтобы белый текст на заливке
 * давал контраст не ниже 5:1 (WCAG AA с запасом).
 */

// Жёлто-оливковая зона (40–90°) исключена: на тёмной светлоте она грязная.
const HUES = [20, 146, 176, 205, 240, 275, 315, 344, 108, 190];
const TARGET_CONTRAST = 5;

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function relativeLuminance(h, s, l) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hslToRgb(h, s, l);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrastWithWhite = (h, s, l) => 1.05 / (relativeLuminance(h, s, l) + 0.05);

function hash(name) {
  let value = 0;
  for (let i = 0; i < name.length; i++) value = (value * 31 + name.charCodeAt(i)) >>> 0;
  return value;
}

/** Оттенок + номер круга палитры → конкретный цвет с читаемым белым текстом. */
function build(hue, cycle) {
  const s = hue >= 20 && hue <= 160 ? 0.68 : 0.58;
  let l = 0.6 - cycle * 0.06; // второй круг палитры темнее, чтобы не сливаться с первым
  while (l > 0.16 && contrastWithWhite(hue, s, l) < TARGET_CONTRAST) l -= 0.005;
  const css = (light) => `hsl(${hue} ${Math.round(s * 100)}% ${(light * 100).toFixed(1)}%)`;
  return { h: hue, bg: css(l), border: css(Math.max(l - 0.13, 0.08)) };
}

/**
 * @param {string[]} names названия предметов недели
 * @returns {Map<string, {h:number, bg:string, border:string}>}
 */
export function assignColors(names) {
  const unique = [...new Set(names)].sort();
  const taken = new Set();
  const colors = new Map();

  for (const name of unique) {
    const start = hash(name) % HUES.length;
    let slot = start;
    let steps = 0;
    while (taken.has(slot) && steps < HUES.length) {
      slot = (slot + 1) % HUES.length;
      steps += 1;
    }
    taken.add(slot);
    // предметов больше, чем оттенков — идём на второй круг палитры
    const cycle = Math.floor((colors.size - (colors.size % HUES.length)) / HUES.length);
    colors.set(name, build(HUES[slot], cycle));
  }
  return colors;
}
