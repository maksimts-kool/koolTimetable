import { Suspense } from "react";
import EmbedResize from "@/components/EmbedResize";
import WeekSkeleton from "@/components/Skeletons";
import WeekPage from "@/components/WeekPage";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false } };

/**
 * Расписание для встраивания во фрейм (сайт на WordPress и т. п.): без ссылки
 * на админку, с прозрачным фоном, а свою высоту страница сообщает родителю —
 * фрейм растягивается под неделю без внутренней прокрутки. Каким сайтам можно
 * встраивать, решает заголовок frame-ancestors из next.config.mjs.
 */
export default async function EmbedPage({ searchParams }) {
  const params = await searchParams;

  return (
    <main className="wrap embed">
      {/* вне Suspense: высота нужна родителю и пока показана заглушка */}
      <EmbedResize />
      <Suspense key={params?.w ?? ""} fallback={<WeekSkeleton />}>
        <WeekPage wanted={params?.w} embed />
      </Suspense>
    </main>
  );
}
