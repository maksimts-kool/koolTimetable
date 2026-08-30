"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { plural, shortDate } from "@/lib/format";

export default function WeekPicker({ weeks, current }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="weekpick">
      <span>Неделя</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => startTransition(() => router.push(`/?w=${encodeURIComponent(e.target.value)}`))}
        aria-label="Выбор недели"
      >
        {weeks.map((w) => (
          <option key={w.id} value={w.id}>
            {shortDate(w.weekStart)} – {shortDate(w.weekEnd)} · {w.group} · {plural(w.lessonCount)}
          </option>
        ))}
      </select>
    </div>
  );
}
