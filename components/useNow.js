"use client";

import { useEffect, useState } from "react";
import { tallinnClock } from "@/lib/day";
import { clientDate, onSimChange, readSim } from "@/lib/sim";

/**
 * Часы по Таллину, которые идут, пока страница открыта. Учитывают симуляцию
 * времени из админки (lib/sim.js).
 *
 * @param initial время сервера — с ним совпадает первая отрисовка; null, если
 *   компонент всё равно рисуется только в браузере
 * @param ms как часто тикать: обратному отсчёту нужна секунда, сетке хватит
 *   и полминуты — каждый тик перерисовывает календарь целиком. Ускоренная
 *   симуляция тикает раз в секунду всегда, иначе она шла бы рывками.
 */
export default function useNow(initial, ms) {
  const [now, setNow] = useState(initial);
  const [fast, setFast] = useState(false);

  useEffect(() => {
    const tick = () => setNow(tallinnClock(clientDate()));
    const sync = () => {
      setFast((readSim()?.speed ?? 1) > 1);
      tick();
    };
    sync();
    const timer = setInterval(tick, fast ? Math.min(ms, 1000) : ms);
    // из фоновой вкладки таймеры приходят с опозданием — догоняем сразу
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    const offSim = onSimChange(sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      offSim();
    };
  }, [ms, fast]);

  return now;
}
