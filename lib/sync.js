/**
 * Синхронизация расписания из Tahvel: неделя, несколько недель вперёд и сводка
 * по результату. Этим пользуется и кнопка в админке, и суточный крон.
 */

import { addDays, mondayOf, todayIso } from "./lessons.js";
import { fetchWeek, resolveGroup, TahvelError, targetGroup } from "./tahvel.js";
import { getWeek, listWeeks, saveWeek, weekId } from "./store.js";

export const MAX_WEEKS = 8;
export const DEFAULT_WEEKS = 3;

/** Сравниваем только расписание: время синхронизации меняется всегда. */
const sameSchedule = (a, b) => JSON.stringify(a?.days) === JSON.stringify(b?.days);

/**
 * Одна неделя одной группы.
 * @returns {Promise<{weekStart, group, status: 'created'|'updated'|'unchanged'|'empty', lessonCount}>}
 */
export async function syncWeek({ code, uuid, weekStart, programme = "" }) {
  const week = await fetchWeek({ code, uuid, weekStart });
  const id = weekId(week.group, week.weekStart);
  const existing = await getWeek(id);
  const head = { id, weekStart: week.weekStart, weekEnd: week.weekEnd, group: week.group };

  // Пустую неделю не сохраняем: каникулы — не повод стирать уже показанную неделю.
  if (!week.lessonCount) return { ...head, status: "empty", lessonCount: 0 };
  if (existing && sameSchedule(existing, week)) {
    return { ...head, status: "unchanged", lessonCount: week.lessonCount };
  }

  await saveWeek({
    ...week,
    id,
    // названия учебной программы в API нет — берём то, что дал PDF
    programme: existing?.programme || programme,
    fileName: "Tahvel",
    uploadedAt: new Date().toISOString(),
  });

  return {
    ...head,
    status: existing ? "updated" : "created",
    lessonCount: week.lessonCount,
  };
}

/** Текущая неделя и `weeks - 1` следующих. */
export async function sync({ weeks = DEFAULT_WEEKS, from = todayIso() } = {}) {
  const { code, uuid } = targetGroup();
  // uuid не задан — ищем группу по коду в самом расписании
  const group = uuid ? { code, uuid } : await resolveGroup(code);
  if (!group) {
    throw new TahvelError(`Группа «${code}» не найдена в расписании Tahvel.`, "group_not_found");
  }

  // учебной программы в API нет: подставляем ту, что уже известна по этой группе
  const programme =
    (await listWeeks()).find((w) => w.group === group.code && w.programme)?.programme || "";

  const count = Math.min(Math.max(Number(weeks) || DEFAULT_WEEKS, 1), MAX_WEEKS);
  const monday = mondayOf(from);
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(await syncWeek({ ...group, programme, weekStart: addDays(monday, i * 7) }));
  }
  return { group: group.code, results };
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
  };
}
