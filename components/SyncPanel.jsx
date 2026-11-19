"use client";

import { useState } from "react";
import { isoWeek, plural, shortDate } from "@/lib/format";

const WEEK_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 5, label: "5" },
];

const STATUS = {
  created: ["добавлена", "ok"],
  updated: ["обновлена", "ok"],
  unchanged: ["без изменений", ""],
  empty: ["занятий нет", "warn"],
};

const SOURCE = { tahvel: "Tahvel", edupage: "EduPage" };

export default function SyncPanel({ group, onSynced }) {
  const [weeks, setWeeks] = useState(3);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {type:'ok'|'error', ...}

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weeks }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ type: "error", text: data.error || "Синхронизация не удалась." });
      } else {
        setResult({ type: "ok", group: data.group, results: data.results, at: new Date() });
        onSynced?.();
      }
    } catch {
      setResult({ type: "error", text: "Сервер не ответил. Проверьте соединение." });
    } finally {
      setBusy(false);
    }
  }

  const changed = result?.results?.filter((r) => r.status === "created" || r.status === "updated").length;

  return (
    <section aria-labelledby="sync-h" className="panel sync rise" style={{ "--i": 1 }}>
      <div className="sync-top">
        <div className="sync-text">
          <h2 id="sync-h">Обновить расписание</h2>
          <p className="hint">
            Группа {group}: сначала Tahvel, а если он неделю не показывает — EduPage. Пустые недели пропускаются,
            неизменённые не перезаписываются. Раз в сутки то же самое делает крон.
          </p>
        </div>
        <div className="sync-ctl">
          <span className="sync-weeks-l" id="sync-weeks-l">
            Недель
          </span>
          <div className="seg" role="radiogroup" aria-labelledby="sync-weeks-l">
            {WEEK_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={weeks === o.value}
                disabled={busy}
                onClick={() => setWeeks(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn primary" disabled={busy} onClick={run}>
            <svg className={busy ? "spin" : undefined} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8" />
              <path d="M21 4v5h-5M3 20v-5h5" />
            </svg>
            {busy ? "Синхронизирую…" : "Синхронизировать"}
          </button>
        </div>
      </div>

      {result?.type === "error" ? (
        <div className="msg error" role="alert">
          {result.text}
        </div>
      ) : null}

      {result?.type === "ok" ? (
        <div className="sync-log" role="status">
          <b className="sync-sum">
            {result.group}: {changed ? `обновлено недель — ${changed}` : "всё уже актуально"}
          </b>
          <ul>
            {result.results.map((r, i) => {
              const [label, tone] = STATUS[r.status] ?? [r.status, ""];
              return (
                <li key={r.id} style={{ "--i": i }}>
                  <b>нед. {isoWeek(r.weekStart)}</b>
                  <span className="muted">
                    {shortDate(r.weekStart)} – {shortDate(r.weekEnd)}
                  </span>
                  <span>
                    {r.lessonCount ? plural(r.lessonCount) : "—"}
                    {r.source ? ` · ${SOURCE[r.source] ?? r.source}` : ""}
                  </span>
                  <span className={`badge ${tone}`}>{label}</span>
                  {r.problems?.length ? <span className="sync-problems">{r.problems.join("; ")}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
