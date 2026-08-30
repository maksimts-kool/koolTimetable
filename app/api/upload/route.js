import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { parseTimetablePdf, ParseError } from "@/lib/parsePdf";
import { getWeek, saveWeek, weekId } from "@/lib/store";
import { plural, ruDate } from "@/lib/format";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SIZE = 5 * 1024 * 1024; // 5 МБ — реальная выгрузка весит ~11 КБ
const PDF_MAGIC = "%PDF-";

const fail = (error, status, extra = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(request) {
  if (!(await isAdmin())) {
    return fail("Нужен вход администратора.", 401);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return fail("Не удалось прочитать форму загрузки.", 400);
  }

  const file = form.get("file");
  const replace = form.get("replace") === "1";

  if (!file || typeof file === "string") {
    return fail("Файл не выбран.", 400);
  }
  if (file.size === 0) {
    return fail("Файл пустой.", 400);
  }
  if (file.size > MAX_SIZE) {
    return fail(`Файл больше 5 МБ (${(file.size / 1024 / 1024).toFixed(1)} МБ). Это точно выгрузка расписания?`, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (header !== PDF_MAGIC) {
    return fail("Это не PDF: файл не начинается с сигнатуры %PDF-.", 400);
  }

  let week;
  try {
    week = await parseTimetablePdf(bytes);
  } catch (e) {
    if (e instanceof ParseError) {
      // причина от pdf.js нужна в логах, но наружу её не отдаём
      if (e.cause) console.error("pdf open failed", e.cause);
      return fail(e.message, 422, { code: e.code });
    }
    console.error("parse failed", e);
    return fail("Не удалось разобрать расписание из этого PDF.", 422);
  }

  const id = weekId(week.group, week.weekStart);
  const existing = await getWeek(id);
  if (existing && !replace) {
    return NextResponse.json(
      {
        error: `Неделя ${ruDate(week.weekStart)} – ${ruDate(week.weekEnd)} для группы ${
          week.group
        } уже загружена ${new Date(existing.uploadedAt).toLocaleDateString("ru-RU")}, в ней ${plural(
          existing.lessonCount
        )}.`,
        duplicate: true,
        existing: {
          lessonCount: existing.lessonCount,
          uploadedAt: existing.uploadedAt,
          fileName: existing.fileName,
        },
        parsed: { lessonCount: week.lessonCount, days: week.days.length },
      },
      { status: 409 }
    );
  }

  const record = {
    ...week,
    id,
    fileName: file.name || "tunniplaan.pdf",
    uploadedAt: new Date().toISOString(),
  };
  await saveWeek(record);

  return NextResponse.json({
    ok: true,
    replaced: Boolean(existing),
    week: {
      id,
      group: record.group,
      programme: record.programme,
      weekStart: record.weekStart,
      weekEnd: record.weekEnd,
      lessonCount: record.lessonCount,
      days: record.days.map((d) => ({
        weekday: d.weekday,
        date: d.date,
        lessons: d.blocks.reduce((s, b) => s + b.lessons, 0),
        subjects: [...new Set(d.blocks.map((b) => b.subject))],
      })),
    },
  });
}
