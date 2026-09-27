import Link from "next/link";
import WeekView from "@/components/WeekView";
import { getWeek, latestWeek, listSubjects, listWeeks } from "@/lib/store";

/**
 * Неделя из хранилища — общая часть главной страницы и её встраиваемой версии
 * (`/embed`). Серверный компонент: ждёт базу внутри Suspense страницы.
 *
 * @param wanted id недели из адреса (`?w=`), может отсутствовать
 * @param embed страница открыта во фрейме на чужом сайте
 */
export default async function WeekPage({ wanted, embed = false }) {
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

  // ?w= с чужим или удалённым id — откатываемся на свежую неделю
  const selected = weeks.find((w) => w.id === wanted) ?? weeks[0];
  const week = preloaded?.id === selected.id ? preloaded : await getWeek(selected.id);

  return (
    <WeekView week={week} weeks={weeks} current={selected.id} subjects={subjects} embed={embed} />
  );
}
