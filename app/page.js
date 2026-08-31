import Link from "next/link";
import WeekView from "@/components/WeekView";
import { getWeek, listWeeks } from "@/lib/store";

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

  return <WeekView week={week} weeks={weeks} current={selected.id} />;
}
