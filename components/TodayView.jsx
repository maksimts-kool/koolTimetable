"use client";

import Link from "next/link";
import { useMemo } from "react";
import OptSwitch from "@/components/OptSwitch";
import SimBadge from "@/components/SimBadge";
import useHidden from "@/components/useHidden";
import useNow from "@/components/useNow";
import { assignColors } from "@/lib/colors";
import { lessonDays } from "@/lib/day";
import {
  capitalize,
  countdown,
  isoWeek,
  plural,
  ruDay,
  ruDuration,
  ruOnWeekday,
  ruWeekday,
  shortSubject,
  weekdayIndex,
} from "@/lib/format";
import { addDays, toMinutes } from "@/lib/lessons";
import { hideSubjects, optionalIdOf, optionalsIn } from "@/lib/optional";

/** Перерыв по длине: короткий — перемена, около часа — обед, дольше — окно. */
const breakKind = (minutes) => (minutes <= 15 ? "Перемена" : minutes <= 60 ? "Обед" : "Окно");

const place = (b) => [b.room ? `кабинет ${b.room}` : null, b.teacher || null].filter(Boolean);

/**
 * Главная: что идёт сейчас, что дальше и план дня. Всё считается от часов,
 * которые идут, пока страница открыта (с учётом симуляции из админки).
 *
 * @param weeks недели целиком, начиная с текущей
 * @param subjects предметы всех недель — по ним считается палитра
 * @param initialNow время сервера по Таллину — с ним совпадает первая отрисовка
 */
export default function TodayView({ weeks, subjects, initialNow }) {
  const now = useNow(initialNow, 1000);
  const [hidden, setAttends] = useHidden();

  const optional = useMemo(() => optionalsIn(weeks), [weeks]);
  const palette = useMemo(
    () =>
      assignColors([
        ...(subjects ?? []),
        ...weeks.flatMap((w) => w.days.flatMap((d) => d.blocks.map((b) => b.subject))),
      ]),
    [weeks, subjects]
  );
  const days = useMemo(
    () => lessonDays(weeks.map((w) => hideSubjects(w, hidden)), now.day),
    [weeks, hidden, now.day]
  );

  const m = now.minutes;
  const today = days[0]?.iso === now.day ? days[0] : null;
  const nextDay = days.find((d) => d.iso > now.day) ?? null;
  const tomorrow = addDays(now.day, 1);
  const when = (iso) => (iso === tomorrow ? "завтра" : `${ruOnWeekday(iso)}, ${ruDay(iso)}`);

  const blocks = (today?.blocks ?? []).map((b) => ({ ...b, a: toMinutes(b.from), b: toMinutes(b.to) }));
  const cur = blocks.find((x) => x.a <= m && m < x.b) ?? null;
  const later = blocks.filter((x) => x.a > m);
  const prev = blocks.filter((x) => x.b <= m).pop() ?? null;
  const color = (subject) => palette.get(subject)?.bg ?? "#4B5468";

  // ---- крупная карточка ----
  let hero;
  if (cur) {
    const after = later[0];
    const gap = after ? after.a - cur.b : null;
    hero = {
      key: `live-${cur.from}`,
      live: true,
      color: color(cur.subject),
      name: shortSubject(cur.subject),
      place: place(cur),
      left: countdown(cur.b - m),
      leftLabel: !after ? "до конца дня" : gap <= 15 ? "до перемены" : "до перерыва",
      pct: ((m - cur.a) / (cur.b - cur.a)) * 100,
      start: cur.from,
      end: cur.to,
    };
  } else if (later.length) {
    const nx = later[0];
    const kind = prev ? breakKind(nx.a - prev.b) : null;
    hero = {
      key: `wait-${nx.from}`,
      badge: kind ?? "До начала",
      title: kind ? `${kind} до ${nx.from}` : `Первое занятие в ${nx.from}`,
      text: `Дальше ${shortSubject(nx.subject)}${nx.room ? `, кабинет ${nx.room}` : ""}`,
      count: countdown(nx.a - m),
    };
  } else if (today) {
    hero = {
      key: "over",
      badge: "Конец дня",
      title: "На сегодня всё",
      text: nextDay
        ? `${capitalize(when(nextDay.iso))} первое занятие в ${nextDay.blocks[0].from}`
        : "Дальше расписание пока не опубликовано",
    };
  } else {
    hero = {
      key: "free",
      badge: weekdayIndex(now.day) >= 5 ? "Выходной" : "Свободный день",
      title: "Сегодня занятий нет",
      text: nextDay
        ? `Следующие — ${when(nextDay.iso)}, первое в ${nextDay.blocks[0].from}`
        : "Дальше расписание пока не опубликовано",
    };
  }

  // ---- «Дальше» ----
  let next = null;
  let last = false;
  if (cur && later[0]) next = { b: later[0], in: `через ${ruDuration(later[0].a - m)}` };
  else if (!cur && later[1]) next = { b: later[1], in: `через ${ruDuration(later[1].a - m)}` };
  else if (today && (cur || later.length)) last = true;
  else if (nextDay) next = { b: nextDay.blocks[0], in: `${when(nextDay.iso)} в ${nextDay.blocks[0].from}` };

  // ---- план дня: сегодня, а если сегодня пусто — ближайший учебный день ----
  const planDay = today ?? nextDay;
  const isToday = planDay === today;
  const plan = [];
  let firstAhead = true;
  (planDay?.blocks ?? []).forEach((raw, i, all) => {
    const a = toMinutes(raw.from);
    const b = toMinutes(raw.to);
    if (i > 0) {
      const pb = toMinutes(all[i - 1].to);
      if (a > pb) {
        const live = isToday && pb <= m && m < a;
        plan.push({
          type: "break",
          key: `g${i}`,
          live,
          label: live ? `${breakKind(a - pb)} сейчас · ещё ${ruDuration(a - m)}` : `${breakKind(a - pb)} · ${ruDuration(a - pb)}`,
        });
      }
    }
    const past = isToday && b <= m;
    const live = isToday && a <= m && m < b;
    let status = null;
    if (isToday) {
      if (past) status = "прошло";
      else if (live) status = "сейчас";
      else {
        status = `через ${ruDuration(a - m)}`;
      }
    }
    plan.push({
      type: "lesson",
      key: `${raw.from}-${i}`,
      block: raw,
      color: color(raw.subject),
      past,
      live,
      soon: isToday && !past && !live && firstAhead,
      status,
    });
    if (isToday && !past && !live) firstAhead = false;
  });

  const lessonsTotal = (planDay?.blocks ?? []).reduce((s, b) => s + (b.lessons ?? 1), 0);
  const stats = planDay
    ? [
        { value: planDay.blocks.length, label: plural(planDay.blocks.length, "занятие", "занятия", "занятий").replace(/^\d+ /, "") },
        { value: lessonsTotal, label: "ак. часов" },
      ]
    : [];

  const optColor = (o) => {
    for (const [name, c] of palette) if (optionalIdOf(name) === o.id) return c.bg;
    return null;
  };

  return (
    <>
      <section className="page-top rise" style={{ "--i": 0 }}>
        <div>
          <h1>
            {ruWeekday(now.day)}, {ruDay(now.day)}
          </h1>
          <p className="sub">Неделя {isoWeek(now.day)}</p>
        </div>
        <div className="page-tools">
          {optional.map((o) => (
            <OptSwitch
              key={o.id}
              option={o}
              attends={!hidden.has(o.id)}
              onChange={setAttends}
              color={optColor(o)}
            />
          ))}
          <Link href="/week" className="tool-link">
            Вся неделя
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      </section>

      <div className="today-grid">
        <section
          key={hero.key}
          aria-labelledby="hero-h"
          className={`hero rise${hero.live ? " is-live" : ""}`}
          style={{ "--i": 1, "--c": hero.color }}
        >
          {hero.live ? (
            <>
              <span className="hero-badge">
                <span className="live-dot" aria-hidden="true" />
                Идёт сейчас
              </span>
              <div className="hero-main">
                <h2 id="hero-h">{hero.name}</h2>
                {hero.place.length ? <p>{capitalize(hero.place.join(" · "))}</p> : null}
              </div>
              <div className="hero-foot">
                <span className="hero-count">
                  <b>{hero.left}</b>
                  <span>{hero.leftLabel}</span>
                </span>
                <div
                  className="hero-bar"
                  role="progressbar"
                  aria-label="Прошло от занятия"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(hero.pct)}
                >
                  <span style={{ width: `${hero.pct}%` }} />
                </div>
                <div className="hero-ends">
                  <span>{hero.start}</span>
                  <span>{hero.end}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="hero-badge">{hero.badge}</span>
              <div className="hero-main">
                <h2 id="hero-h">{hero.title}</h2>
                <p className="muted">{hero.text}</p>
              </div>
              {hero.count ? (
                <div className="hero-foot">
                  <span className="hero-count">
                    <b>{hero.count}</b>
                    <span className="muted">до начала</span>
                  </span>
                </div>
              ) : null}
            </>
          )}
        </section>

        <div className="today-side">
          <section aria-labelledby="next-h" className="panel next rise" style={{ "--i": 2 }}>
            <h2 id="next-h" className="label">
              Дальше
            </h2>
            {next ? (
              <div key={`${next.b.from}-${next.b.subject}`} className="next-body swap">
                <span className="next-name">
                  <span className="dot" style={{ background: color(next.b.subject) }} aria-hidden="true" />
                  {shortSubject(next.b.subject)}
                </span>
                <span className="next-meta">
                  {next.b.from} – {next.b.to}
                  {next.b.room ? (
                    <>
                      {" "}
                      · кабинет <b>{next.b.room}</b>
                    </>
                  ) : null}
                </span>
                {next.b.teacher ? <span className="next-meta">{next.b.teacher}</span> : null}
                <span className="chip">{next.in}</span>
              </div>
            ) : (
              <div className="next-body swap">
                <span className="next-name">Больше ничего</span>
                <span className="next-meta">
                  {last
                    ? cur
                      ? "Это последнее занятие на сегодня."
                      : "После него на сегодня всё."
                    : "Дальше расписание пока не опубликовано."}
                </span>
              </div>
            )}
          </section>
          {stats.length ? (
            <section aria-label="Итоги дня" className="stats-grid rise" style={{ "--i": 3 }}>
              {stats.map((s) => (
                <div key={s.label}>
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </div>

      {planDay ? (
        <section aria-labelledby="day-h" className="plan">
          <div className="plan-head rise" style={{ "--i": 4 }}>
            <h2 id="day-h">План дня</h2>
            {!isToday ? (
              <span className="sub">
                {ruWeekday(planDay.iso)}, {ruDay(planDay.iso)}
              </span>
            ) : null}
          </div>
          <ol className="timeline">
            {plan.map((it, i) =>
              it.type === "break" ? (
                <li key={it.key} className={`tl-break rise${it.live ? " is-live" : ""}`} style={{ "--i": 5 + i }}>
                  <span className="tl-time" />
                  <span className="tl-rail" aria-hidden="true" />
                  <span className="tl-break-label">{it.label}</span>
                </li>
              ) : (
                <li
                  key={it.key}
                  className={`tl-item rise${it.past ? " is-past" : ""}${it.live ? " is-live" : ""}`}
                  style={{ "--i": 5 + i, "--c": it.color }}
                >
                  <span className="tl-time">
                    <b>{it.block.from}</b>
                    <span>{it.block.to}</span>
                  </span>
                  <span className="tl-rail" aria-hidden="true" />
                  <div className="tl-card">
                    <div className="tl-card-top">
                      <span className="tl-name">{shortSubject(it.block.subject)}</span>
                      {it.status ? (
                        <span className={`tl-status${it.live ? " live" : it.soon ? " soon" : ""}`}>{it.status}</span>
                      ) : null}
                    </div>
                    {place(it.block).length ? (
                      <span className="tl-meta">
                        {it.block.room ? (
                          <>
                            Кабинет <b>{it.block.room}</b>
                          </>
                        ) : null}
                        {it.block.room && it.block.teacher ? " · " : null}
                        {it.block.teacher}
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            )}
          </ol>
        </section>
      ) : null}

      <SimBadge />
    </>
  );
}
