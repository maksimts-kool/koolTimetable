import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { DEFAULT_WEEKS, SyncError, sync } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Нужен вход администратора." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const { group, results } = await sync({ weeks: body.weeks ?? DEFAULT_WEEKS });
    return NextResponse.json({ ok: true, group, results });
  } catch (e) {
    // Отказ отдельного источника синхронизацию не роняет (его берёт на себя
    // sync), сюда доходит только «идти вовсе некуда».
    if (e instanceof SyncError) {
      const status = e.code === "group_not_found" ? 404 : 502;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    console.error("sync failed", e);
    return NextResponse.json({ error: "Синхронизация не удалась." }, { status: 500 });
  }
}
