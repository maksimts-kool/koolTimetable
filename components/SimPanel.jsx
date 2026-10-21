"use client";

import { useEffect, useState } from "react";
import useNow from "@/components/useNow";
import { tallinnNow } from "@/lib/day";
import { onSimChange, readSim, tallinnToEpoch, writeSim } from "@/lib/sim";

const SPEEDS = [1, 10, 60, 300];
// типовые моменты учебного дня — одним нажатием
const PRESETS = [
  ["08:15", "до уроков"],
  ["10:20", "урок"],
  ["11:50", "перемена"],
  ["13:00", "после обеда"],
  ["17:30", "после уроков"],
];

const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;

/**
 * Симуляция времени: подставляет выдуманное «сейчас» в полосу «сегодня»,
 * линию времени и подсветку уроков — чтобы посмотреть их утром, на перемене
 * или в конце дня, не дожидаясь этого момента. Действует только в этом
 * браузере (lib/sim.js).
 */
export default function SimPanel() {
  const [sim, setSim] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:20");
  const [speed, setSpeed] = useState(1);
  const now = useNow(null, 1000);

  // Всё из localStorage и часов — после гидрации: на сервере их нет
  useEffect(() => {
    const sync = () => {
      const current = readSim();
      setSim(current);
      if (current) setSpeed(current.speed);
    };
    sync();
    setDate((d) => d || tallinnNow().day);
    return onSimChange(sync);
  }, []);

  const start = (at = time) => {
    if (!date || !at) return;
    setTime(at);
    writeSim({ at: tallinnToEpoch(`${date}T${at}`), speed });
  };

  const changeSpeed = (value) => {
    setSpeed(value);
    // идущую симуляцию не сбрасываем на начало — продолжаем с того же момента
    if (sim && now) writeSim({ at: tallinnToEpoch(`${now.day}T${hhmm(now.minutes)}`), speed: value });
  };

  return (
    <div className="card">
      <h2>Симуляция времени</h2>
      <p className="hint">Расписание покажет выбранное время. Только в этом браузере.</p>

      <div className="form-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Дата" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Время" />
        <select
          value={speed}
          onChange={(e) => changeSpeed(Number(e.target.value))}
          aria-label="Скорость"
          style={{ minWidth: 0 }}
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s === 1 ? "×1" : `×${s}`}
            </option>
          ))}
        </select>
        <button className="primary" onClick={() => start()} disabled={!date}>
          {sim ? "Перезапустить" : "Запустить"}
        </button>
        {sim ? <button onClick={() => writeSim(null)}>Выключить</button> : null}
      </div>

      <div className="sim-presets">
        {PRESETS.map(([at, label]) => (
          <button key={at} type="button" onClick={() => start(at)} disabled={!date}>
            <b>{at}</b> {label}
          </button>
        ))}
      </div>

      {sim && now ? (
        <div className="msg warn" role="status">
          Симуляция: <b>{hhmm(now.minutes)}</b>{" "}
          <a href="/" target="_blank" rel="noopener">
            Открыть расписание ↗
          </a>
        </div>
      ) : null}
    </div>
  );
}
