"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SimPanel from "@/components/SimPanel";
import SyncPanel from "@/components/SyncPanel";
import { isoWeek, ruDate, shortDate } from "@/lib/format";

/** «Выйти» в шапке админки. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <button type="button" className="nav-btn" onClick={logout} disabled={busy}>
      Выйти
    </button>
  );
}

export default function AdminPanel({ weeks, group }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function remove(week) {
    if (!confirm(`Удалить неделю ${ruDate(week.weekStart)} (${week.group})?`)) return;
    setBusy(week.id);
    setError(null);
    const res = await fetch(`/api/weeks/${encodeURIComponent(week.id)}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) router.refresh();
    else setError("Не удалось удалить неделю.");
  }

  return (
    <>
      <SyncPanel group={group} onSynced={() => router.refresh()} />

      <section aria-labelledby="weeks-h" className="panel flush rise" style={{ "--i": 2 }}>
        <div className="panel-head">
          <h2 id="weeks-h">Недели</h2>
          <span className="sub">{weeks.length ? `сохранено: ${weeks.length}` : "пока пусто"}</span>
        </div>

        {error ? <div className="msg error">{error}</div> : null}

        {weeks.length ? (
          <div className="table-scroll">
            <table className="weeks">
              <thead>
                <tr>
                  <th scope="col">Неделя</th>
                  <th scope="col">Даты</th>
                  <th scope="col">Группа</th>
                  <th scope="col">Источник</th>
                  <th scope="col" className="num">
                    Уроков
                  </th>
                  <th scope="col">Обновлено</th>
                  <th scope="col">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w, i) => (
                  <tr key={w.id} className={busy === w.id ? "is-busy" : undefined} style={{ "--i": i }}>
                    <td>
                      <b>{isoWeek(w.weekStart)}</b>
                    </td>
                    <td className="num">
                      {shortDate(w.weekStart)} – {shortDate(w.weekEnd)}
                    </td>
                    <td>{w.group}</td>
                    <td>
                      <span className="badge">{w.fileName}</span>
                    </td>
                    <td className="num">{w.lessonCount}</td>
                    <td className="muted">{new Date(w.uploadedAt).toLocaleDateString("ru-RU")}</td>
                    <td className="act">
                      <button
                        type="button"
                        className="icon-btn danger"
                        disabled={Boolean(busy)}
                        onClick={() => remove(w)}
                        aria-label={`Удалить неделю ${ruDate(w.weekStart)}`}
                        title="Удалить неделю"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint pad">Нажмите «Синхронизировать» — недели появятся здесь.</p>
        )}
      </section>

      <SimPanel />
    </>
  );
}
