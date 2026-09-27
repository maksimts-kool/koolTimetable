"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { autoIndex, dayLabel, duration, tallinnNow } from "@/lib/day";
import { toMinutes } from "@/lib/lessons";

const TICK_MS = 15_000;
// страницу могут держать открытой сутками — расписание подтягиваем заново,
// чтобы правки после ночной синхронизации доехали без перезагрузки
const REFRESH_MS = 30 * 60_000;

/**
 * Один учебный день, который живёт вместе с часами: текущий урок подсвечен
 * и показывает, сколько осталось, на перемене — через сколько следующий,
 * прошедшие бледнеют, а после последнего урока виджет сам переходит на
 * следующий учебный день. Стрелки листают дни без запроса к серверу.
 *
 * @param days учебные дни по возрастанию (lessonDays), у блоков — цвет `color`
 * @param wanted дата из адреса; пока её нет, день выбирается по часам
 * @param initialNow время сервера — с ним совпадает первая отрисовка
 */
export default function CompactDay({ days, wanted, initialNow }) {
  const router = useRouter();
  const [now, setNow] = useState(initialNow);
  // null — день выбирается по часам; дата — его выбрали стрелкой или адресом
  const [picked, setPicked] = useState(() =>
    days.some((d) => d.iso === wanted) ? wanted : null
  );

  useEffect(() => {
    const tick = () => setNow(tallinnNow());
    tick();
    const timer = setInterval(tick, TICK_MS);
    const refresh = setInterval(() => router.refresh(), REFRESH_MS);
    // из фоновой вкладки таймеры приходят с опозданием — догоняем сразу
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  const auto = autoIndex(days, now);
  const found = picked ? days.findIndex((d) => d.iso === picked) : -1;
  const index = found < 0 ? auto : found;
  const day = days[index];

  const label = dayLabel(day.iso, now.day);
  const [, m, d] = day.iso.split("-");
  const isToday = day.iso === now.day;
  const inLesson =
    isToday &&
    day.blocks.some((b) => toMinutes(b.from) <= now.minutes && now.minutes < toMinutes(b.to));
  // на перемене и до первого урока — «algab … pärast» у следующего; во время
  // урока хватает «veel …» у текущего
  const upcoming =
    isToday && !inLesson ? day.blocks.findIndex((b) => toMinutes(b.from) > now.minutes) : -1;

  const go = (i) => setPicked(i === auto ? null : days[i].iso);

  return (
    <>
      <div className="cday-head">
        <Arrow onClick={index > 0 ? () => go(index - 1) : null} label="Eelmine päev" glyph="‹" />
        <div className="cday-title">
          {index === auto ? (
            <b>{label}</b>
          ) : (
            <button type="button" onClick={() => setPicked(null)} title="Tagasi tänasesse">
              {label}
            </button>
          )}
          <span>{label === day.weekday ? `${d}.${m}` : `${day.weekday} · ${d}.${m}`}</span>
        </div>
        <Arrow
          onClick={index < days.length - 1 ? () => go(index + 1) : null}
          label="Järgmine päev"
          glyph="›"
        />
      </div>

      <ol className="cday-list">
        {day.blocks.map((b, i) => {
          const from = toMinutes(b.from);
          const to = toMinutes(b.to);
          const current = isToday && from <= now.minutes && now.minutes < to;
          const done = isToday && to <= now.minutes;
          const next = i === upcoming;

          return (
            <li
              key={`${b.from}-${i}`}
              className={current ? "now" : done ? "done" : undefined}
              style={{ "--c": b.color }}
            >
              <span className="t">
                {b.from}–{b.to}
                {current ? <em> · veel {duration(to - now.minutes)}</em> : null}
                {next ? <em> · algab {duration(from - now.minutes)} pärast</em> : null}
              </span>
              <span className="s">{b.subject}</span>
              {b.room ? <span className="r">{b.room}</span> : null}
              {current ? (
                <span
                  className="bar"
                  style={{ "--p": `${Math.round(((now.minutes - from) / (to - from)) * 100)}%` }}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <a
        className="cday-more"
        href={`/?w=${encodeURIComponent(day.weekId)}`}
        target="_blank"
        rel="noopener"
      >
        Kogu nädal →
      </a>
    </>
  );
}

function Arrow({ onClick, label, glyph }) {
  return (
    <button
      type="button"
      className="cday-arrow"
      onClick={onClick ?? undefined}
      disabled={!onClick}
      aria-label={label}
      title={label}
    >
      {glyph}
    </button>
  );
}
