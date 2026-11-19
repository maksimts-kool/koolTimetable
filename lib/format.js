/** «2026-08-31» → «31.08.2026» */
export function ruDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** «2026-08-31» → «31.08» */
export function shortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

/** Русское склонение: 1 урок, 2 урока, 5 уроков. */
export function plural(n, one = "урок", few = "урока", many = "уроков") {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

const RU_MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const RU_WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const RU_WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
// «в какой день»: во вторник, в среду
const RU_ON_WEEKDAY = ["в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу", "в воскресенье"];

const parts = (iso) => iso.split("-").map(Number);
/** 0 = понедельник */
export const weekdayIndex = (iso) => {
  const [y, m, d] = parts(iso);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

export const ruWeekday = (iso) => RU_WEEKDAYS[weekdayIndex(iso)];
export const ruWeekdayShort = (iso) => RU_WEEKDAYS_SHORT[weekdayIndex(iso)];
export const ruOnWeekday = (iso) => RU_ON_WEEKDAY[weekdayIndex(iso)];

/** «2026-11-19» → «19 ноября» */
export function ruDay(iso) {
  const [, m, d] = parts(iso);
  return `${d} ${RU_MONTHS[m - 1]}`;
}

/** Диапазон недели: «16 – 22 ноября», «30 ноября – 6 декабря». */
export function ruRange(fromIso, toIso) {
  const [, m1, d1] = parts(fromIso);
  const [, m2, d2] = parts(toIso);
  return m1 === m2 ? `${d1} – ${d2} ${RU_MONTHS[m2 - 1]}` : `${d1} ${RU_MONTHS[m1 - 1]} – ${d2} ${RU_MONTHS[m2 - 1]}`;
}

/** Номер недели по ISO 8601. */
export function isoWeek(iso) {
  const [y, m, d] = parts(iso);
  const date = new Date(Date.UTC(y, m - 1, d));
  // четверг той же недели определяет, к какому году она относится
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date - yearStart) / 864e5 + 1) / 7);
}

/** «HH:MM» из минут от полуночи. */
export const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;

/** 25 → «25 мин», 80 → «1 ч 20 мин». */
export function ruDuration(minutes) {
  const whole = Math.max(0, Math.round(minutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** Обратный отсчёт: до часа — «42:05» с секундами, дальше — «1 ч 05 мин». */
export function countdown(minutes) {
  const seconds = Math.max(0, Math.ceil(minutes * 60));
  if (seconds < 3600) return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const whole = Math.ceil(seconds / 60);
  return `${Math.floor(whole / 60)} ч ${String(whole % 60).padStart(2, "0")} мин`;
}

/** «Tarkvara (eesti keeles)» → «Tarkvara»: язык обучения в заголовках только мешает. */
export const shortSubject = (subject) => subject.replace(/\s*\((eesti|vene|inglise) keeles\)\s*$/i, "");

/** Первая буква заглавная: «завтра» → «Завтра». */
export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
