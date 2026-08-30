"use client";

import { useEffect, useState } from "react";

const PATH = "/tunniplaan.ics";

/**
 * Ссылка на подписку календаря. Сам адрес известен только в браузере, поэтому
 * до гидрации показываем обычную ссылку на файл, а потом подменяем на
 * webcal:// — по нему календарь на телефоне и в macOS предлагает подписаться
 * сразу. Для Google Calendar («добавить по URL») рядом кнопка копирования.
 */
export default function IcalLink() {
  const [href, setHref] = useState(PATH);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHref(`webcal://${window.location.host}${PATH}`);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${PATH}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="ical">
      <a href={href}>Подписаться в календаре</a>
      <button type="button" onClick={copy} title="Скопировать адрес ленты для Google Calendar">
        {copied ? "скопировано" : "копировать ссылку"}
      </button>
    </span>
  );
}
