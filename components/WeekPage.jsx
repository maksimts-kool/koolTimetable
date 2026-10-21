import Link from "next/link";
import WeekView from "@/components/WeekView";
import { tallinnClock } from "@/lib/day";
import { currentWeek, getWeek, listSubjects, listWeeks, pickCurrent } from "@/lib/store";

/**
 * Неделя из хранилища — общая часть главной страницы и её встраиваемой версии
 * (`/embed`). Серверный компонент: ждёт базу внутри Suspense страницы.
 *
 * @param wanted id недели из адреса (`?w=`), может отсутствовать
 * @param embed страница открыта во фрейме на чужом сайте
 */
export default async function WeekPage({ wanted, embed = false }) {
  // время сервера: с ним совпадает первая отрисовка живых частей страницы
  const now = tallinnClock();

  // Список недель, саму неделю и предметы тянем разом: какая неделя нужна,
  // видно уже из адреса, а без него — текущая. Раньше это были запросы
  // подряд, и страница ждала все задержки последовательно.
  const [weeks, preloaded, subjects] = await Promise.all([
    listWeeks(),
    wanted ? getWeek(wanted) : currentWeek(now.day),
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
          {embed ? null : (
            <>
              Синхронизируйте расписание в <Link href="/admin">админке</Link> — или загрузите
              PDF-выгрузку.
            </>
          )}
        </div>
      </>
    );
  }

  // ?w= с чужим или удалённым id — откатываемся на текущую неделю
  const selected = weeks.find((w) => w.id === wanted) ?? pickCurrent(weeks, now.day);
  const week = preloaded?.id === selected.id ? preloaded : await getWeek(selected.id);

  return (
    <WeekView
      week={week}
      weeks={weeks}
      current={selected.id}
      subjects={subjects}
      initialNow={now}
      embed={embed}
    />
  );
}
