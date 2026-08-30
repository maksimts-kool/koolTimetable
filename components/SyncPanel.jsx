"use client";

import { useState } from "react";
import { plural, ruDate } from "@/lib/format";

const WEEK_OPTIONS = [
  { value: 1, label: "только текущую неделю" },
  { value: 2, label: "текущую и следующую" },
  { value: 3, label: "3 недели вперёд" },
  { value: 5, label: "5 недель вперёд" },
];

const STATUS = {
  created: "добавлена",
  updated: "обновлена",
  unchanged: "без изменений",
  empty: "занятий нет",
};

export default function SyncPanel({ group, onSynced }) {
  const [weeks, setWeeks] = useState(3);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {type:'ok'|'error', ...}

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/tahvel/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weeks }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ type: "error", text: data.error || "Синхронизация не удалась." });
      } else {
        setResult({ type: "ok", group: data.group, results: data.results });
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
    <div className="card">
      <h2>Обновить из Tahvel</h2>
      <p className="hint">
        Расписание группы <span className="pill">{group}</span> берётся прямо из Tahvel — выгружать
        PDF не нужно. Недели без занятий пропускаются, уже загруженные не трогаются, если в них
        ничего не изменилось. Раз в сутки то же самое происходит само.
      </p>

      <div className="form-row">
        <select
          value={weeks}
          disabled={busy}
          onChange={(e) => setWeeks(Number(e.target.value))}
          aria-label="Сколько недель обновить"
        >
          {WEEK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button className="primary" disabled={busy} onClick={run}>
          {busy ? "Синхронизирую…" : "Синхронизировать"}
        </button>
      </div>

      {result?.type === "error" && <div className="msg error">{result.text}</div>}

      {result?.type === "ok" && (
        <div className="msg ok">
          <b>
            {result.group}: {changed ? `обновлено недель — ${changed}` : "всё уже актуально"}.
          </b>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {result.results.map((r) => (
              <li key={r.id}>
                {ruDate(r.weekStart)} – {ruDate(r.weekEnd)} — {STATUS[r.status] ?? r.status}
                {r.lessonCount ? `, ${plural(r.lessonCount)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
