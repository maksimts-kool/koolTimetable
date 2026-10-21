"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { shortDate } from "@/lib/format";

/**
 * Выбор недели: список, стрелки к соседним неделям (они же — ← и → на
 * клавиатуре) и возврат к текущей, если открыта другая.
 *
 * @param weeks недели от свежих к старым
 * @param today сегодняшняя дата по Таллину — по ней ищется текущая неделя
 * @param path страница, на которой открывается выбранная неделя
 */
export default function WeekPicker({ weeks, current, today, path = "/" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const index = weeks.findIndex((w) => w.id === current);
  // список идёт от свежих к старым: назад во времени — дальше по списку
  const older = weeks[index + 1];
  const newer = index > 0 ? weeks[index - 1] : null;
  const thisWeek = weeks.find((w) => w.weekStart <= today && today <= w.weekEnd);

  const open = (id) =>
    startTransition(() => router.push(`${path}?w=${encodeURIComponent(id)}`, { scroll: false }));

  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || pending) return;
      if (e.target.closest?.("input, select, textarea, [contenteditable]")) return;
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
      <span>Неделя</span>
      {thisWeek && thisWeek.id !== current ? (
        <button type="button" className="to-today" onClick={() => open(thisWeek.id)} disabled={pending}>
          Текущая
        </button>
      ) : null}
      <div className="weekpick-ctl">
        <button
          type="button"
          className="wk-arrow"
          onClick={() => older && open(older.id)}
          disabled={!older || pending}
          aria-label="Предыдущая неделя"
          title="Предыдущая неделя (←)"
        >
          ‹
        </button>
        <select
          value={current}
          disabled={pending}
          onChange={(e) => open(e.target.value)}
          aria-label="Выбор недели"
        >
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {shortDate(w.weekStart)} – {shortDate(w.weekEnd)}
              {w.id === thisWeek?.id ? " · текущая" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="wk-arrow"
          onClick={() => newer && open(newer.id)}
          disabled={!newer || pending}
          aria-label="Следующая неделя"
          title="Следующая неделя (→)"
        >
          ›
        </button>
      </div>
    </div>
  );
}
