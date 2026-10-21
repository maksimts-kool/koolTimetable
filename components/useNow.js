"use client";

import { useEffect, useState } from "react";
import { tallinnClock } from "@/lib/day";

/**
 * Часы по Таллину, которые идут, пока страница открыта.
 *
 * @param initial время сервера — с ним совпадает первая отрисовка; null, если
 *   компонент всё равно рисуется только в браузере
 * @param ms как часто тикать: обратному отсчёту нужна секунда, сетке хватит
 *   и полминуты — каждый тик перерисовывает календарь целиком
 */
export default function useNow(initial, ms) {
  const [now, setNow] = useState(initial);

  useEffect(() => {
    const tick = () => setNow(tallinnClock());
    tick();
    const timer = setInterval(tick, ms);
    // из фоновой вкладки таймеры приходят с опозданием — догоняем сразу
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms]);

  return now;
}
