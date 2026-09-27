/**
 * Учебные дни из сохранённых недель — для компактного виджета, где целая
 * неделя не помещается. Показываем сегодняшний день, а когда уроки на сегодня
 * кончились (или их нет) — ближайший следующий.
 *
 * Модуль без серверных зависимостей: день выбирается и в браузере, по часам,
 * которые идут, пока страница открыта.
 */

import { addDays, isoDate, toMinutes, weekdayOf } from "@/lib/lessons";

/** Дата и время по Таллину: часы сервера и браузера могут жить в любом поясе. */
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
 * Дни с уроками по возрастанию даты: { iso, weekday, blocks, weekId }.
 * @param weeks недели целиком (уже без скрытых предметов)
 * @param from не раньше этой даты — старые дни виджету не нужны
 */
export function lessonDays(weeks, from = "") {
  return weeks
    .flatMap((week) =>
      (week.days ?? [])
        .filter((d) => d.blocks?.length)
        .map((d) => {
          const iso = isoDate(d.date);
          const blocks = [...d.blocks].sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
          return { iso, weekday: weekdayOf(iso), blocks, weekId: week.id };
        })
    )
    .filter((d) => d.iso >= from)
    .sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
}

/**
 * Какой день показать сам по себе: сегодня, пока не кончился последний урок,
 * иначе — следующий учебный. Если расписание дальше не опубликовано —
 * последний известный день.
 */
export function autoIndex(days, now) {
  const index = days.findIndex(
    (d) =>
      d.iso > now.day ||
      (d.iso === now.day && toMinutes(d.blocks[d.blocks.length - 1].to) > now.minutes)
  );
  return index < 0 ? days.length - 1 : index;
}

/** Подпись дня: «Täna», «Homme» или день недели. */
export function dayLabel(iso, today) {
  if (iso === today) return "Täna";
  if (iso === addDays(today, 1)) return "Homme";
  return weekdayOf(iso);
}

/** 25 → «25 min», 80 → «1 h 20 min». */
export function duration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : "", m || !h ? `${m} min` : ""].filter(Boolean).join(" ");
}
