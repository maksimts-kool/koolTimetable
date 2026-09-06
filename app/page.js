import Link from "next/link";
import { Suspense } from "react";
import WeekSkeleton from "@/components/Skeletons";
import WeekView from "@/components/WeekView";
import { getWeek, latestWeek, listSubjects, listWeeks } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Каркас страницы уходит в браузер сразу, не дожидаясь базы: она отвечает
 * то мгновенно, то через несколько секунд (холодный старт Supabase), и всё это
 * время пользователь смотрел на пустой экран. Теперь ожидание закрыто
 * заглушкой, а неделя дорисовывается поверх неё, когда придёт.
 */
export default async function Page({ searchParams }) {
  const params = await searchParams;

  return (
    <main className="wrap">
      {/* key: при переходе на другую неделю нужна та же заглушка, а не
          застывшее расписание предыдущей */}
      <Suspense key={params?.w ?? ""} fallback={<WeekSkeleton />}>
        <Week wanted={params?.w} />
      </Suspense>
    </main>
  );
}

async function Week({ wanted }) {
  // Список недель, саму неделю и предметы тянем разом: какая неделя нужна,
  // видно уже из адреса, а без него нужна самая свежая — она же первая в
  // списке. Раньше это были запросы подряд, и страница ждала все задержки
  // последовательно.
  const [weeks, preloaded, subjects] = await Promise.all([
    listWeeks(),
    wanted ? getWeek(wanted) : latestWeek(),
    listSubjects(),
  ]);

  if (!weeks.length) {
    return (
      <>
        <header className="head">
          <div>
            <p className="eyebrow">Tallinna Tehnoloogiakolledž</p>
            <h1>Tunniplaan</h1>
          </div>
        </header>
        <div className="empty-state">
          <b>Пока ни одной недели</b>
          Синхронизируйте расписание в <Link href="/admin">админке</Link> — или загрузите
          PDF-выгрузку.
        </div>
      </>
    );
  }

  // ?w= с чужим или удалённым id — откатываемся на свежую неделю
  const selected = weeks.find((w) => w.id === wanted) ?? weeks[0];
  const week = preloaded?.id === selected.id ? preloaded : await getWeek(selected.id);

  return <WeekView week={week} weeks={weeks} current={selected.id} subjects={subjects} />;
}
