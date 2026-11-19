import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import WeekSkeleton from "@/components/Skeletons";
import WeekPage from "@/components/WeekPage";
import { targetGroup } from "@/lib/tahvel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Расписание недели · Tunniplaan" };

/**
 * Неделя сеткой. Каркас страницы уходит в браузер сразу, не дожидаясь базы,
 * а неделя дорисовывается поверх заглушки, когда придёт.
 */
export default async function Page({ searchParams }) {
  const params = await searchParams;

  return (
    <>
      <SiteHeader active="week" group={targetGroup().code} />
      <main className="wrap">
        {/* key: при переходе на другую неделю нужна та же заглушка, а не
            застывшее расписание предыдущей */}
        <Suspense key={params?.w ?? ""} fallback={<WeekSkeleton />}>
          <WeekPage wanted={params?.w} />
        </Suspense>
      </main>
    </>
  );
}
