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
import { listWeeksFull } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEEKS = 60; // потолок на случай, если база разрослась

/**
 * Внешний адрес сайта. За прокси хостинга (mod_proxy на Zone) request.url
 * указывает на внутренний адрес приложения — вышло бы https://localhost:3210,
 * и календарь, перечитывающий ленту по SOURCE, стучался бы в никуда. Прокси
 * передаёт настоящий хост в X-Forwarded-Host.
 */
function publicOrigin(request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (!host) return url.origin;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
  return `${proto}://${host}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const group = (searchParams.get("group") || "").trim().toLowerCase();
  const past = Number(searchParams.get("past"));
  const hidden = parseHidden(searchParams.get("hide"));

  // Недели читаем одним запросом: раньше был список, а потом ещё по запросу на
  // каждую из них — на полной базе это до 61 обращения к хранилищу на одну ленту.
  let all = await listWeeksFull(); // от свежих к старым
  if (group) all = all.filter((w) => String(w.group || "").toLowerCase() === group);
  if (Number.isFinite(past) && past >= 0) {
    const earliest = addDays(mondayOf(todayIso()), -7 * past);
    all = all.filter((w) => w.weekStart >= earliest);
  }

  const weeks = all.slice(0, MAX_WEEKS).map((w) => hideSubjects(w, hidden));

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
