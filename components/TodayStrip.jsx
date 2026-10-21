"use client";

import { useEffect, useMemo, useRef } from "react";
import useNow from "@/components/useNow";
import { assignColors } from "@/lib/colors";
import { lessonDays } from "@/lib/day";
import { addDays, toMinutes } from "@/lib/lessons";
import { plural } from "@/lib/format";

const LESSON_MINUTES = 45;
// поля трека до первого урока и после последнего, в минутах
const PAD = 15;

// «в какой день» с понедельника — для подписи следующего учебного дня
const RU_ON_WEEKDAY = ["В понедельник", "Во вторник", "В среду", "В четверг", "В пятницу", "В субботу", "В воскресенье"];

const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;

/** Обратный отсчёт: до часа — «12:05» с секундами, дальше — «1 ч 05 мин». */
function countdown(minutes) {
  const seconds = Math.max(0, Math.ceil(minutes * 60));
  if (seconds < 3600) return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const whole = Math.ceil(seconds / 60);
  return `${Math.floor(whole / 60)} ч ${String(whole % 60).padStart(2, "0")} мин`;
}

/** «Tarkvara (eesti keeles)» → «Tarkvara»: на узкой полосе язык обучения только мешает. */
const short = (subject) => subject.replace(/\s*\((eesti|vene|inglise) keeles\)\s*$/i, "");

/** Начала уроков внутри блока: склеенные уроки помнят свои начала в marks. */
const lessonStarts = (block) => [block.from, ...(block.marks ?? [])].map(toMinutes);

/**
 * Полоса «сегодня» над сеткой: уроки дня на одной временной оси, по которой
 * едет линия «сейчас». Текущий урок заливается по мере хода, прошедшие
 * бледнеют, сверху — что идёт сейчас и сколько осталось (или через сколько
 * следующий). Когда уроки на сегодня кончились, полоса показывает следующий
 * учебный день недели.
 *
 * Видна только у недели, в которую попадает сегодняшний день.
 *
 * @param initialNow время сервера — с ним совпадает первая отрисовка
 */
export default function TodayStrip({ week, allSubjects, initialNow }) {
  const now = useNow(initialNow, 1000);
  const scrollRef = useRef(null);

  const days = useMemo(() => lessonDays([week]), [week]);
  const palette = useMemo(
    () =>
      assignColors([
        ...(allSubjects ?? []),
        ...week.days.flatMap((d) => d.blocks.map((b) => b.subject)),
      ]),
    [week, allSubjects]
  );

  const inWeek = week.weekStart <= now.day && now.day <= week.weekEnd;
  // сегодня, пока не кончился последний урок, иначе — следующий учебный день
  const day = inWeek
    ? days.find(
        (d) =>
          d.iso > now.day ||
          (d.iso === now.day && toMinutes(d.blocks[d.blocks.length - 1].to) > now.minutes)
      )
    : null;
  const live = day?.iso === now.day;

  const start = day ? toMinutes(day.blocks[0].from) - PAD : 0;
  const end = day ? toMinutes(day.blocks[day.blocks.length - 1].to) + PAD : 1;
  const span = end - start;
  const at = (minutes) => `${((minutes - start) / span) * 100}%`;

  // На узком экране трек шире окна и прокручивается — подводим линию «сейчас»
  // в поле зрения. Только при смене дня: дальше прокрутка в руках человека.
  const nowShown = live && now.minutes >= start && now.minutes <= end;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !nowShown || el.scrollWidth <= el.clientWidth) return;
    el.scrollTo({
      left: ((now.minutes - start) / span) * el.scrollWidth - el.clientWidth * 0.3,
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.iso, nowShown]);

  if (!inWeek) return null;

  if (!day) {
    return (
      <section className="today today-over rise" style={{ "--i": 1 }}>
        <span className="today-check" aria-hidden="true">
          ✓
        </span>
        <div>
          <b>Учебная неделя позади</b>
          <span>Следующие занятия — в расписании следующей недели.</span>
        </div>
      </section>
    );
  }

  const blocks = day.blocks;
  const current = live
    ? blocks.findIndex((b) => toMinutes(b.from) <= now.minutes && now.minutes < toMinutes(b.to))
    : -1;
  const next = live ? blocks.findIndex((b) => toMinutes(b.from) > now.minutes) : 0;

  // пройденные уроки считаем по 45 минут, а не блоками: блок бывает и в 6 уроков
  const total = blocks.reduce((sum, b) => sum + b.lessons, 0);
  const done = live
    ? blocks.reduce(
        (sum, b) =>
          sum +
          lessonStarts(b).filter((s) => Math.min(s + LESSON_MINUTES, toMinutes(b.to)) <= now.minutes)
            .length,
        0
      )
    : 0;
  const teaching = blocks.reduce((sum, b) => sum + toMinutes(b.to) - toMinutes(b.from), 0);
  const elapsed = live
    ? blocks.reduce(
        (sum, b) =>
          sum + Math.min(Math.max(now.minutes - toMinutes(b.from), 0), toMinutes(b.to) - toMinutes(b.from)),
        0
      )
    : 0;

  const [, m, d] = day.iso.split("-");

  let headline;
  let count = null;
  // у следующего дня — только время первого урока: остальное видно на треке
  let sub = null;
  if (current >= 0) {
    const b = blocks[current];
    headline = short(b.subject);
    count = `ещё ${countdown(toMinutes(b.to) - now.minutes)}`;
    const after = blocks[current + 1];
    sub = [
      b.room,
      b.teacher,
      after ? `дальше ${short(after.subject)} в ${after.from}` : "последний урок на сегодня",
    ];
  } else if (live) {
    const b = blocks[next];
    const gap = toMinutes(b.from) - now.minutes;
    const lunch = next > 0 && toMinutes(b.from) - toMinutes(blocks[next - 1].to) >= 30;
    headline = next === 0 ? "До начала занятий" : lunch ? "Обед" : "Перемена";
    count = `через ${countdown(gap)}`;
    sub = [`${short(b.subject)} в ${b.from}`, b.room, b.teacher];
  } else {
    const b = blocks[0];
    // следующий учебный день не всегда завтрашний: между ними бывает свободный
    const on =
      day.iso === addDays(now.day, 1)
        ? "Завтра"
        : RU_ON_WEEKDAY[(new Date(`${day.iso}T12:00:00Z`).getUTCDay() + 6) % 7];
    headline = `${on} первый урок в ${b.from}`;
  }

  const hours = [];
  // у самого края подпись часа вылезла бы за трек
  for (let h = Math.ceil(start / 60); h * 60 <= end - 20; h++) hours.push(h);

  // окна между уроками от получаса — подписываем, чтобы пустота читалась как перерыв
  const gaps = [];
  for (let i = 1; i < blocks.length; i++) {
    const from = toMinutes(blocks[i - 1].to);
    const to = toMinutes(blocks[i].from);
    if (to - from >= 30) gaps.push({ from, to });
  }

  return (
    <section className={`today rise${live ? " is-live" : ""}`} style={{ "--i": 1 }} aria-live="off">
      <div className="today-top">
        <div className="today-status">
          {live ? (
            <p className="today-when">
              <span className="live-dot" aria-hidden="true" />
              Сегодня · {day.weekday}, {d}.{m}
            </p>
          ) : null}
          <div className="today-headline">
            {/* key: смена урока — новая строка, и она въезжает заново */}
            <b key={headline}>{headline}</b>
            {count ? <span className="today-count">{count}</span> : null}
          </div>
          {sub ? <p className="today-sub">{sub.filter(Boolean).join(" · ")}</p> : null}
        </div>

        <div className="today-meter">
          <div className="today-meter-nums">
            {live ? (
              <>
                {/* после «из» — родительный падеж: из 1 урока, из 5 уроков */}
                <b>{done}</b> из {plural(total, "урока", "уроков", "уроков")}
              </>
            ) : (
              <b>{plural(total)}</b>
            )}
          </div>
          {live ? (
            <div
              className="meter"
              role="progressbar"
              aria-label="Пройдено уроков"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
            >
              <span style={{ width: `${(elapsed / teaching) * 100}%` }} />
            </div>
          ) : null}
          <div className="today-meter-cap">
            {blocks[0].from} – {blocks[blocks.length - 1].to}
          </div>
        </div>
      </div>

      <div className="today-scroll" ref={scrollRef}>
        <div className="today-track" style={{ "--span": span }}>
          {hours.map((h) => (
            <span key={h} className="tick" style={{ left: at(h * 60) }}>
              {/* рядом с линией «сейчас» подпись часа спрятана под её время */}
              <i className={nowShown && Math.abs(h * 60 - now.minutes) < 22 ? "under" : undefined}>
                {String(h).padStart(2, "0")}:00
              </i>
            </span>
          ))}

          {nowShown ? <div className="passed" style={{ width: at(now.minutes) }} /> : null}

          {gaps.map((g) => (
            <span
              key={g.from}
              className="today-gap"
              style={{ left: at(g.from), width: `${((g.to - g.from) / span) * 100}%` }}
            >
              {g.to - g.from} мин
            </span>
          ))}

          {blocks.map((b, i) => {
            const from = toMinutes(b.from);
            const to = toMinutes(b.to);
            const state = !live ? "" : to <= now.minutes ? " done" : i === current ? " live" : "";
            const color = palette.get(b.subject);
            return (
              <div
                key={`${b.from}-${i}`}
                className={`tb${state}`}
                style={{
                  left: at(from),
                  width: `${((to - from) / span) * 100}%`,
                  "--c": color.bg,
                  "--cb": color.border,
                  "--i": i,
                  "--p": i === current ? `${((now.minutes - from) / (to - from)) * 100}%` : "0%",
                }}
                title={`${b.from}–${b.to} · ${b.subject}${b.room ? ` · ${b.room}` : ""}`}
              >
                {i === current ? <span className="tb-fill" aria-hidden="true" /> : null}
                <span className="tb-name">{short(b.subject)}</span>
                <span className="tb-meta">
                  {b.from}–{b.to}
                  {b.room ? ` · ${b.room}` : ""}
                </span>
              </div>
            );
          })}

          {nowShown ? (
            <div className="nowline" style={{ left: at(now.minutes) }} aria-hidden="true">
              <span className="nowtag">{hhmm(now.minutes)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
