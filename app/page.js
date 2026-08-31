import Link from "next/link";
import WeekView from "@/components/WeekView";
import { getWeek, latestWeek, listWeeks } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }) {
  const params = await searchParams;
  const wanted = params?.w;

  // Список недель и саму неделю тянем разом: какая нужна, видно уже из адреса,
  // а без него нужна самая свежая — она же первая в списке. Раньше это были два
  // запроса подряд, и страница ждала обе задержки последовательно.
  const [weeks, preloaded] = await Promise.all([
    listWeeks(),
    wanted ? getWeek(wanted) : latestWeek(),
  ]);

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

  // ?w= с чужим или удалённым id — откатываемся на свежую неделю
  const selected = weeks.find((w) => w.id === wanted) ?? weeks[0];
  const week = preloaded?.id === selected.id ? preloaded : await getWeek(selected.id);

  return <WeekView week={week} weeks={weeks} current={selected.id} />;
}
