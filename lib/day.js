/**
 * Один учебный день из сохранённых недель — для компактного виджета, где целая
 * неделя не помещается. Показываем сегодняшний день, а когда уроки на сегодня
 * кончились (или их нет) — ближайший следующий.
 */

import { addDays, isoDate, toMinutes, weekdayOf } from "@/lib/lessons";

/** Дата и время по Таллину: сервер на Vercel живёт в UTC. */
export function tallinnNow(date = new Date()) {
  // sv-SE даёт «2026-09-28 08:30» — ровно ISO-дата и время
  const [day, time] = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Tallinn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .split(" ");
  return { day, minutes: toMinutes(time) };
}

/**
 * @param weeks недели целиком (уже без скрытых предметов)
 * @param wanted дата «ГГГГ-ММ-ДД» из адреса; если в этот день уроков нет —
 *   выбираем день сами
 * @returns {{ day, prev, next, today } | null} day — { iso, weekday, blocks,
 *   weekId }; prev/next — даты соседних учебных дней или null
 */
export function pickDay(weeks, wanted, now = tallinnNow()) {
  const days = weeks
    .flatMap((week) =>
      (week.days ?? [])
        .filter((d) => d.blocks?.length)
        .map((d) => {
          const iso = isoDate(d.date);
          const blocks = [...d.blocks].sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
          return { iso, weekday: weekdayOf(iso), blocks, weekId: week.id };
        })
    )
    .sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));

  if (!days.length) return null;

  let index = wanted ? days.findIndex((d) => d.iso === wanted) : -1;
  if (index < 0) {
    // сегодня, пока не кончился последний урок, иначе — следующий учебный день
    index = days.findIndex(
      (d) =>
        d.iso > now.day ||
        (d.iso === now.day && toMinutes(d.blocks[d.blocks.length - 1].to) > now.minutes)
    );
    // расписание дальше не опубликовано — показываем последний известный день
    if (index < 0) index = days.length - 1;
  }

  return {
    day: days[index],
    prev: days[index - 1]?.iso ?? null,
    next: days[index + 1]?.iso ?? null,
    today: now,
  };
}

/** Подпись дня: «Täna», «Homme» или день недели. */
export function dayLabel(iso, today) {
  if (iso === today) return "Täna";
  if (iso === addDays(today, 1)) return "Homme";
  return weekdayOf(iso);
}
