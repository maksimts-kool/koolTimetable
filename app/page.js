import Link from "next/link";
import IcalLink from "@/components/IcalLink";
import Timetable from "@/components/Timetable";
import WeekPicker from "@/components/WeekPicker";
import { getWeek, listWeeks } from "@/lib/store";
import { ruDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }) {
  const params = await searchParams;
  const weeks = await listWeeks();

  if (!weeks.length) {
    return (
      <main className="wrap">
        <header className="head">
          <div>
            <p className="eyebrow">Tallinna Tehnoloogiakolledž</p>
            <h1>Tunniplaan</h1>
          </div>
        </header>
        <div className="empty-state">
          <b>Пока ни одной недели</b>
          Синхронизируйте расписание с Tahvel в <Link href="/admin">админке</Link> — или загрузите
          PDF-выгрузку.
        </div>
      </main>
    );
  }

  const selected = weeks.find((w) => w.id === params?.w) ?? weeks[0];
  const week = await getWeek(selected.id);
  const minutes = week.lessonCount * 45;
  const hours =
    Math.floor(minutes / 60) + (minutes % 60 ? `:${String(minutes % 60).padStart(2, "0")}` : "");

  return (
    <main className="wrap">
      <header className="head">
        <div>
          <p className="eyebrow">
            Tallinna Tehnoloogiakolledž · {ruDate(week.weekStart)} – {ruDate(week.weekEnd)}
          </p>
          <h1>
            Tunniplaan
            <span className="grp">
              {week.group}
              {week.programme ? ` · ${week.programme}` : ""}
            </span>
          </h1>
        </div>
        <div className="right">
          <WeekPicker weeks={weeks} current={selected.id} />
          <div className="stats">
            <div className="stat">
              <b>{week.lessonCount}</b>
              <span>уроков</span>
            </div>
            <div className="stat">
              <b>{hours}</b>
              <span>часов</span>
            </div>
            <div className="stat">
              <b>{week.days.length}</b>
              <span>учебных дней</span>
            </div>
          </div>
        </div>
      </header>

      <Timetable week={week} />

      <footer>
        <span>Источник: {week.fileName}</span>
        <span>
          {week.source === "tahvel" ? "Обновлено" : "Загружено"}{" "}
          {new Date(week.uploadedAt).toLocaleDateString("ru-RU")}
        </span>
        <span>Урок = 45 мин · пунктир внутри блока = граница урока</span>
        <IcalLink />
        <Link href="/admin">Админка</Link>
      </footer>
    </main>
  );
}
