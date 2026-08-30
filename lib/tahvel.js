/**
 * Клиент публичного API Tahvel (система ТТК).
 *
 * Эндпоинт timetableSearch отдаёт события расписания без авторизации, если
 * они опубликованы. Группу он ждёт в виде uuid, а справочник групп закрыт
 * (403) — поэтому uuid нужной группы задан в настройках, и только если его
 * нет, код ищется перебором событий (resolveGroup, дорого и с кэшем).
 */

import {
  dmyDate,
  mergeLessons,
  mondayOf,
  stripCampus,
  todayIso,
  toMinutes,
  weekdayOf,
  addDays,
} from "./lessons.js";

const BASE = process.env.TAHVEL_BASE_URL || "https://tahveltp.edu.ee/hois_back";
const SCHOOL_ID = process.env.TAHVEL_SCHOOL_ID || "24";
const DEFAULT_GROUP = { code: "TARpv24", uuid: "f48d56cf-b140-4203-a88c-5f76b57635b6" };
const PAGE_SIZE = 2000;
const TIMEOUT_MS = 20_000;
const GROUPS_TTL_MS = 6 * 60 * 60 * 1000;
const WINDOW_DAYS = 21; // окно, по которому собирается список групп
const MAX_PAGES = 12;
const BATCH = 6; // страниц за раз

export class TahvelError extends Error {
  constructor(message, code, options) {
    super(message, options);
    this.code = code;
  }
}

/** Одна страница выборки событий за период. */
async function fetchPage({ weekStart, weekEnd, groupUuid, page }) {
  const url = new URL(`${BASE}/timetableevents/timetableSearch`);
  url.searchParams.set("from", `${weekStart}T00:00:00.000Z`);
  url.searchParams.set("thru", `${weekEnd}T23:59:59.999Z`);
  url.searchParams.set("lang", "ET");
  url.searchParams.set("schoolId", SCHOOL_ID);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(PAGE_SIZE));
  if (groupUuid) url.searchParams.set("studentGroups", groupUuid);

  let res;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut = cause?.name === "TimeoutError" || cause?.name === "AbortError";
    throw new TahvelError(
      timedOut
        ? "Tahvel не ответил за 20 секунд. Попробуйте ещё раз."
        : "Не удалось связаться с Tahvel. Проверьте соединение.",
      timedOut ? "tahvel_timeout" : "tahvel_unreachable",
      { cause }
    );
  }

  if (!res.ok) {
    throw new TahvelError(
      `Tahvel ответил ошибкой ${res.status}. Возможно, изменился адрес API или школа закрыла расписание.`,
      "tahvel_http_error"
    );
  }

  try {
    return await res.json();
  } catch (cause) {
    throw new TahvelError("Tahvel вернул не JSON — похоже, ответила не та страница.", "tahvel_bad_json", {
      cause,
    });
  }
}

const contentOf = (body) => {
  if (!Array.isArray(body?.content)) {
    throw new TahvelError("Tahvel вернул ответ без списка событий.", "tahvel_bad_shape");
  }
  return body.content;
};

/**
 * Все события периода. Первая страница говорит, сколько их всего; остальные
 * тянем пачками параллельно — иначе список групп за три недели (десяток
 * страниц подряд) собирается полминуты.
 */
async function fetchEvents({ weekStart, weekEnd, groupUuid }) {
  const first = await fetchPage({ weekStart, weekEnd, groupUuid, page: 0 });
  const seen = new Map(contentOf(first).map((e) => [e.id, e]));
  const pages = Math.min(Number(first.totalPages) || 1, MAX_PAGES);

  for (let page = 1; page < pages; page += BATCH) {
    const batch = [];
    for (let i = page; i < Math.min(page + BATCH, pages); i++) {
      batch.push(fetchPage({ weekStart, weekEnd, groupUuid, page: i }));
    }
    for (const body of await Promise.all(batch)) {
      for (const event of contentOf(body)) seen.set(event.id, event);
    }
  }
  return [...seen.values()];
}

const names = (list, key) => (list ?? []).map((x) => x[key]).filter(Boolean).join(", ");

/** Событие Tahvel → урок в том же виде, что даёт разбор PDF. */
function toLesson(event) {
  const groups = [
    ...(event.studentGroups ?? []).map((g) => g.code),
    ...(event.subgroups ?? []).map((g) => g.code),
  ].filter(Boolean);

  return {
    from: event.timeStart.slice(0, 5),
    to: event.timeEnd.slice(0, 5),
    subject: (event.nameEt || event.nameRu || event.nameEn || "Sündmus").replace(/\s+/g, " ").trim(),
    teacher: names(event.teachers, "name"),
    groups: stripCampus(groups.join(", ")),
    room: stripCampus(names(event.rooms, "roomCode")),
    note: (event.addInfo || "").replace(/\s+/g, " ").trim(),
  };
}

/** События недели → дни с блоками уроков. */
function toDays(events) {
  const byDate = new Map();
  for (const event of events) {
    if (!event?.date || !event.timeStart || !event.timeEnd) continue;
    const date = String(event.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(toLesson(event));
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, lessons]) => ({
      weekday: weekdayOf(date),
      date: dmyDate(date),
      blocks: mergeLessons(lessons.sort((a, b) => toMinutes(a.from) - toMinutes(b.from))),
    }));
}

/**
 * Расписание одной группы за неделю.
 * @param {{code: string, uuid: string, weekStart: string}} params понедельник в формате «2026-08-31»
 * @returns {Promise<object>} запись недели в том же формате, что и разбор PDF
 */
export async function fetchWeek({ code, uuid, weekStart }) {
  const monday = mondayOf(weekStart);
  const weekEnd = addDays(monday, 6);
  const events = await fetchEvents({ weekStart: monday, weekEnd, groupUuid: uuid });
  const days = toDays(events);

  return {
    weekStart: monday,
    weekEnd,
    group: stripCampus(code),
    programme: "",
    days,
    lessonCount: days.reduce((sum, d) => sum + d.blocks.reduce((s, b) => s + b.lessons, 0), 0),
    source: "tahvel",
    groupUuid: uuid,
    parsedAt: new Date().toISOString(),
  };
}

/**
 * Группа, расписание которой ведёт сайт. По умолчанию — TARpv24; сменить можно
 * переменными TAHVEL_GROUP и TAHVEL_GROUP_UUID. Если задан только код, uuid
 * находится поиском по расписанию (см. resolveGroup).
 */
export function targetGroup() {
  const code = stripCampus((process.env.TAHVEL_GROUP || DEFAULT_GROUP.code).trim());
  const uuid = (process.env.TAHVEL_GROUP_UUID || "").trim();
  // uuid по умолчанию годится только для группы по умолчанию
  return { code, uuid: uuid || (code === DEFAULT_GROUP.code ? DEFAULT_GROUP.uuid : null) };
}

/* ---------------- поиск группы по коду ---------------- */

let groupsCache = null; // { at: number, groups: [{code, uuid}] }

/**
 * Группы школы: справочник закрыт, поэтому собираем уникальные группы из
 * самих событий. Одна неделя показывает не всех: на каникулах и в конце
 * семестра занятия есть у единиц, поэтому берём окно в три недели, а если и
 * там пусто — сдвигаемся ещё на три недели вперёд.
 */
async function fetchGroups({ force = false } = {}) {
  if (!force && groupsCache && Date.now() - groupsCache.at < GROUPS_TTL_MS) {
    return groupsCache.groups;
  }

  const found = new Map();
  let monday = mondayOf(todayIso());
  for (let attempt = 0; attempt < 3 && found.size === 0; attempt++) {
    const events = await fetchEvents({
      weekStart: monday,
      weekEnd: addDays(monday, WINDOW_DAYS - 1),
    });
    for (const event of events) {
      for (const group of event.studentGroups ?? []) {
        if (group?.code && group?.uuid) found.set(group.uuid, stripCampus(group.code));
      }
    }
    monday = addDays(monday, WINDOW_DAYS);
  }

  if (!found.size) {
    throw new TahvelError(
      "Tahvel не вернул ни одной группы за ближайшие девять недель.",
      "tahvel_no_groups"
    );
  }

  const groups = [...found.entries()]
    .map(([uuid, code]) => ({ code, uuid }))
    .sort((a, b) => a.code.localeCompare(b.code, "et"));

  groupsCache = { at: Date.now(), groups };
  return groups;
}

/** Код группы → uuid. Регистр и префикс корпуса не важны. */
export async function resolveGroup(code) {
  const wanted = stripCampus(String(code || "")).toLowerCase();
  const groups = await fetchGroups();
  return groups.find((g) => g.code.toLowerCase() === wanted) ?? null;
}
