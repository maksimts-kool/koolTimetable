"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import OptSwitch from "@/components/OptSwitch";
import useHidden from "@/components/useHidden";
import { OPTIONAL_SUBJECTS } from "@/lib/optional";

/** Событие «открой настройки» — им пользуется ссылка «изменить» на других страницах. */
export const OPEN_SETTINGS = "tunniplaan:settings";

/**
 * Шестерёнка в шапке: под ней выпадает панель с переключателями
 * необязательных предметов. Выбор помнится в браузере и действует на всех
 * страницах и в адресе ленты календаря.
 *
 * @param colors id предмета → цвет его значка в палитре
 */
export default function SettingsMenu({ colors = {} }) {
  const [hidden, setAttends] = useHidden();
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  // закрываем по клику мимо панели и по Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => root.current && !root.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      root.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    window.addEventListener(OPEN_SETTINGS, onOpen);
    return () => window.removeEventListener(OPEN_SETTINGS, onOpen);
  }, []);

  return (
    <div className="settings" ref={root}>
      <button
        type="button"
        className={`settings-btn${open ? " on" : ""}`}
        aria-label="Настройки"
        aria-expanded={open}
        aria-controls="settings-pop"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open ? (
        <div id="settings-pop" role="group" aria-label="Настройки" className="settings-pop">
          <b className="settings-title">Настройки</b>
          {OPTIONAL_SUBJECTS.map((o) => (
            <OptSwitch
              key={o.id}
              option={o}
              attends={!hidden.has(o.id)}
              onChange={setAttends}
              color={colors[o.id]}
            />
          ))}
          <Link href="/admin" className="settings-admin" onClick={() => setOpen(false)}>
            Админка
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
