/**
 * Синхронизация расписания из внешних источников: неделя, несколько недель
 * вперёд и сводка по результату. Этим пользуется и кнопка в админке, и
 * суточный крон.
 *
 * Источников два, и берутся они по порядку:
 *   tahvel  — основной, у него полные имена преподавателей;
 *   edupage — запасной: в Tahvel расписание выкладывают не всегда, а школа
 *             параллельно публикует его на своей странице EduPage.
 * К следующему переходим, только если предыдущий не дал ни одного занятия
 * (или вовсе не ответил): подменять уже полученное расписание незачем.
 */

import { addDays, mondayOf, todayIso } from "./lessons.js";
import * as edupage from "./edupage.js";
import * as tahvel from "./tahvel.js";
import { getWeek, listWeeks, saveWeek, weekId } from "./store.js";

export const MAX_WEEKS = 8;
export const DEFAULT_WEEKS = 3;

/** Синхронизация не началась: ни один источник не годится. */
export class SyncError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * Адаптеры источников. `resolve` возвращает то, что нужно `fetchWeek` этого же
 * источника (Tahvel хочет uuid группы, EduPage — только код), либо null, если
 * группы там нет. `label` попадает в поле «Источник» на странице недели.
 */
const SOURCES = {
  tahvel: {
    name: "tahvel",
    label: "Tahvel",
    resolve: async (code) => {
      const { uuid } = tahvel.targetGroup();
      return uuid ? { code, uuid } : tahvel.resolveGroup(code);
    },
    fetchWeek: (group, weekStart) => tahvel.fetchWeek({ ...group, weekStart }),
  },
  edupage: {
    name: "edupage",
    label: "EduPage",
    resolve: (code) => edupage.resolveGroup(code),
    fetchWeek: (group, weekStart) => edupage.fetchWeek({ ...group, weekStart }),
  },
};

const DEFAULT_ORDER = ["tahvel", "edupage"];

/** Порядок источников: SCHEDULE_SOURCES=tahvel,edupage — можно сузить или поменять местами. */
function sourceOrder() {
  const listed = (process.env.SCHEDULE_SOURCES || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => SOURCES[s]);
  return (listed.length ? listed : DEFAULT_ORDER).map((s) => SOURCES[s]);
}

/**
 * Сравниваем только расписание: время синхронизации меняется всегда. Имена
 * преподавателей при этом отбрасываем — Tahvel даёт имя и фамилию, EduPage
 * только фамилию, и на одном этом отличии неделя переписывалась бы туда-сюда
 * при каждом переключении источника.
 */
const scheduleKey = (week) =>
  JSON.stringify(
    (week?.days ?? []).map((day) => ({
      ...day,
      blocks: day.blocks.map(({ teacher, ...rest }) => rest),
    }))
  );

/** Место источника в очереди: чем меньше, тем он предпочтительнее. */
function rankOf(name) {
  const i = sourceOrder().findIndex((s) => s.name === name);
  return i < 0 ? Number.POSITIVE_INFINITY : i; // чужая неделя (PDF) уступает любому источнику
}

/**
 * Стоит ли перезаписывать уже сохранённую неделю.
 * Расписание изменилось — да, всегда. Совпало — только если новый источник не
 * хуже прежнего: иначе запасной EduPage при первой же осечке Tahvel затирал бы
 * полные имена преподавателей своими фамилиями.
 */
function shouldReplace(existing, week, source) {
  if (!existing) return true;
  if (scheduleKey(existing) !== scheduleKey(week)) return true;
  if (rankOf(source.name) > rankOf(existing.source)) return false;
  return JSON.stringify(existing.days) !== JSON.stringify(week.days);
}

/**
 * Первая неделя с занятиями — по порядку источников.
 * Отказ источника не обрывает синхронизацию: он запоминается и, если ни один
 * не сработал, уходит в отчёт.
 */
async function firstNonEmptyWeek(available, weekStart) {
  const problems = [];

  for (const { source, group } of available) {
    try {
      const week = await source.fetchWeek(group, weekStart);
      if (week.lessonCount) return { week, source, problems };
    } catch (e) {
      problems.push(`${source.label}: ${e.message}`);
    }
  }

  return { week: null, source: null, problems };
}

/**
 * Одна неделя одной группы.
 * @returns {Promise<{weekStart, group, status: 'created'|'updated'|'unchanged'|'empty', lessonCount, source?, problems?}>}
 */
export async function syncWeek({ available, weekStart, programme = "" }) {
  const monday = mondayOf(weekStart);
  const { week, source, problems } = await firstNonEmptyWeek(available, monday);

  const group = week?.group || available[0]?.group?.code || "";
  const head = {
    id: weekId(group, monday),
    weekStart: monday,
    weekEnd: addDays(monday, 6),
    group,
    ...(problems.length ? { problems } : {}),
  };

  // Пустую неделю не сохраняем: каникулы — не повод стирать уже показанную неделю.
  if (!week) return { ...head, status: "empty", lessonCount: 0 };

  const existing = await getWeek(head.id);
  if (!shouldReplace(existing, week, source)) {
    return { ...head, status: "unchanged", lessonCount: week.lessonCount, source: source.name };
  }

  await saveWeek({
    ...week,
    id: head.id,
    // названия учебной программы нет ни у Tahvel, ни у EduPage — берём то, что дал PDF
    programme: existing?.programme || programme,
    fileName: source.label,
    uploadedAt: new Date().toISOString(),
  });

  return {
    ...head,
    status: existing ? "updated" : "created",
    lessonCount: week.lessonCount,
    source: source.name,
  };
}

/**
 * Группа во всех настроенных источниках. Источник, который не ответил или не
 * знает такой группы, просто выпадает из списка — лишь бы остался хоть один.
 */
async function resolveSources(code) {
  const found = await Promise.all(
    sourceOrder().map(async (source) => {
      try {
        const group = await source.resolve(code);
        return group ? { source, group } : null;
      } catch {
        return null; // источник недоступен — попробуем остальные
      }
    })
  );
  return found.filter(Boolean);
}

/** Текущая неделя и `weeks - 1` следующих. */
export async function sync({ weeks = DEFAULT_WEEKS, from = todayIso() } = {}) {
  const { code } = tahvel.targetGroup();
  const available = await resolveSources(code);
  if (!available.length) {
    throw new SyncError(
      `Группа «${code}» не найдена ни в одном источнике (${sourceOrder()
        .map((s) => s.label)
        .join(", ")}).`,
      "group_not_found"
    );
  }

  // учебной программы в API нет: подставляем ту, что уже известна по этой группе
  const programme = (await listWeeks()).find((w) => w.group === code && w.programme)?.programme || "";

  const count = Math.min(Math.max(Number(weeks) || DEFAULT_WEEKS, 1), MAX_WEEKS);
  const monday = mondayOf(from);

  // Недели независимы друг от друга, а каждая — это поход наружу и обратно.
  // Подряд они складывались в ожидание в несколько раз длиннее нужного; сами
  // клиенты уже ходят пачками, так что параллель им не в новинку.
  // Promise.all сохраняет порядок — сводка остаётся по возрастанию дат.
  const results = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      syncWeek({ available, programme, weekStart: addDays(monday, i * 7) })
    )
  );

  return { group: code, results };
}

/** Короткая сводка по результату — для ответа крона и логов. */
export function summarize(results) {
  const count = (status) => results.filter((r) => r.status === status).length;
  return {
    weeks: results.length,
    created: count("created"),
    updated: count("updated"),
    unchanged: count("unchanged"),
    empty: count("empty"),
    // из какого источника пришла каждая сохранённая неделя
    bySource: results.reduce((acc, r) => {
      if (r.source) acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    }, {}),
  };
}
