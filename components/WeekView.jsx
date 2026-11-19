"use client";

import { useEffect, useMemo, useState } from "react";
import SimBadge from "@/components/SimBadge";
import SiteFooter from "@/components/SiteFooter";
import SubjectDialog from "@/components/SubjectDialog";
import useHidden from "@/components/useHidden";
import useNow from "@/components/useNow";
import WeekGrid from "@/components/WeekGrid";
import WeekPicker from "@/components/WeekPicker";
import { assignColors } from "@/lib/colors";
import { isoWeek, plural, ruRange } from "@/lib/format";
import { hideSubjects } from "@/lib/optional";

/**
 * Страница недели целиком на клиенте: скрытые в настройках предметы убираются
 * и из счётчиков в шапке, и из сетки.
 *
 * @param subjects названия предметов по всем неделям сразу — по ним считается
 *   палитра, поэтому предмет выглядит одинаково в любой неделе
 * @param embed страница во фрейме на чужом сайте: без ссылки на админку, а
 *   выбор недели остаётся на /embed
 */
export default function WeekView({ week, weeks, current, subjects, initialNow, embed = false }) {
  const [hidden] = useHidden();
  const [selected, setSelected] = useState(null);
  const clock = useNow(initialNow, 60_000);

  const shown = useMemo(() => hideSubjects(week, hidden), [week, hidden]);
  // Палитра — по предметам всех недель: иначе предмет менял бы цвет при
  // переходе на соседнюю неделю. Предметы недели добавляем и сами: общий
  // список мог отстать от только что загруженной недели.
  const palette = useMemo(
    () =>
      assignColors([
        ...(subjects ?? []),
        ...week.days.flatMap((d) => d.blocks.map((b) => b.subject)),
      ]),
    [week, subjects]
  );

  // предмет скрыли, пока его карточка открыта, — карточку закрываем
  const visible = selected && shown.days.some((d) => d.blocks.some((b) => b.subject === selected));
  useEffect(() => {
    if (selected && !visible) setSelected(null);
  }, [selected, visible]);

  const blocks = shown.days.reduce((sum, d) => sum + d.blocks.length, 0);
  const hours = shown.lessonCount;

  return (
    <>
      <section className="page-top rise" style={{ "--i": 0 }}>
        <div>
          <h1>Неделя {isoWeek(week.weekStart)}</h1>
          <p className="sub">
            {ruRange(week.weekStart, week.weekEnd)} · {plural(blocks, "занятие", "занятия", "занятий")} ·{" "}
            {plural(hours, "ак. час", "ак. часа", "ак. часов")}
          </p>
        </div>
        <div className="page-tools">
          <WeekPicker weeks={weeks} current={current} today={clock.day} path={embed ? "/embed" : "/week"} />
        </div>
      </section>

      <div className="week-wrap rise" style={{ "--i": 1 }}>
        <WeekGrid
          week={shown}
          palette={palette}
          selected={selected}
          onPick={(s) => setSelected((cur) => (cur === s ? null : s))}
        />
        <p className="hint-line">Нажми на занятие, чтобы увидеть преподавателя, кабинеты и все занятия предмета на неделе.</p>
      </div>

      <SiteFooter week={week} embed={embed} />

      {visible ? (
        <SubjectDialog
          key={selected}
          subject={selected}
          week={shown}
          color={palette.get(selected)?.bg}
          today={clock.day}
          onClose={() => setSelected(null)}
        />
      ) : null}

      <SimBadge />
    </>
  );
}

