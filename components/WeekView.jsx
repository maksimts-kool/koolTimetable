"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import IcalLink from "@/components/IcalLink";
import Timetable from "@/components/Timetable";
import WeekPicker from "@/components/WeekPicker";
import { hideSubjects, optionalsIn, parseHidden } from "@/lib/optional";

const STORAGE_KEY = "tunniplaan:hidden";

/**
 * Страница недели целиком на клиенте: галочка «не хожу» меняет и счётчики в
 * шапке, и сетку, и легенду, и адрес ленты календаря — держать это состояние
 * в одном месте проще, чем синхронизировать половину страницы с сервером.
 *
 * @param subjects названия предметов по всем неделям сразу — по ним считается
 *   палитра, поэтому предмет выглядит одинаково в любой неделе
 */
export default function WeekView({ week, weeks, current, subjects }) {
  const [hidden, setHidden] = useState(() => new Set());

  // localStorage читаем после гидрации: на сервере его нет, а разошедшуюся
  // разметку React бы не простил
  useEffect(() => {
    try {
      setHidden(parseHidden(localStorage.getItem(STORAGE_KEY)));
    } catch {
      /* приватный режим — просто показываем всё */
    }
  }, []);

  const optional = useMemo(() => optionalsIn([week]), [week]);
  const shown = useMemo(() => hideSubjects(week, hidden), [week, hidden]);

  function toggle(id, attends) {
    const next = new Set(hidden);
    if (attends) next.delete(id);
    else next.add(id);
    setHidden(next);
    try {
      localStorage.setItem(STORAGE_KEY, [...next].join(","));
    } catch {
      /* не сохранилось — на этой сессии всё равно применится */
    }
  }

  const minutes = shown.lessonCount * 45;
  const hours =
    Math.floor(minutes / 60) + (minutes % 60 ? `:${String(minutes % 60).padStart(2, "0")}` : "");

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">Tallinna Tehnoloogiakolledž</p>
          <h1>
            Tunniplaan
            <span className="grp">
              {week.group}
              {week.programme ? ` · ${week.programme}` : ""}
            </span>
          </h1>
        </div>
        <div className="right">
          <WeekPicker weeks={weeks} current={current} />
          <div className="stats">
            <div className="stat">
              <b>{shown.lessonCount}</b>
              <span>уроков</span>
            </div>
            <div className="stat">
              <b>{hours}</b>
              <span>часов</span>
            </div>
            <div className="stat">
              <b>{shown.days.length}</b>
              <span>учебных дней</span>
            </div>
          </div>
        </div>
      </header>

      {optional.length ? (
        <div className="optouts">
          <span className="optlabel">Хожу на</span>
          {optional.map((o) => (
            <label key={o.id} className={hidden.has(o.id) ? "optout off" : "optout"} title={o.hint}>
              <input
                type="checkbox"
                checked={!hidden.has(o.id)}
                onChange={(e) => toggle(o.id, e.target.checked)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      <Timetable week={shown} allSubjects={subjects} />

      <footer>
        <span>Источник: {week.fileName}</span>
        <span>
          {week.source === "pdf" ? "Загружено" : "Обновлено"}{" "}
          {new Date(week.uploadedAt).toLocaleDateString("ru-RU")}
        </span>
        <IcalLink hide={[...hidden].join(",")} />
        <Link href="/admin">Админка</Link>
      </footer>
    </>
  );
}
