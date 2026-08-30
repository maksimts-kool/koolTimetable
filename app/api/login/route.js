import { NextResponse } from "next/server";
import { adminConfigured, checkPassword, startSession } from "@/lib/auth";

export const runtime = "nodejs";

// Простейшая защита от перебора: счётчик попыток на процесс.
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const LIMIT = 10;

function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = attempts.get(ip)?.filter((t) => now - t < WINDOW) ?? [];
  attempts.set(ip, rec);
  return rec.length >= LIMIT;
}

function noteAttempt(ip) {
  attempts.set(ip, [...(attempts.get(ip) ?? []), Date.now()]);
}

export async function POST(request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Пароль администратора не задан: добавьте переменную окружения ADMIN_PASSWORD." },
      { status: 503 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (tooManyAttempts(ip)) {
    return NextResponse.json(
      { error: "Слишком много попыток входа. Попробуйте через 15 минут." },
      { status: 429 }
    );
  }

  const { password } = await request.json().catch(() => ({}));
  if (!checkPassword(password)) {
    noteAttempt(ip);
    return NextResponse.json({ error: "Неверный пароль." }, { status: 401 });
  }

  attempts.delete(ip);
  await startSession();
  return NextResponse.json({ ok: true });
}
