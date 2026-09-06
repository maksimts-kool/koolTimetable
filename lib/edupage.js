/**
 * Клиент публичного расписания EduPage (aSc Timetables).
 *
 * Запасной источник к Tahvel: там расписание появляется не всегда, а школа
 * параллельно публикует его на mustamae-techno.edupage.org. Авторизация не
 * нужна — те же два запроса делает и сам просмотрщик на сайте школы:
 *   ttviewer.js#getTTViewerData  — список опубликованных расписаний;
 *   regulartt.js#regularttGetData — одно расписание целиком.
 *
 * Формат ответа — «база» aSc: таблицы classes/subjects/teachers/classrooms/
 * lessons/cards. Урок (lesson) описывает предмет, преподавателя и группы,
 * карточка (card) ставит его в конкретный день и урочный час. Отсюда и
 * собираются те же дни с блоками, что даёт Tahvel.
 */

import {
  addDays,
  dmyDate,
  mergeLessons,
  mondayOf,
  stripCampus,
  toMinutes,
  weekdayOf,
} from "./lessons.js";

const SCHOOL = process.env.EDUPAGE_SCHOOL || "mustamae-techno";
const BASE = process.env.EDUPAGE_BASE_URL || `https://${SCHOOL}.edupage.org`;
const TIMEOUT_MS = 20_000;
const TTL_MS = 10 * 60 * 1000;
// Год в getTTViewerData на состав списка не влияет, но параметр обязателен.
const ANY_YEAR = new Date().getUTCFullYear();
// Подпись запроса просмотрщика: для открытых данных не проверяется.
const GSH = "00000000";

export class EdupageError extends Error {
  constructor(message, code, options) {
    super(message, options);
    this.code = code;
  }
}

/** Запрос к серверному «функционалу» EduPage: все они устроены одинаково. */
async function call(endpoint, func, args) {
  const url = `${BASE}/timetable/server/${endpoint}?__func=${func}`;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ __args: args, __gsh: GSH }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut = cause?.name === "TimeoutError" || cause?.name === "AbortError";
    throw new EdupageError(
      timedOut
        ? "EduPage не ответил за 20 секунд. Попробуйте ещё раз."
        : "Не удалось связаться с EduPage. Проверьте соединение.",
      timedOut ? "edupage_timeout" : "edupage_unreachable",
      { cause }
    );
  }

  if (!res.ok) {
    throw new EdupageError(
      `EduPage ответил ошибкой ${res.status}. Возможно, школа закрыла расписание.`,
      "edupage_http_error"
    );
  }

  let body;
  try {
    body = await res.json();
  } catch (cause) {
    throw new EdupageError("EduPage вернул не JSON — похоже, ответила не та страница.", "edupage_bad_json", {
      cause,
    });
  }

  // Свою ошибку EduPage кладёт в тело с кодом 200: {"e":"Error: …","em":"…"}
  if (body?.e) {
    throw new EdupageError(`EduPage вернул ошибку: ${body.em || body.e}`, "edupage_api_error");
  }
  if (!body?.r) {
    throw new EdupageError("EduPage вернул ответ без данных.", "edupage_bad_shape");
  }
  return body.r;
}

/* ---------------- список опубликованных расписаний ---------------- */

/**
 * «(31. 08. - 06. 09. 2026)» в подписи расписания → период действия.
 * Год стоит только в конце: у периода через Новый год начало берёт год на
 * единицу меньше, иначе конец оказался бы раньше начала.
 */
function rangeFromText(text) {
  const m = /\((\d{1,2})\.\s*(\d{1,2})\.\s*-\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\)/.exec(text || "");
  if (!m) return null;

  const [, d1, m1, d2, m2, year] = m;
  const pad = (n) => String(n).padStart(2, "0");
  const startYear = Number(m1) > Number(m2) ? Number(year) - 1 : Number(year);
  return {
    from: `${startYear}-${pad(m1)}-${pad(d1)}`,
    thru: `${year}-${pad(m2)}-${pad(d2)}`,
  };
}

/**
 * Кэш с временем жизни, хранящий сам промис, а не результат.
 *
 * Недели синхронизируются параллельно, и каждая спрашивает те же список
 * расписаний и расписание целиком (около мегабайта). По готовому результату
 * они бы разминулись и выкачали всё по разу на неделю — поэтому в кэш кладётся
 * незавершённый запрос, а сорвавшийся оттуда убирается, чтобы не залипнуть на
 * отказе до конца TTL.
 */
function memo(store) {
  return (key, load) => {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

    const promise = load().catch((e) => {
      if (store.get(key)?.promise === promise) store.delete(key);
      throw e;
    });
    store.set(key, { at: Date.now(), promise });
    return promise;
  };
}

const cached = memo(new Map());

/**
 * Опубликованные расписания с периодом действия каждого.
 *
 * Школа выкладывает по расписанию на неделю, но aSc позволяет и одно на
 * семестр — поэтому период берём из подписи, а если её формат другой,
 * расписание действует до начала следующего. Последнее в списке ограничиваем
 * неделей: иначе оно «размножилось» бы на все будущие недели.
 */
const listTimetables = () => cached("timetables", loadTimetables);

async function loadTimetables() {
  const r = await call("ttviewer.js", "getTTViewerData", [null, ANY_YEAR]);
  const raw = (r.regular?.timetables ?? [])
    .filter((t) => t && !t.hidden && t.datefrom)
    .sort((a, b) => a.datefrom.localeCompare(b.datefrom));

  return raw.map((t, i) => {
    const parsed = rangeFromText(t.text);
    const next = raw[i + 1];
    return {
      num: String(t.tt_num),
      text: t.text || "",
      from: t.datefrom,
      thru: parsed?.thru || (next ? addDays(next.datefrom, -1) : addDays(t.datefrom, 6)),
    };
  });
}

/** Расписание, действующее в неделю с понедельника `monday`. */
async function timetableFor(monday) {
  const sunday = addDays(monday, 6);
  const timetables = await listTimetables();
  // Достаточно пересечения с неделей: период может начинаться и в её середине.
  return timetables.find((t) => t.from <= sunday && t.thru >= monday) ?? null;
}

/* ---------------- разбор «базы» aSc ---------------- */

const indexById = (rows) => new Map((rows ?? []).map((row) => [row.id, row]));

/** Одно расписание целиком: справочники и карточки, разложенные по id. */
const fetchTimetable = (num) => cached(`tt:${num}`, () => loadTimetable(num));

async function loadTimetable(num) {
  const r = await call("regulartt.js", "regularttGetData", [null, String(num)]);
  const tables = r.dbiAccessorRes?.tables;
  if (!Array.isArray(tables)) {
    throw new EdupageError("EduPage вернул расписание без таблиц.", "edupage_bad_shape");
  }

  const rows = Object.fromEntries(tables.map((t) => [t.id, t.data_rows ?? []]));
  return {
    // Порядок урочных часов важен: по нему считается конец сдвоенного урока.
    periods: (rows.periods ?? []).slice().sort((a, b) => Number(a.period) - Number(b.period)),
    classes: rows.classes ?? [],
    lessons: indexById(rows.lessons),
    cards: rows.cards ?? [],
    subjects: indexById(rows.subjects),
    teachers: indexById(rows.teachers),
    classrooms: indexById(rows.classrooms),
    groups: indexById(rows.groups),
  };
}

const nameOf = (row) => row?.name || row?.short || "";

/**
 * Кабинеты в выгрузках названы вразнобой: то «M-A119», то «RM_M-A115» —
 * служебный префикс срезаем, чтобы номер совпадал с тем, что даёт Tahvel.
 */
const roomName = (row) => stripCampus(nameOf(row).replace(/^(?:RM|Ruum)[_-]/i, "").trim());

/**
 * Урочные часы, которые занимает карточка: `durationperiods` считает подряд
 * идущие часы, а не минуты — между ними бывают перемены, поэтому нужен именно
 * список часов, а не «начало плюс сорок пять минут».
 */
function periodsOf(db, startPeriod, duration) {
  const start = db.periods.findIndex((p) => String(p.period) === String(startPeriod));
  if (start < 0) return [];
  const count = Math.max(Number(duration) || 1, 1);
  return db.periods.slice(start, start + count);
}

/**
 * Названия групп урока: если занят весь класс, хватает его кода, иначе к коду
 * добавляем подгруппу — «TARpv24 (Grupp 1)».
 */
function groupNames(lesson, db) {
  const classNames = (lesson.classids ?? [])
    .map((id) => nameOf(db.classes.find((c) => c.id === id)))
    .filter(Boolean);

  const subgroups = [
    ...new Set(
      (lesson.groupids ?? [])
        .map((id) => db.groups.get(id))
        .filter((g) => g && !g.entireclass && g.name)
        .map((g) => g.name)
    ),
  ];

  const suffix = subgroups.length ? ` (${subgroups.join(", ")})` : "";
  return classNames.map((name) => name + suffix);
}

const clean = (s) => s.replace(/\s+/g, " ").trim();

/** Карточка расписания → уроки по одному урочному часу (как события Tahvel). */
function cardLessons(card, lesson, db) {
  const periods = periodsOf(db, card.period, lesson.durationperiods);
  if (!periods.length) return [];

  const join = (ids, name) => clean((ids ?? []).map(name).filter(Boolean).join(", "));

  const common = {
    subject: clean(nameOf(db.subjects.get(lesson.subjectid))) || "Sündmus",
    teacher: join(lesson.teacherids, (id) => nameOf(db.teachers.get(id))),
    groups: stripCampus(clean(groupNames(lesson, db).join(", "))),
    room: join(card.classroomids, (id) => roomName(db.classrooms.get(id))),
    note: "",
  };

  return periods.map((p) => ({
    from: p.starttime.slice(0, 5),
    to: p.endtime.slice(0, 5),
    ...common,
  }));
}

/**
 * Карточки класса за неделю → дни с блоками уроков.
 * `days` карточки — маска вида «100000» от понедельника; по ней и раскладываем.
 */
function toDays(db, classId, monday) {
  const byDate = new Map();

  for (const card of db.cards) {
    const lesson = db.lessons.get(card.lessonid);
    if (!lesson || !(lesson.classids ?? []).includes(classId)) continue;

    const mask = String(card.days || "");
    for (let day = 0; day < mask.length && day < 7; day++) {
      if (mask[day] !== "1") continue;
      const date = addDays(monday, day);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(...cardLessons(card, lesson, db));
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, lessons]) => ({
      weekday: weekdayOf(date),
      date: dmyDate(date),
      blocks: mergeLessons(lessons.sort((a, b) => toMinutes(a.from) - toMinutes(b.from))),
    }))
    .filter((d) => d.blocks.length);
}

/* ---------------- публичный интерфейс ---------------- */

/** Класс по коду группы: регистр и префикс корпуса («M-») не важны. */
function findClass(classes, code) {
  const wanted = stripCampus(String(code || "")).toLowerCase();
  return classes.find((c) => stripCampus(nameOf(c)).toLowerCase() === wanted) ?? null;
}

/**
 * Расписание одной группы за неделю — в том же виде, что даёт Tahvel и разбор
 * PDF. Если на эту неделю расписания не опубликовано или в нём нет такой
 * группы, неделя возвращается пустой: что с этим делать, решает вызывающий.
 *
 * @param {{code: string, weekStart: string}} params понедельник в формате «2026-08-31»
 */
export async function fetchWeek({ code, weekStart }) {
  const monday = mondayOf(weekStart);
  const week = {
    weekStart: monday,
    weekEnd: addDays(monday, 6),
    group: stripCampus(code),
    programme: "",
    days: [],
    lessonCount: 0,
    source: "edupage",
    parsedAt: new Date().toISOString(),
  };

  const timetable = await timetableFor(monday);
  if (!timetable) return week;

  const db = await fetchTimetable(timetable.num);
  const cls = findClass(db.classes, code);
  if (!cls) return week;

  const days = toDays(db, cls.id, monday);
  return {
    ...week,
    days,
    lessonCount: days.reduce((sum, d) => sum + d.blocks.reduce((s, b) => s + b.lessons, 0), 0),
    edupageTimetable: timetable.num,
  };
}

/** Есть ли такая группа в EduPage; ищем от самого свежего расписания к старым. */
export async function resolveGroup(code) {
  for (const t of [...(await listTimetables())].reverse()) {
    const cls = findClass((await fetchTimetable(t.num)).classes, code);
    if (cls) return { code: stripCampus(nameOf(cls)) };
  }
  return null;
}
