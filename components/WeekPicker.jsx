"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { ruRange } from "@/lib/format";

/**
 * Переход по неделям: стрелки к соседним (они же — ← и → на клавиатуре),
 * подпись с датами и возврат к текущей, если открыта другая.
 *
 * @param weeks недели от свежих к старым
 * @param today сегодняшняя дата по Таллину — по ней ищется текущая неделя
 * @param path страница, на которой открывается выбранная неделя
 */
export default function WeekPicker({ weeks, current, today, path = "/week" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const index = weeks.findIndex((w) => w.id === current);
  const week = weeks[index];
  // список идёт от свежих к старым: назад во времени — дальше по списку
  const older = weeks[index + 1];
  const newer = index > 0 ? weeks[index - 1] : null;
  const thisWeek = weeks.find((w) => w.weekStart <= today && today <= w.weekEnd);

  const open = (id) =>
    startTransition(() => router.push(`${path}?w=${encodeURIComponent(id)}`, { scroll: false }));

  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || pending) return;
      if (e.target.closest?.("input, select, textarea, [contenteditable], [role=dialog]")) return;
      if (document.querySelector("[role=dialog]")) return;
      const to = e.key === "ArrowLeft" ? older : e.key === "ArrowRight" ? newer : null;
      if (!to) return;
      e.preventDefault();
      open(to.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="weekpick" aria-busy={pending}>
      {pending ? <div className="navbar" aria-hidden="true" /> : null}
      {thisWeek && thisWeek.id !== current ? (
        <button type="button" className="to-today" onClick={() => open(thisWeek.id)} disabled={pending}>
          К текущей
        </button>
      ) : null}
      <div className="weekpick-ctl">
        <button
          type="button"
          onClick={() => older && open(older.id)}
          disabled={!older || pending}
          aria-label="Предыдущая неделя"
          title="Предыдущая неделя (←)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="weekpick-range" key={current}>
          {week ? ruRange(week.weekStart, week.weekEnd) : ""}
        </span>
        <button
          type="button"
          onClick={() => newer && open(newer.id)}
          disabled={!newer || pending}
          aria-label="Следующая неделя"
          title="Следующая неделя (→)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
