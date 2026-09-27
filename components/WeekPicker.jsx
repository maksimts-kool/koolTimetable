"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { shortDate } from "@/lib/format";

/** @param path страница, на которой открывается выбранная неделя */
export default function WeekPicker({ weeks, current, path = "/" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="weekpick">
      <span>Неделя</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => startTransition(() => router.push(`${path}?w=${encodeURIComponent(e.target.value)}`))}
        aria-label="Выбор недели"
      >
        {weeks.map((w) => (
          <option key={w.id} value={w.id}>
            {shortDate(w.weekStart)} – {shortDate(w.weekEnd)}
          </option>
        ))}
      </select>
    </div>
  );
}
