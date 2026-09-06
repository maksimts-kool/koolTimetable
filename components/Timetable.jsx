"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import { BoardSkeleton } from "@/components/Skeletons";
import { assignColors } from "@/lib/colors";
import { plural } from "@/lib/format";

const ET_WEEKDAYS = ["Pühapäev", "Esmaspäev", "Teisipäev", "Kolmapäev", "Neljapäev", "Reede", "Laupäev"];
// Дни недели с понедельника — в таком порядке кружки стоят в карточке предмета.
const ET_DAY_LETTERS = ["E", "T", "K", "N", "R", "L", "P"];
const ET_DAY_NAMES = ET_WEEKDAYS.slice(1).concat(ET_WEEKDAYS[0]);
const LESSON_MINUTES = 45;
const NARROW = "(max-width:820px)";

// FullCalendar рисуется только в браузере: на сервере от него не остаётся ни
// строчки разметки. Пока он не смонтировался, место под сетку пустое, и в
// момент появления календарь отодвигал легенду с подвалом вниз — страница
// заметно дёргалась (CLS 0.66 при пороге «хорошо» 0.1). Поэтому высоту сетки
// считаем заранее и держим её как min-height.
//
// Числа сняты с готовой сетки: шапка дней и одна пятнадцатиминутная строка.
// Это оценка — она лишь резервирует место, итоговый размер календарь всё равно
// задаёт себе сам.
const DAY_HEADER_PX = 60;
const SLOT_PX = 25;
const SLOT_MINUTES = 15;

/** Воскресенье = 0 у JS, а нам нужен понедельник = 0. */
const weekdayIndex = (iso) => (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;

const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const iso = (dmy) => {
  const [d, m, y] = dmy.split(".");
  return `${y}-${m}-${d}`;
};
const isoOfDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Перерыв ≥30 мин, попадающий в обеденное окно, — рисуем как «Lõuna». */
function lunchGaps(days) {
  const gaps = [];
  for (const day of days) {
    const sorted = [...day.blocks].sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
    for (let i = 1; i < sorted.length; i++) {
      const from = toMinutes(sorted[i - 1].to);
      const to = toMinutes(sorted[i].from);
      if (to - from >= 30 && from >= 11 * 60 && to <= 14 * 60) {
        gaps.push({ date: iso(day.date), from: hhmm(from), to: hhmm(to) });
      }
    }
  }
  return gaps;
}

/**
 * @param week неделя к показу
 * @param allSubjects названия предметов по всем неделям сразу. Палитра
 *   считается по ним, а не по видимой неделе: во-первых, галочка «не хожу»
 *   иначе перекрашивала бы всю неделю, во-вторых, цвета расставляются по
 *   набору предметов — а он у каждой недели свой, и один предмет менял бы
 *   цвет при переходе на соседнюю неделю.
 */
export default function Timetable({ week, allSubjects }) {
  const model = useMemo(() => {
    const events = [];
    const subjects = new Map();
    // предметы недели добавляем и сами: список сверху мог не доехать или
    // отстать от только что загруженной недели, а без цвета карточка упадёт
    const palette = assignColors([
      ...(allSubjects ?? []),
      ...week.days.flatMap((d) => d.blocks.map((b) => b.subject)),
    ]);
    let earliest = 24 * 60;
    let latest = 0;
    const weekdaysWithLessons = new Set();

    for (const day of week.days) {
      const date = iso(day.date);
      weekdaysWithLessons.add(new Date(`${date}T12:00:00`).getDay());
      const weekday = weekdayIndex(date);

      for (const block of day.blocks) {
        const color = palette.get(block.subject);
        earliest = Math.min(earliest, toMinutes(block.from));
        latest = Math.max(latest, toMinutes(block.to));

        const stat =
          subjects.get(block.subject) ?? { lessons: 0, teacher: block.teacher, color, days: new Set() };
        stat.lessons += block.lessons;
        stat.days.add(weekday);
        subjects.set(block.subject, stat);

        events.push({
          start: `${date}T${block.from}:00`,
          end: `${date}T${block.to}:00`,
          title: block.subject,
          backgroundColor: color.bg,
          borderColor: color.border,
          textColor: "#fff",
          extendedProps: { ...block },
        });
      }
    }

    for (const gap of lunchGaps(week.days)) {
      events.push({
        start: `${gap.date}T${gap.from}:00`,
        end: `${gap.date}T${gap.to}:00`,
        display: "background",
        classNames: ["lunch"],
        title: gap.date === iso(week.days[0].date) ? "Lõuna" : "",
      });
    }

    if (latest === 0) {
      // неделя без уроков (например, скрыт единственный предмет) — сетка всё
      // равно должна быть валидной: слот «до» не может быть раньше слота «от»
      earliest = 8 * 60;
      latest = 16 * 60;
    }

    const minTime = `${String(Math.floor(Math.max(earliest - 30, 0) / 60)).padStart(2, "0")}:00:00`;
    const maxTime = `${hhmm(Math.min(latest + 15, 23 * 60 + 45))}:00`;

    const busyDates = new Set(week.days.map((d) => iso(d.date)));
    const hiddenDays = [0, 6].filter((d) => !weekdaysWithLessons.has(d));
    const lessons = [...subjects.values()].reduce((sum, s) => sum + s.lessons, 0);

    return {
      events,
      busyDates,
      hiddenDays,
      lessons,
      minTime,
      maxTime,
      boardHeight: DAY_HEADER_PX + ((toMinutes(maxTime) - toMinutes(minTime)) / SLOT_MINUTES) * SLOT_PX,
      subjects: [...subjects.entries()].sort((a, b) => b[1].lessons - a[1].lessons),
    };
  }, [week, allSubjects]);

  const calendarRef = useRef(null);

  // Вид зависит от ширины экрана, а её на сервере не измерить: там нет window,
  // и рендер обязан быть чистым. Поэтому вид — состояние, и до первого замера
  // он null: в этот момент FullCalendar ещё не нужен, на его месте заглушка.
  // Она же закрывает паузу до гидрации — календарь рисуется только в браузере,
  // и раньше доска всё это время стояла пустой.
  //
  // Слушаем не resize (прежний обработчик дёргался на каждый пиксель
  // перетаскивания окна), а сам медиазапрос — он срабатывает один раз, на
  // переходе через границу.
  const [view, setView] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const apply = () => setView(mq.matches ? "listWeek" : "timeGridWeek");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Готовому календарю новый initialView уже безразличен — вид у него меняется
  // только этой командой. Зато при пересоздании (смена недели, повторное
  // подключение в разработке) initialView оказывается верным сразу.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (view && api && api.view.type !== view) api.changeView(view);
  }, [view, week.id]);

  return (
    <>
      {/* высота известна заранее — резервируем её, чтобы появление календаря
          не сдвигало легенду и подвал */}
      <div className="board" style={{ "--board-h": `${model.boardHeight}px` }}>
        {view ? (
          <FullCalendar
            /* key: initialDate применяется только при монтировании, поэтому при
             смене недели календарь пересоздаём — иначе он остался бы на прежних датах */
            key={week.id}
            ref={calendarRef}
            plugins={[timeGridPlugin, listPlugin]}
            initialView={view}
            initialDate={week.weekStart}
            firstDay={1}
            hiddenDays={model.hiddenDays}
            headerToolbar={false}
            allDaySlot={false}
            nowIndicator
            height="auto"
            expandRows
            slotMinTime={model.minTime}
            slotMaxTime={model.maxTime}
            slotDuration="00:15:00"
            slotLabelInterval="01:00:00"
            slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            noEventsText="На эту неделю занятий нет"
            events={model.events}
            dayHeaderContent={(arg) => {
              const date = isoOfDate(arg.date);
              const free = !model.busyDates.has(date);
              const [y, m, d] = date.split("-");
              return (
                <div className={`dayhead${free ? " free" : ""}`}>
                  <span className="dn">{ET_WEEKDAYS[arg.date.getDay()]}</span>
                  <span className={free ? "free-tag" : "dd"}>{free ? "Tunde pole" : `${d}.${m}.${y}`}</span>
                </div>
              );
            }}
            eventContent={(arg) => {
              const p = arg.event.extendedProps;
              if (arg.event.display === "background") {
                return <div className="fc-event-title">{arg.event.title}</div>;
              }
              if (arg.view.type === "listWeek") {
                return (
                  <div>
                    <div className="lname">{arg.event.title}</div>
                    <div className="lmeta">
                      {[p.teacher, p.room, p.lessons > 1 ? plural(p.lessons) : null, p.groups]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                );
              }
              return (
                <div className="ev">
                  <div className="name">{arg.event.title}</div>
                  <div className="t">
                    {p.from} – {p.to}
                  </div>
                  {p.groups && p.groups.includes(",") ? <div className="shared">{p.groups}</div> : null}
                  <div className="meta">
                    <span>{p.teacher}</span>
                    <span className="room">{p.room}</span>
                  </div>
                  {p.lessons > 1 ? <div className="n">{p.lessons}×</div> : null}
                </div>
              );
            }}
          />
        ) : (
          <BoardSkeleton height={model.boardHeight} />
        )}
      </div>

      <section className="legend">
        <h2>Предметы недели</h2>
        <div className="subs">
          {model.subjects.map(([name, stat]) => {
            const minutes = stat.lessons * LESSON_MINUTES;
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            return (
              <div
                className="sub"
                key={name}
                style={{ "--fill": stat.color.bg, "--bar": stat.color.border }}
              >
                <div>
                  <div className="name">{name}</div>
                  <div className="who">{stat.teacher}</div>
                </div>
                <div className="side">
                  <div className="hrs">
                    {stat.lessons} × 45′ · {h ? `${h} ч` : ""}
                    {m ? `${h ? " " : ""}${m} мин` : ""}
                  </div>
                  <div className="days">
                    {[...stat.days]
                      .sort((a, b) => a - b)
                      .map((d) => (
                        <span key={d} className="day" title={ET_DAY_NAMES[d]}>
                          {ET_DAY_LETTERS[d]}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
