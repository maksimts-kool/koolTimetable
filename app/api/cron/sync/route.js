/**
 * Плановое обновление расписания. Раз в сутки его вызывает zone/cron.sh из
 * Crontab на Zone: если задан CRON_SECRET, скрипт шлёт его в заголовке
 * Authorization — по нему и пускаем. Без CRON_SECRET эндпоинт открыт только администратору.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { DEFAULT_WEEKS, summarize, sync } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function allowed(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return isAdmin();
}

export async function GET(request) {
  if (!(await allowed(request))) {
    return NextResponse.json({ error: "Нужен вход администратора или CRON_SECRET." }, { status: 401 });
  }

  const weeks = Number(process.env.TAHVEL_WEEKS_AHEAD) || DEFAULT_WEEKS;
  const startedAt = Date.now();

  try {
    const { group, results } = await sync({ weeks });
    const summary = summarize(results);
    console.log("cron sync", { group, ...summary, ms: Date.now() - startedAt });
    return NextResponse.json({ ok: true, group, ...summary, results });
  } catch (e) {
    console.error("cron sync failed", e);
    return NextResponse.json({ error: e.message || "Синхронизация не удалась." }, { status: 500 });
  }
}
