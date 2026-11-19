"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SimPanel from "@/components/SimPanel";
import SyncPanel from "@/components/SyncPanel";
import { ruDate } from "@/lib/format";

export default function AdminPanel({ weeks, driver, group }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function remove(week) {
    if (!confirm(`Удалить неделю ${ruDate(week.weekStart)} (${week.group})?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/weeks/${encodeURIComponent(week.id)}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError("Не удалось удалить неделю.");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <>
      <div className="form-row" style={{ justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={logout}>Выйти</button>
      </div>

      <SyncPanel group={group} onSynced={() => router.refresh()} />

      <div className="card">
        <h2>Сохранённые недели</h2>
        <p className="hint">
          Хранилище: <span className="pill">{driver}</span> · всего недель: {weeks.length}
        </p>

        {error && <div className="msg error">{error}</div>}

        {weeks.length === 0 ? (
          <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 13.5 }}>Пока пусто.</p>
        ) : (
          <table className="weeks">
            <thead>
              <tr>
                <th>Неделя</th>
                <th>Группа</th>
                <th>Уроков</th>
                <th>Источник</th>
                <th>Обновлено</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.id}>
                  <td className="num">
                    {ruDate(w.weekStart)} – {ruDate(w.weekEnd)}
                  </td>
                  <td>{w.group}</td>
                  <td className="num">{w.lessonCount}</td>
                  <td style={{ color: "var(--ink-2)" }}>{w.fileName}</td>
                  <td style={{ color: "var(--ink-2)" }}>
                    {new Date(w.uploadedAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="danger" disabled={busy} onClick={() => remove(w)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SimPanel />
    </>
  );
}
