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

    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    post();
    return () => observer.disconnect();
  }, []);

  return null;
}
