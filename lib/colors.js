/**
 * Цвета предметов.
 *
 * Оттенок не берётся из хэша: близкие хэши давали в одной неделе два зелёных,
 * отличавшихся только светлотой. Вместо этого цвета недели расставляются по
 * кругу равномерно — сколько предметов, на столько равных долей делится
 * палитра, поэтому «зелёный и тёмно-зелёный» рядом не встречаются.
 *
 * Расстояние меряется не в градусах: градусы обманывают — от зелёного до
 * бирюзового 25°, и это два разных цвета, а от синего до фиолетового 30°, но
 * разница слабее. Поэтому есть кольцо опорных оттенков, каждый из которых
 * читается как отдельный цвет; шкала между соседними опорами растягивается
 * линейно, и единица расстояния везде значит одно и то же.
 *
 * Вторая координата — светлота. Она не выбирается: чтобы белый текст остался
 * читаемым, зелёные и бирюзовые заливки сами уходят к 30%, а фиолетовые
 * остаются около 60%. Разница в светлоте тоже отличает цвета, поэтому она
 * входит в расстояние наравне с оттенком — так пара «зелёный и бирюзовый»
 * (оба тёмные) проигрывает паре «зелёный и розовый».
 *
 * Начало раскладки перебирается: круг проворачивается, и берётся положение, где
 * ближайшая пара цветов оказалась дальше всего друг от друга — так пропуск
 * жёлто-оливковой зоны попадает внутрь промежутка, а не съедает его. Ничьи
 * решает хэш имён, поэтому один и тот же набор предметов от недели к неделе
 * окрашивается одинаково.
 *
 * Светлота подбирается так, чтобы белый текст на заливке давал контраст не
 * ниже 5:1 (WCAG AA с запасом).
 */

// Опоры перцептивной шкалы: красный, оранжевый, жёлтый, лайм, зелёный,
// бирюзовый, циан, голубой, синий, фиолетовый, пурпурный, маджента, розовый,
// малиновый.
const ANCHORS = [6, 26, 45, 95, 140, 165, 190, 208, 228, 258, 285, 310, 330, 348];

// Жёлто-оливковая зона в заливку не идёт: на тёмной светлоте она грязная.
// В шкале она при этом учтена — иначе оранжевый и лайм считались бы соседями.
const CANDIDATES = [];
for (let hue = 0; hue < 360; hue += 3) if (hue < 36 || hue > 100) CANDIDATES.push(hue);

const TARGET_CONTRAST = 5;
// Зазор, ниже которого одного оттенка мало: предмет уходит на тёмный круг
// палитры. Срабатывает, только когда предметов больше десятка.
const MIN_GAP = 1;
// Во сколько шагов шкалы обходится вся разница по светлоте (0.3 → полтора шага).
const LIGHT_WEIGHT = 5;
// Сколько положений круга перебирать в поисках лучшего начала раскладки.
const OFFSETS = 48;

// Тёплая половина круга держит насыщенность выше: иначе она выглядит вылинявшей.
const saturationFor = (hue) => (hue >= 20 && hue <= 160 ? 0.68 : 0.58);

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

/** Оттенок → позиция на перцептивном круге длиной ANCHORS.length. */
function place(hue) {
  for (let i = 0; i < ANCHORS.length; i++) {
    const from = ANCHORS[i];
    const span = (ANCHORS[(i + 1) % ANCHORS.length] - from + 360) % 360;
    const offset = (hue - from + 360) % 360;
    if (offset < span) return i + offset / span;
  }
  return 0;
}

/** Самая светлая заливка этого оттенка, на которой белый текст ещё читается. */
function lightnessFor(hue, cycle) {
  const s = saturationFor(hue);
  let l = 0.6 - cycle * 0.14; // второй круг палитры темнее, чтобы не сливаться с первым
  while (l > 0.16 && contrastWithWhite(hue, s, l) < TARGET_CONTRAST) l -= 0.005;
  return l;
}

// Полная заготовка каждого допустимого цвета: место на шкале и та светлота,
// с которой он в итоге будет нарисован.
const SWATCHES = CANDIDATES.map((hue) => ({ hue, spot: place(hue), light: lightnessFor(hue, 0) }));

/** Расстояние по кругу: последний цвет — сосед первого, а не антипод. */
function apart(a, b) {
  const d = Math.abs(a - b) % ANCHORS.length;
  return Math.min(d, ANCHORS.length - d);
}

/** Насколько заготовка отличается от уже занятого цвета: оттенок плюс светлота. */
const distance = (a, b) =>
  Math.hypot(apart(a.spot, b.spot), (a.light - b.light) * LIGHT_WEIGHT);

/** Ближайшая пара в наборе — её и максимизируем. */
function worstPair(swatches) {
  let worst = Infinity;
  for (let i = 0; i < swatches.length; i++)
    for (let j = i + 1; j < swatches.length; j++)
      worst = Math.min(worst, distance(swatches[i], swatches[j]));
  return worst;
}

/** Свободная заготовка, ближайшая к нужному месту круга. */
function nearest(target, used) {
  let best = null;
  let bestDelta = Infinity;
  for (const swatch of SWATCHES) {
    if (used.includes(swatch)) continue;
    const delta = apart(swatch.spot, target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = swatch;
    }
  }
  return best;
}

/** Раскладка count цветов по кругу с проворотом на лучшее начало. */
function layout(count, seed) {
  const step = ANCHORS.length / count;
  let best = null;

  for (let i = 0; i < OFFSETS; i++) {
    const start = (((seed + i) % OFFSETS) * ANCHORS.length) / OFFSETS;
    const picked = [];
    for (let k = 0; k < count; k++) picked.push(nearest((start + k * step) % ANCHORS.length, picked));
    const score = worstPair(picked);
    if (!best || score > best.score) best = { score, picked };
  }
  return best.picked;
}

/** Оттенок + номер круга палитры → конкретный цвет с читаемым белым текстом. */
function build(hue, cycle) {
  const s = saturationFor(hue);
  const l = lightnessFor(hue, cycle);
  const css = (light) => `hsl(${hue} ${Math.round(s * 100)}% ${(light * 100).toFixed(1)}%)`;
  return { h: hue, bg: css(l), border: css(Math.max(l - 0.13, 0.08)) };
}

/**
 * @param {string[]} names названия предметов недели
 * @returns {Map<string, {h:number, bg:string, border:string}>}
 */
export function assignColors(names) {
  const unique = [...new Set(names)].sort();
  const picked = layout(unique.length, hash(unique.join("|")));
  const colors = new Map();

  unique.forEach((name, i) => {
    const others = picked.filter((_, j) => j !== i);
    // на второй круг палитры (темнее) уходят только цвета из тесноты —
    // а она начинается, когда предметов больше десятка
    const gap = others.length ? Math.min(...others.map((o) => distance(picked[i], o))) : Infinity;
    colors.set(name, build(picked[i].hue, gap < MIN_GAP ? 1 : 0));
  });
  return colors;
}
