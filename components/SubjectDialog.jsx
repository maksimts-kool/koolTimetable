"use client";

import { useEffect, useRef, useState } from "react";
import { gridDays } from "@/components/WeekGrid";
import { ruWeekdayShort } from "@/lib/format";
import { optionalIdOf } from "@/lib/optional";

// столько длится уход окна — потом его снимают со страницы
const LEAVE_MS = 200;

/**
 * Карточка предмета: преподаватель, часы за неделю и все занятия предмета на
 * этой неделе. Закрывается крестиком, щелчком мимо окна и клавишей Esc.
 *
 * @param subject название предмета
 * @param color заливка шапки — цвет предмета в сетке
 * @param today сегодняшняя дата — её строка подсвечена
 * @param onClose вызывается, когда окно уже ушло с экрана
 */
export default function SubjectDialog({ subject, week, color, today, onClose }) {
  const [leaving, setLeaving] = useState(false);
  const closeRef = useRef(null);
  const timer = useRef(null);

  const close = () => {
    if (timer.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLeaving(true);
    timer.current = setTimeout(onClose, reduce ? 0 : LEAVE_MS);
  };

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      clearTimeout(timer.current);
      opener?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const occ = gridDays(week).flatMap((d) =>
    d.blocks.filter((b) => b.subject === subject).map((b) => ({ ...b, iso: d.iso }))
  );
  const teachers = [...new Set(occ.flatMap((b) => (b.teacher ? b.teacher.split(/,\s*/) : [])))];
  const hours = occ.reduce((sum, b) => sum + (b.lessons ?? 1), 0);
  const optional = Boolean(optionalIdOf(subject));
  const shared = [...new Set(occ.flatMap((b) => (b.groups?.includes(",") ? b.groups.split(/,\s*/) : [])))];

  return (
    <div className={`modal${leaving ? " leaving" : ""}`}>
      <button type="button" className="modal-backdrop" onClick={close} aria-label="Закрыть окно предмета" tabIndex={-1} />
      <div role="dialog" aria-modal="true" aria-labelledby="subj-title" className="modal-card">
        <div className="modal-head" style={{ "--c": color }}>
          <div className="modal-title">
            <h2 id="subj-title">{subject}</h2>
            <button type="button" ref={closeRef} onClick={close} aria-label="Закрыть" className="modal-close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {teachers.length ? <p>{teachers.join(", ")}</p> : null}
        </div>
        <div className="modal-body">
          <div className="modal-stats">
            <div>
              <span>За неделю</span>
              <b>{hours} ак. ч</b>
            </div>
            <div>
              <span>Занятий</span>
              <b>{occ.length}</b>
            </div>
          </div>
          <div className="modal-occ">
            <span className="label">На этой неделе</span>
            {occ.map((b, i) => (
              <div key={`${b.iso}-${b.from}`} className={`occ${b.iso === today ? " is-today" : ""}`} style={{ "--i": i }}>
                <b>{ruWeekdayShort(b.iso)}</b>
                <span className="occ-time">
                  {b.from} – {b.to}
                </span>
                <b>{b.room || "—"}</b>
              </div>
            ))}
          </div>
          {shared.length ? <p className="note">Вместе с группами: {shared.join(", ")}.</p> : null}
          {optional ? <p className="note">Предмет по выбору — его можно скрыть переключателем над расписанием.</p> : null}
        </div>
      </div>
    </div>
  );
}
