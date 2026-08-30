/**
 * Общее для двух источников расписания (PDF-выгрузка и Tahvel API):
 * даты, склейка подряд идущих уроков, чистка кодов корпуса.
 */

/** Дни недели по-эстонски, с понедельника. */
export const ET_WEEKDAYS = [
  "Esmaspäev",
  "Teisipäev",
  "Kolmapäev",
  "Neljapäev",
  "Reede",
  "Laupäev",
  "Pühapäev",
];

export const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * ТТК префиксует группы и кабинеты кодом корпуса: «M-TARpv24», «M-B117».
 * В расписании одного корпуса он только шумит — срезаем.
 */
export const stripCampus = (s) => s.replace(/\bM-(?=[A-Za-z0-9])/g, "");

/** «31.08.2026» → «2026-08-31» */
export function isoDate(dmy) {
  const [d, m, y] = dmy.split(".");
  return `${y}-${m}-${d}`;
}

/** «2026-08-31» → «31.08.2026» (в таком виде дата дня лежит в записи недели) */
export function dmyDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Арифметика дат в UTC: сдвиг через локальный Date ломается на переводе часов,
 * а нам нужен просто календарный день.
 */
export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const weekdayIndex = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = понедельник
};

/** Понедельник недели, в которую попадает дата. */
export const mondayOf = (iso) => addDays(iso, -weekdayIndex(iso));

/** Название дня недели по-эстонски. */
export const weekdayOf = (iso) => ET_WEEKDAYS[weekdayIndex(iso)];

/** Сегодняшняя дата в UTC — тот же календарь, что и у дат Tahvel. */
export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Подряд идущие уроки одного предмета в одном кабинете → один блок. */
export function mergeLessons(lessons, maxGap = 15) {
  const blocks = [];
  for (const lesson of lessons) {
    const prev = blocks[blocks.length - 1];
    const sameCourse =
      prev &&
      prev.subject === lesson.subject &&
      prev.room === lesson.room &&
      prev.teacher === lesson.teacher &&
      toMinutes(lesson.from) - toMinutes(prev.to) <= maxGap &&
      toMinutes(lesson.from) >= toMinutes(prev.to);
    if (sameCourse) {
      prev.marks.push(lesson.from);
      prev.to = lesson.to;
      prev.lessons += 1;
    } else {
      blocks.push({ ...lesson, lessons: 1, marks: [] });
    }
  }
  return blocks;
}
