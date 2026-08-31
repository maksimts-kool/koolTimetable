/**
 * Предметы, которые посещает не вся группа: Eesti keel teise keelena B2 не
 * нужен тем, кто уже сдал экзамен по эстонскому. Такой предмет убирается
 * галочкой на сайте и параметром `?hide=eesti-b2` в ленте календаря.
 *
 * Список общий для страницы и для .ics — иначе подписка и сайт разошлись бы.
 */

export const OPTIONAL_SUBJECTS = [
  {
    id: "eesti-b2",
    label: "Eesti keel teise keelena B2",
    hint: "Снимите галочку, если экзамен по эстонскому сдан: предмет исчезнет из расписания и из ленты календаря",
    match: /eesti\s+keel\s+teise\s+keelena/i,
  },
];

/** id скрываемого предмета — или null, если предмет обязательный. */
export function optionalIdOf(subject) {
  return OPTIONAL_SUBJECTS.find((o) => o.match.test(subject || ""))?.id ?? null;
}

/** Какие из скрываемых предметов реально встречаются в этих неделях. */
export function optionalsIn(weeks) {
  const found = new Set();
  for (const week of weeks ?? []) {
    for (const day of week?.days ?? []) {
      for (const block of day.blocks ?? []) {
        const id = optionalIdOf(block.subject);
        if (id) found.add(id);
      }
    }
  }
  return OPTIONAL_SUBJECTS.filter((o) => found.has(o.id));
}

/** «eesti-b2,мусор» → Set из известных id (чужие значения игнорируем). */
export function parseHidden(value) {
  const asked = new Set(
    String(value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  return new Set(OPTIONAL_SUBJECTS.filter((o) => asked.has(o.id)).map((o) => o.id));
}

/**
 * Копия недели без скрытых предметов: дни, оставшиеся пустыми, выпадают, а
 * lessonCount пересчитывается — на нём держатся счётчики в шапке.
 */
export function hideSubjects(week, hidden) {
  if (!week || !hidden?.size) return week;

  const days = [];
  let lessonCount = 0;
  for (const day of week.days ?? []) {
    const blocks = (day.blocks ?? []).filter((b) => {
      const id = optionalIdOf(b.subject);
      return !id || !hidden.has(id);
    });
    if (!blocks.length) continue;
    lessonCount += blocks.reduce((sum, b) => sum + (b.lessons ?? 1), 0);
    days.push({ ...day, blocks });
  }
  return { ...week, days, lessonCount };
}
