"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SyncPanel from "@/components/SyncPanel";
import { plural, ruDate } from "@/lib/format";

export default function AdminPanel({ weeks, driver, group }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {type: 'ok'|'error'|'warn', ...}
  const [pendingFile, setPendingFile] = useState(null);

  async function send(file, replace = false) {
    setBusy(true);
    setResult(null);
    const body = new FormData();
    body.append("file", file);
    if (replace) body.append("replace", "1");

    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();

      if (res.status === 409) {
        setPendingFile(file);
        setResult({ type: "warn", text: data.error, parsed: data.parsed });
      } else if (!res.ok) {
        setResult({ type: "error", text: data.error || "Не удалось загрузить файл." });
      } else {
        setPendingFile(null);
        setResult({ type: "ok", week: data.week, replaced: data.replaced });
        router.refresh();
      }
    } catch {
      setResult({ type: "error", text: "Сервер не ответил. Проверьте соединение и попробуйте ещё раз." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function pick(file) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setResult({ type: "error", text: `«${file.name}» — не PDF. Нужна PDF-выгрузка расписания из ТТК.` });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResult({ type: "error", text: "Файл больше 5 МБ — это точно расписание?" });
      return;
    }
    send(file);
  }

  async function remove(week) {
    if (!confirm(`Удалить неделю ${ruDate(week.weekStart)} (${week.group})?`)) return;
    setBusy(true);
    const res = await fetch(`/api/weeks/${encodeURIComponent(week.id)}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
    else setResult({ type: "error", text: "Не удалось удалить неделю." });
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
        <h2>Загрузка PDF</h2>
        <p className="hint">
          Последний запасной путь: PDF-выгрузка «Tunniplaan» из ТТК — на случай, если группы нет
          ни в Tahvel, ни в EduPage. Неделя и группа читаются из самого документа.
        </p>

        <div
          className={`drop${over ? " over" : ""}`}
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!busy) pick(e.dataTransfer.files?.[0]);
          }}
        >
          <b>{busy ? "Разбираю PDF…" : "Перетащите PDF сюда или нажмите, чтобы выбрать"}</b>
          <span>Максимум 5 МБ · только PDF</span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>

        {result?.type === "error" && <div className="msg error">{result.text}</div>}

        {result?.type === "warn" && (
          <div className="msg warn">
            {result.text}
            {result.parsed && (
              <div style={{ marginTop: 6 }}>
                В новом файле: {plural(result.parsed.lessonCount)}, дней с занятиями — {result.parsed.days}.
              </div>
            )}
            <div className="actions">
              <button className="primary" disabled={busy} onClick={() => send(pendingFile, true)}>
                Заменить
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setPendingFile(null);
                  setResult(null);
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {result?.type === "ok" && (
          <div className="msg ok">
            <b>
              {result.replaced ? "Неделя обновлена" : "Неделя загружена"}: {ruDate(result.week.weekStart)} –{" "}
              {ruDate(result.week.weekEnd)}, группа {result.week.group}, {plural(result.week.lessonCount)}.
            </b>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {result.week.days.map((d) => (
                <li key={d.date}>
                  {d.weekday} {d.date} — {plural(d.lessons)}: {d.subjects.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Загруженные недели</h2>
        <p className="hint">
          Хранилище: <span className="pill">{driver}</span> · всего недель: {weeks.length}
        </p>

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
                <th>Загружено</th>
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
    </>
  );
}
