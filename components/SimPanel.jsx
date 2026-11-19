"use client";

import { useEffect, useState } from "react";
import useNow from "@/components/useNow";
import { tallinnNow } from "@/lib/day";
import { hhmm } from "@/lib/format";
import { onSimChange, readSim, tallinnToEpoch, writeSim } from "@/lib/sim";

const SPEEDS = [1, 10, 60, 300];
// типовые моменты учебного дня — одним нажатием
const PRESETS = [
  ["08:15", "до занятий"],
  ["10:20", "занятие"],
  ["11:50", "перемена"],
  ["13:00", "после обеда"],
  ["17:30", "после занятий"],
];

/**
 * Симуляция времени: подставляет выдуманное «сейчас» в страницу «Сегодня»,
 * линию времени и подсветку занятий — чтобы посмотреть их утром, на перемене
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
    <section aria-labelledby="sim-h" className="panel rise" style={{ "--i": 3 }}>
      <div className="panel-head">
        <h2 id="sim-h">Симуляция времени</h2>
        {sim && now ? (
          <span className="badge warn live">
            <span className="sim-dot" aria-hidden="true" />
            идёт · {hhmm(now.minutes)}
          </span>
        ) : null}
      </div>
      <p className="hint">Сайт покажет выбранное время вместо настоящего. Только в этом браузере.</p>

      <div className="form-row">
        <label className="field">
          <span>Дата</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Время</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <div className="field">
          <span id="speed-l">Скорость</span>
          <div className="seg" role="radiogroup" aria-labelledby="speed-l">
            {SPEEDS.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={speed === s} onClick={() => changeSpeed(s)}>
                ×{s}
              </button>
            ))}
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn primary" onClick={() => start()} disabled={!date}>
            {sim ? "Перезапустить" : "Запустить"}
          </button>
          {sim ? (
            <button type="button" className="btn" onClick={() => writeSim(null)}>
              Выключить
            </button>
          ) : null}
        </div>
      </div>

      <div className="chips">
        {PRESETS.map(([at, label]) => (
          <button key={at} type="button" onClick={() => start(at)} disabled={!date}>
            <b>{at}</b> {label}
          </button>
        ))}
      </div>

      {sim ? (
        <p className="hint sim-open">
          <a href="/" target="_blank" rel="noopener">
            Открыть «Сегодня» в новой вкладке ↗
          </a>
        </p>
      ) : null}
    </section>
  );
}
