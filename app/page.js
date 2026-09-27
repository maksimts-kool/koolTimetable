import { Suspense } from "react";
import WeekSkeleton from "@/components/Skeletons";
import WeekPage from "@/components/WeekPage";

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
        <WeekPage wanted={params?.w} />
      </Suspense>
    </main>
  );
}
