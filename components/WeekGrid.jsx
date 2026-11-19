"use client";

import useNow from "@/components/useNow";
import { hhmm, plural, ruDay, ruWeekday, ruWeekdayShort, shortSubject } from "@/lib/format";
import { addDays, isoDate, toMinutes } from "@/lib/lessons";

// высота часа в сетке
const HOUR_PX = 64;
const PX = HOUR_PX / 60;

/**
 * Дни недели к показу: будни всегда (пустой — тоже, с подписью), выходные —
 * только если в них есть занятия.
 */
export function gridDays(week) {
  const byIso = new Map((week.days ?? []).map((d) => [isoDate(d.date), d]));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(week.weekStart, i);
    const blocks = [...(byIso.get(iso)?.blocks ?? [])].sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
    if (i < 5 || blocks.length) days.push({ iso, index: i, blocks });
  }
  return days;
}

/**
 * Сетка недели: дни колонками, занятия — карточками на оси времени, по
 * сегодняшней колонке едет линия «сейчас». На узком экране вместо сетки —
 * список по дням. Нажатие на занятие открывает карточку предмета.
 *
 * @param palette цвета предметов (lib/colors)
 * @param selected предмет, открытый в карточке, — остальные приглушаются
 */
export default function WeekGrid({ week, palette, selected, onPick }) {
  // До гидрации часов нет: сервер не знает про симуляцию в этом браузере
  const clock = useNow(null, 30_000);
  const nowDay = clock?.day;
  const m = clock?.minutes ?? 0;

  const days = gridDays(week);
  const all = days.flatMap((d) => d.blocks);
  const earliest = all.length ? Math.min(...all.map((b) => toMinutes(b.from))) : 8 * 60;
  const latest = all.length ? Math.max(...all.map((b) => toMinutes(b.to))) : 16 * 60;
  const start = Math.floor(earliest / 60) * 60;
  const end = Math.max(Math.ceil(latest / 60) * 60, start + 60);
  const hours = [];
  for (let h = start; h <= end; h += 60) hours.push(h);

  const phase = (iso, b) => {
    if (!nowDay) return "";
    if (iso < nowDay) return " is-past";
    if (iso > nowDay) return "";
    if (toMinutes(b.to) <= m) return " is-past";
    return toMinutes(b.from) <= m ? " is-live" : "";
  };
  const cls = (iso, b) =>
    `${phase(iso, b)}${selected ? (b.subject === selected ? " is-on" : " is-dim") : ""}`;

  const style = (b, extra) => ({ "--c": palette.get(b.subject)?.bg, ...extra });
  const aria = (iso, b) =>
    `${b.subject}, ${ruWeekday(iso)}, ${b.from} – ${b.to}${b.room ? `, кабинет ${b.room}` : ""}`;

  return (
    <>
      <section aria-label="Сетка недели" className="grid-card">
        <div className="grid-scroll">
          <div className="grid" style={{ "--cols": days.length }}>
            <div className="grid-head">
              <span />
              {days.map((d, i) => {
                const today = d.iso === nowDay;
                return (
                  <div key={d.iso} className={`grid-day${today ? " is-today" : ""}`} style={{ "--i": i }}>
                    <span className="grid-num">{Number(d.iso.slice(8))}</span>
                    <span className="grid-dn">
                      <b>{ruWeekdayShort(d.iso)}</b>
                      <span>
                        {today ? "сегодня" : d.blocks.length ? plural(d.blocks.length, "занятие", "занятия", "занятий") : "нет занятий"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid-body">
              <div className="grid-axis" style={{ height: (end - start) * PX }}>
                {hours.map((h) => (
                  <span key={h} style={{ top: (h - start) * PX }}>
                    {hhmm(h)}
                  </span>
                ))}
              </div>
              {days.map((d, di) => {
                const today = d.iso === nowDay;
                return (
                  <div
                    key={d.iso}
                    role="group"
                    aria-label={ruWeekday(d.iso)}
                    className={`grid-col${today ? " is-today" : ""}${d.blocks.length ? "" : " is-free"}`}
                    style={{ height: (end - start) * PX }}
                  >
                    {d.blocks.map((b, i) => {
                      const a = toMinutes(b.from);
                      const z = toMinutes(b.to);
                      const live = phase(d.iso, b) === " is-live";
                      return (
                        <button
                          type="button"
                          key={`${b.from}-${i}`}
                          className={`lesson${cls(d.iso, b)}`}
                          aria-label={aria(d.iso, b)}
                          aria-pressed={b.subject === selected}
                          onClick={(e) => onPick(b.subject, e.currentTarget)}
                          style={style(b, {
                            top: (a - start) * PX + 2,
                            height: (z - a) * PX - 4,
                            "--p": live ? `${((m - a) / (z - a)) * 100}%` : "0%",
                          })}
                        >
                          {live ? <span className="lesson-elapsed" aria-hidden="true" /> : null}
                          <span className="lesson-name">{shortSubject(b.subject)}</span>
                          <span className="lesson-time">
                            {b.from} – {b.to}
                          </span>
                          {b.room ? <span className="lesson-room">{b.room}</span> : null}
                        </button>
                      );
                    })}
                    {today && m >= start && m <= end ? (
                      <span className="nowline" aria-hidden="true" style={{ top: (m - start) * PX }}>
                        <i>{hhmm(m)}</i>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* телефон: по дням списком */}
      <section aria-label="Неделя по дням" className="week-list">
        {days
          .filter((d) => d.blocks.length)
          .map((d, di) => (
            <div key={d.iso} className={`wl-day rise${d.iso === nowDay ? " is-today" : ""}`} style={{ "--i": di }}>
              <h3>
                {ruWeekday(d.iso)}, {ruDay(d.iso)}
                {d.iso === nowDay ? <span className="chip accent">сегодня</span> : null}
              </h3>
              <ul>
                {d.blocks.map((b, i) => (
                  <li key={`${b.from}-${i}`}>
                    <button
                      type="button"
                      className={`wl-row${cls(d.iso, b)}`}
                      style={style(b)}
                      aria-label={aria(d.iso, b)}
                      onClick={(e) => onPick(b.subject, e.currentTarget)}
                    >
                      <span className="wl-time">
                        <b>{b.from}</b>
                        <span>{b.to}</span>
                      </span>
                      <span className="wl-bar" aria-hidden="true" />
                      <span className="wl-text">
                        <b>{shortSubject(b.subject)}</b>
                        <span>{[b.room ? `кабинет ${b.room}` : null, b.teacher].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {!all.length ? <p className="empty-note">На эту неделю занятий нет.</p> : null}
      </section>
    </>
  );
}
