"use client";

import { useEffect, useState } from "react";
import { clientDate, onSimChange, readSim, writeSim } from "@/lib/sim";

const fmt = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Tallinn",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Плашка «идёт симуляция» в углу расписания — чтобы выдуманное время не
 * приняли за настоящее. Есть только в браузере, где симуляцию включили; на
 * сервере и до гидрации её нет вовсе.
 */
export default function SimBadge() {
  const [sim, setSim] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const sync = () => setSim(readSim());
    sync();
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    const off = onSimChange(sync);
    return () => {
      clearInterval(timer);
      off();
    };
  }, []);

  if (!sim) return null;

  return (
    <div className="sim-badge" role="status">
      <span className="sim-dot" aria-hidden="true" />
      <span>
        Симуляция: <b>{fmt.format(clientDate())}</b>
      </span>
      <button type="button" onClick={() => writeSim(null)}>
        Выключить
      </button>
    </div>
  );
}
