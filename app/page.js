import { redirect } from "next/navigation";
import { Suspense } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { TodaySkeleton } from "@/components/Skeletons";
import TodayView from "@/components/TodayView";
import { tallinnClock } from "@/lib/day";
import { addDays } from "@/lib/lessons";
import { listSubjects, listWeeksFull } from "@/lib/store";
import { targetGroup } from "@/lib/tahvel";

export const dynamic = "force-dynamic";

/**
 * Главная — «Сегодня»: что идёт сейчас, что дальше и план дня. Шапка уходит в
 * браузер сразу, а день дорисовывается, когда ответит база.
 */
export default async function Page({ searchParams }) {
  const params = await searchParams;
  // старые ссылки на неделю (/?w=…) ведут теперь на её страницу
  if (params?.w) redirect(`/week?w=${encodeURIComponent(params.w)}`);

  return (
    <>
      <SiteHeader active="today" group={targetGroup().code} />
      <main className="wrap wrap-today">
        <Suspense fallback={<TodaySkeleton />}>
          <Today />
        </Suspense>
      </main>
    </>
  );
}

async function Today() {
  const now = tallinnClock();
  const [all, subjects] = await Promise.all([listWeeksFull(), listSubjects()]);
  // неделя назад — запас для симуляции времени из админки
  const from = addDays(now.day, -7);
  const weeks = all.filter((w) => w.weekEnd >= from);

  if (!weeks.length) {
    return (
      <div className="empty-state">
        <b>Расписание пока не опубликовано</b>
        Синхронизируйте его в <a href="/admin">админке</a>.
      </div>
    );
  }

  const meta = weeks.findLast((w) => w.weekEnd >= now.day) ?? weeks[0];

  return (
    <>
      <TodayView weeks={weeks} subjects={subjects} initialNow={now} />
      <SiteFooter week={meta} />
    </>
  );
}
