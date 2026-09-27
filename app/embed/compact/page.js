import { Figtree } from "next/font/google";
import { Suspense } from "react";
import CompactDay from "@/components/CompactDay";
import EmbedResize from "@/components/EmbedResize";
import { assignColors } from "@/lib/colors";
import { lessonDays, tallinnNow } from "@/lib/day";
import { addDays } from "@/lib/lessons";
import { hideSubjects, parseHidden } from "@/lib/optional";
import { listSubjects, listWeeksFull } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false } };

// Шрифт сайта-родителя (тема HybridMag на WordPress): виджет стоит в его
// боковой колонке и не должен выделяться на фоне соседних блоков.
const figtree = Figtree({ subsets: ["latin", "latin-ext"], display: "swap" });

// сколько прошедших дней ещё можно пролистать стрелкой назад
const PAST_DAYS = 14;

/**
 * Компактное расписание для боковой колонки: один учебный день списком,
 * который следит за часами (см. CompactDay). Подписи по-эстонски — виджет
 * живёт на эстонском сайте.
 *
 *   /embed/compact                — сегодня или ближайший учебный день
 *   /embed/compact?d=2026-09-28   — открыть на конкретном дне
 *   /embed/compact?hide=eesti-b2  — без необязательных предметов
 */
export default async function CompactPage({ searchParams }) {
  const params = await searchParams;

  return (
    <main className={`embed compact ${figtree.className}`}>
      <EmbedResize />
      <Suspense fallback={<DaySkeleton />}>
        <Day wanted={params?.d} hide={params?.hide} />
      </Suspense>
    </main>
  );
}

async function Day({ wanted, hide }) {
  const hidden = parseHidden(hide);
  const now = tallinnNow();
  const [weeks, subjects] = await Promise.all([listWeeksFull(), listSubjects()]);
  const days = lessonDays(
    weeks.map((w) => hideSubjects(w, hidden)),
    addDays(now.day, -PAST_DAYS)
  );

  if (!days.length) return <p className="cday-empty">Tunniplaan pole veel avaldatud.</p>;

  // цвет считаем здесь: палитре нужен список всех предметов, и тащить его в
  // браузер ради одной точки у каждого урока незачем. Предметы дней добавляем
  // и сами, как в Timetable, — общий список мог отстать.
  const palette = assignColors([
    ...subjects,
    ...days.flatMap((d) => d.blocks.map((b) => b.subject)),
  ]);
  const colored = days.map((d) => ({
    ...d,
    blocks: d.blocks.map((b) => ({
      from: b.from,
      to: b.to,
      subject: b.subject,
      room: b.room,
      color: palette.get(b.subject).bg,
    })),
  }));

  return <CompactDay days={colored} wanted={wanted} initialNow={now} />;
}

function DaySkeleton() {
  return (
    <div aria-busy="true" aria-label="Laadin tunniplaani">
      <div className="cday-head">
        <span className="skel skel-line" style={{ width: 90, height: 16, margin: "0 auto" }} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="cday-skel">
          <span className="skel skel-line sm" style={{ width: 70 }} />
          <span className="skel skel-line" style={{ width: 120 + i * 18 }} />
        </div>
      ))}
    </div>
  );
}
