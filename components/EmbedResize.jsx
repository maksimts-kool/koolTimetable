"use client";

import { useEffect } from "react";

/**
 * Сообщает странице-родителю высоту содержимого фрейма, чтобы тот растянулся
 * без собственной полосы прокрутки. Меряем body, а не documentElement: высота
 * документа не бывает меньше самого фрейма, и он бы никогда не сжимался.
 *
 * Родитель слушает сообщения вида { type: "tunniplaan:height", height }.
 */
export default function EmbedResize() {
  useEffect(() => {
    if (window.parent === window) return;

    let last = 0;
    const post = () => {
      const height = Math.ceil(document.body.getBoundingClientRect().height);
      if (height === last) return;
      last = height;
      // высота — не секрет, поэтому адресата не ограничиваем: встраивающий
      // сайт сам проверяет, от кого пришло сообщение
      window.parent.postMessage({ type: "tunniplaan:height", height }, "*");
    };

    // ResizeObserver живёт в цикле отрисовки, а его браузер придерживает для
    // фрейма вне экрана: неделя, пришедшая потоком на смену заглушке, иногда
    // так и оставалась обрезанной по высоте заглушки. Смену разметки и
    // загрузку шрифта ловим отдельно — эти события не ждут отрисовки.
    const resized = new ResizeObserver(post);
    const mutated = new MutationObserver(post);
    resized.observe(document.body);
    mutated.observe(document.body, { childList: true, subtree: true });
    document.fonts?.ready.then(post);
    post();
    return () => {
      resized.disconnect();
      mutated.disconnect();
    };
  }, []);

  return null;
}
