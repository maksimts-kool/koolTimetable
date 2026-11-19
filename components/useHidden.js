"use client";

import { useCallback, useEffect, useState } from "react";
import { parseHidden } from "@/lib/optional";

const KEY = "tunniplaan:hidden";
// событие в этой же вкладке: storage приходит только в соседние
const EVENT = "tunniplaan:hidden";

function read() {
  try {
    return parseHidden(localStorage.getItem(KEY));
  } catch {
    return new Set();
  }
}

/**
 * Скрытые необязательные предметы («не хожу на B2»). Выбор помнится в
 * браузере и общий для всех страниц: переключили на «Сегодня» — он же
 * действует в сетке недели и в адресе ленты календаря.
 *
 * localStorage читаем после гидрации: на сервере его нет, а разошедшуюся
 * разметку React бы не простил.
 */
export default function useHidden() {
  const [hidden, setHidden] = useState(() => new Set());

  useEffect(() => {
    const sync = () => setHidden(read());
    sync();
    const onStorage = (e) => e.key === KEY && sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setAttends = useCallback((id, attends) => {
    const next = read();
    if (attends) next.delete(id);
    else next.add(id);
    setHidden(next);
    try {
      localStorage.setItem(KEY, [...next].join(","));
    } catch {
      /* не сохранилось — на этой странице всё равно применится */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [hidden, setAttends];
}
