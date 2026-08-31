/**
 * Публичная лента расписания в формате iCalendar.
 *
 *   /tunniplaan.ics            — все сохранённые недели
 *   /tunniplaan.ics?group=…    — только одна группа (если в базе их несколько)
 *   /tunniplaan.ics?past=2     — не отдавать недели старше двух прошедших
 *   /tunniplaan.ics?hide=eesti-b2 — без предметов, на которые студент не ходит
 *
 * Подписка идёт по webcal://, поэтому эндпоинт открыт и отвечает 200 даже
 * когда недель нет: клиент календаря не должен отваливаться из-за пустой базы.
 */

import { buildCalendar } from "@/lib/ical";
import { hideSubjects, parseHidden } from "@/lib/optional";
import { addDays, mondayOf, todayIso } from "@/lib/lessons";
import { getWeek, listWeeks } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEEKS = 60; // потолок на случай, если база разрослась

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const group = (searchParams.get("group") || "").trim().toLowerCase();
  const past = Number(searchParams.get("past"));
  const hidden = parseHidden(searchParams.get("hide"));

  let metas = await listWeeks(); // от свежих к старым
  if (group) metas = metas.filter((w) => String(w.group || "").toLowerCase() === group);
  if (Number.isFinite(past) && past >= 0) {
    const earliest = addDays(mondayOf(todayIso()), -7 * past);
    metas = metas.filter((w) => w.weekStart >= earliest);
  }
  metas = metas.slice(0, MAX_WEEKS);

  const weeks = (await Promise.all(metas.map((m) => getWeek(m.id))))
    .filter(Boolean)
    .map((w) => hideSubjects(w, hidden));

  const groups = [...new Set(weeks.map((w) => w.group).filter(Boolean))];
  const name = groups.length ? `Tunniplaan ${groups.join(", ")}` : "Tunniplaan";

  // SOURCE должен вести на эту же ленту: клиент перечитывает её по этому адресу
  const query = new URLSearchParams();
  if (group) query.set("group", group);
  if (hidden.size) query.set("hide", [...hidden].join(","));
  const search = query.toString();
  const url = `${origin}/tunniplaan.ics${search ? `?${search}` : ""}`;

  const body = buildCalendar(weeks, {
    name,
    description: "Расписание занятий Tallinna Tehnoloogiakolledž",
    url,
  });

  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="tunniplaan.ics"',
      // недели обновляются кроном раз в сутки: получасового кэша хватает,
      // а клиенты календарей и так ходят не чаще
      "cache-control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
