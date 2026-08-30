import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { deleteWeek, getWeek } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { id } = await params;
  const week = await getWeek(id);
  if (!week) return NextResponse.json({ error: "Неделя не найдена." }, { status: 404 });
  return NextResponse.json(week);
}

export async function DELETE(request, { params }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Нужен вход администратора." }, { status: 401 });
  }
  const { id } = await params;
  if (!(await getWeek(id))) {
    return NextResponse.json({ error: "Неделя не найдена." }, { status: 404 });
  }
  await deleteWeek(id);
  return NextResponse.json({ ok: true });
}
