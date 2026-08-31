"use client";

import { useEffect, useState } from "react";

const PATH = "/tunniplaan.ics";

/**
 * Ссылка на подписку календаря. Сам адрес известен только в браузере, поэтому
 * до гидрации показываем обычную ссылку на файл, а потом подменяем на
 * webcal:// — по нему календарь на телефоне и в macOS предлагает подписаться
 * сразу. Для Google Calendar («добавить по URL») рядом кнопка копирования.
 *
 * @param {string} hide id скрытых предметов через запятую — лента отдаёт
 *   расписание без них, чтобы календарь совпадал с сайтом
 */
export default function IcalLink({ hide = "" }) {
  const path = hide ? `${PATH}?hide=${encodeURIComponent(hide)}` : PATH;
  const [host, setHost] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setHost(window.location.host), []);
  useEffect(() => setCopied(false), [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="ical">
      <a href={host ? `webcal://${host}${path}` : path}>Подписаться в календаре</a>
      <button type="button" onClick={copy} title="Скопировать адрес ленты для Google Calendar">
        {copied ? "скопировано" : "копировать ссылку"}
      </button>
    </span>
  );
}
