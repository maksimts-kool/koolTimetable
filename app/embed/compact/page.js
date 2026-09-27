import { Figtree } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import EmbedResize from "@/components/EmbedResize";
import { assignColors } from "@/lib/colors";
import { dayLabel, pickDay } from "@/lib/day";
import { toMinutes } from "@/lib/lessons";
import { hideSubjects, parseHidden } from "@/lib/optional";
import { listSubjects, listWeeksFull } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false } };

// Шрифт сайта-родителя (тема HybridMag на WordPress): виджет стоит в его
// боковой колонке и не должен выделяться на фоне соседних блоков.
const figtree = Figtree({ subsets: ["latin", "latin-ext"], display: "swap" });

/**
 * Компактное расписание для боковой колонки: один учебный день списком,
 * стрелки листают соседние учебные дни. Подписи по-эстонски — виджет живёт
 * на эстонском сайте.
 *
 *   /embed/compact                — сегодня или ближайший учебный день
 *   /embed/compact?d=2026-09-28   — конкретный день
 *   /embed/compact?hide=eesti-b2  — без необязательных предметов
 */
export default async function CompactPage({ searchParams }) {
  const params = await searchParams;

  return (
    <main className={`embed compact ${figtree.className}`}>
      <EmbedResize />
      <Suspense key={params?.d ?? ""} fallback={<DaySkeleton />}>
        <Day wanted={params?.d} hide={params?.hide} />
      </Suspense>
    </main>
  );
}

async function Day({ wanted, hide }) {
  const hidden = parseHidden(hide);
  const [weeks, subjects] = await Promise.all([listWeeksFull(), listSubjects()]);
  const picked = pickDay(
    weeks.map((w) => hideSubjects(w, hidden)),
    wanted
  );

  if (!picked) return <p className="cday-empty">Tunniplaan pole veel avaldatud.</p>;

  const { day, prev, next, today } = picked;
  // предметы дня добавляем и сами, как в Timetable: общий список мог отстать
  const palette = assignColors([...subjects, ...day.blocks.map((b) => b.subject)]);
  const [, m, d] = day.iso.split("-");
  const label = dayLabel(day.iso, today.day);
  const query = (iso) => {
    const q = new URLSearchParams({ d: iso });
    if (hidden.size) q.set("hide", [...hidden].join(","));
    return `/embed/compact?${q}`;
  };

  return (
    <>
      <div className="cday-head">
        <Arrow to={prev && query(prev)} label="Eelmine päev" glyph="‹" />
        <div className="cday-title">
          <b>{label}</b>
          <span>{label === day.weekday ? `${d}.${m}` : `${day.weekday} · ${d}.${m}`}</span>
        </div>
        <Arrow to={next && query(next)} label="Järgmine päev" glyph="›" />
      </div>

      <ol className="cday-list">
        {day.blocks.map((b, i) => {
          const now =
            day.iso === today.day &&
            toMinutes(b.from) <= today.minutes &&
            today.minutes < toMinutes(b.to);
          const done = day.iso === today.day && toMinutes(b.to) <= today.minutes;
          return (
            <li
              key={`${b.from}-${i}`}
              className={now ? "now" : done ? "done" : undefined}
              style={{ "--c": palette.get(b.subject).bg }}
            >
              <span className="t">
                {b.from}–{b.to}
              </span>
              <span className="s">{b.subject}</span>
              {b.room ? <span className="r">{b.room}</span> : null}
            </li>
          );
        })}
      </ol>

      <a
        className="cday-more"
        href={`/?w=${encodeURIComponent(day.weekId)}`}
        target="_blank"
        rel="noopener"
      >
        Kogu nädal →
      </a>
    </>
  );
}

function Arrow({ to, label, glyph }) {
  return to ? (
    <Link href={to} className="cday-arrow" aria-label={label} title={label} scroll={false}>
      {glyph}
    </Link>
  ) : (
    <span className="cday-arrow off" aria-hidden="true">
      {glyph}
    </span>
  );
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
