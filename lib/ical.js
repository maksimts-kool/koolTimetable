/**
 * Сборка iCalendar-ленты (RFC 5545) из записей недель — тех же, что показывает
 * сайт. Один блок расписания = одно событие: подряд идущие уроки уже склеены
 * в lib/lessons.js, и в календаре они выглядят так же, как в сетке.
 *
 * Лента отдаётся по подписке (webcal), поэтому UID событий должны быть
 * устойчивыми: при обновлении расписания клиент правит событие, а не плодит
 * дубликаты.
 */

import { isoDate } from "./lessons.js";
import { plural } from "./format.js";

export const TZID = "Europe/Tallinn";

/** Переводы часов в ЕС: последнее воскресенье марта и октября, 01:00 UTC. */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  `X-LIC-LOCATION:${TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0300",
  "TZNAME:EEST",
  "DTSTART:19700329T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0300",
  "TZOFFSETTO:+0200",
  "TZNAME:EET",
  "DTSTART:19701025T040000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Экранирование текстового значения: обратный слэш, «;», «,» и перевод строки. */
const esc = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/**
 * Свёртка длинных строк: не длиннее 75 октетов, продолжение начинается с
 * пробела. Считаем именно байты UTF-8 и не разрываем символ посередине —
 * иначе кириллица в описании превращается в мусор.
 */
function fold(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts = [];
  let start = 0;
  while (start < bytes.length) {
    const limit = parts.length ? 74 : 75; // на продолжении один октет занимает пробел
    let end = Math.min(start + limit, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // хвост многобайтового символа
    parts.push((parts.length ? " " : "") + bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return parts.join("\r\n");
}

/** «2026-08-31» + «08:30» → «20260831T083000» (локальное время, TZID отдельно). */
const localStamp = (iso, time) => `${iso.replace(/-/g, "")}T${time.replace(":", "")}00`;

/** Момент времени → «20260831T083000Z». Мусор на входе не должен ронять ленту. */
function utcStamp(value) {
  const date = value ? new Date(value) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${safe.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/** Уникальный и устойчивый идентификатор события. */
const uid = (week, dateIso, block, index) =>
  `${week.group}-${dateIso}-${block.from.replace(":", "")}-${index}@tunniplaan`.replace(/\s+/g, "");

function describe(block) {
  const lines = [];
  if (block.teacher) lines.push(`Преподаватель: ${block.teacher}`);
  if (block.room) lines.push(`Кабинет: ${block.room}`);
  if (block.groups) lines.push(`Группы: ${block.groups}`);
  if (block.note) lines.push(block.note);
  lines.push(`${plural(block.lessons ?? 1)} по 45 мин`);
  return lines.join("\n");
}

function toEvent(week, day, block, index, stamp) {
  const dateIso = isoDate(day.date);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid(week, dateIso, block, index)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${TZID}:${localStamp(dateIso, block.from)}`,
    `DTEND;TZID=${TZID}:${localStamp(dateIso, block.to)}`,
    `SUMMARY:${esc(block.subject)}`,
    `DESCRIPTION:${esc(describe(block))}`,
  ];
  if (block.room) lines.push(`LOCATION:${esc(block.room)}`);
  lines.push(`LAST-MODIFIED:${stamp}`, "TRANSP:OPAQUE", "END:VEVENT");
  return lines;
}

/**
 * Недели (полные записи, с днями и блоками) → текст .ics.
 * @param {object[]} weeks
 * @param {{name?: string, description?: string, url?: string, ttl?: string}} options
 */
export function buildCalendar(weeks, { name = "Tunniplaan", description = "", url = "", ttl = "PT6H" } = {}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tunniplaan//Tahvel//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `NAME:${esc(name)}`,
    `X-WR-CALNAME:${esc(name)}`,
    `X-WR-TIMEZONE:${TZID}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${ttl}`,
    `X-PUBLISHED-TTL:${ttl}`,
  ];
  if (description) lines.push(`DESCRIPTION:${esc(description)}`, `X-WR-CALDESC:${esc(description)}`);
  if (url) lines.push(`SOURCE;VALUE=URI:${url}`, `URL:${url}`);
  lines.push(...VTIMEZONE);

  const seen = new Set();
  for (const week of weeks) {
    const stamp = utcStamp(week.uploadedAt || week.parsedAt);
    for (const day of week.days ?? []) {
      (day.blocks ?? []).forEach((block, index) => {
        if (!block?.from || !block?.to) return;
        const event = toEvent(week, day, block, index, stamp);
        const id = event[1];
        if (seen.has(id)) return; // одна и та же пара в двух записях недели
        seen.add(id);
        lines.push(...event);
      });
    }
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
