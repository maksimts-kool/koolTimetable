"use client";

import { useEffect, useState } from "react";
import useHidden from "@/components/useHidden";
import { OPTIONAL_SUBJECTS } from "@/lib/optional";

const PATH = "/tunniplaan.ics";

const APPS = [
  {
    label: "Google",
    steps: [
      "Открой calendar.google.com на компьютере.",
      "Слева у «Другие календари» нажми «+» → «Добавить по URL».",
      "Вставь адрес ленты и нажми «Добавить календарь».",
    ],
  },
  {
    label: "iPhone / Mac",
    steps: [
      "Нажми «Открыть в календаре» выше — или открой «Настройки» → «Календарь» → «Учётные записи».",
      "Выбери «Добавить учётную запись» → «Другое» → «Подписной календарь».",
      "Вставь адрес ленты и сохрани.",
    ],
  },
  {
    label: "Outlook",
    steps: [
      "Открой Outlook в браузере и перейди в «Календарь».",
      "Нажми «Добавить календарь» → «Подписаться из Интернета».",
      "Вставь адрес ленты, дай календарю имя и импортируй.",
    ],
  },
];

/**
 * Подписка на ленту календаря. Сам адрес известен только в браузере, поэтому
 * до гидрации в поле стоит путь, а потом — полный адрес. Ссылка webcal://
 * на телефоне и в macOS сразу предлагает подписаться.
 */
export default function Subscribe() {
  const [hidden, setAttends] = useHidden();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => setOrigin(window.location.origin), []);

  const hide = [...hidden].join(",");
  const path = hide ? `${PATH}?hide=${encodeURIComponent(hide)}` : PATH;
  const url = `${origin}${path}`;
  useEffect(() => setCopied(false), [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="page-top narrow rise" style={{ "--i": 0 }}>
        <div>
          <h1>Расписание в твоём календаре</h1>
          <p className="sub">
            Подпишись один раз — занятия появятся в телефоне и будут обновляться сами, когда меняется расписание.
          </p>
        </div>
      </div>

      <section aria-labelledby="link-h" className="feed rise" style={{ "--i": 1 }}>
        <h2 id="link-h">Адрес ленты</h2>
        <div className="feed-row">
          <label className="feed-field">
            <span className="sr-only">Адрес ленты календаря</span>
            <input type="text" readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <button type="button" onClick={copy} className={`btn feed-copy${copied ? " done" : ""}`}>
            <span key={copied ? "y" : "n"} className="swap">
              {copied ? "Скопировано" : "Скопировать"}
            </span>
          </button>
          <a href={origin ? `webcal://${new URL(origin).host}${path}` : path} className="btn feed-open">
            Открыть в календаре
          </a>
        </div>
        {OPTIONAL_SUBJECTS.map((o) => (
          <label key={o.id} className="feed-check">
            <input type="checkbox" checked={!hidden.has(o.id)} onChange={(e) => setAttends(o.id, e.target.checked)} />
            Включать {o.label}
          </label>
        ))}
      </section>

      <section aria-labelledby="how-h" className="panel how rise" style={{ "--i": 2 }}>
        <h2 id="how-h">Как подписаться</h2>
        <div role="tablist" aria-label="Приложение" className="seg">
          {APPS.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              id={`tab-${i}`}
              aria-selected={i === tab}
              aria-controls="how-steps"
              onClick={() => setTab(i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <ol id="how-steps" role="tabpanel" aria-labelledby={`tab-${tab}`} className="steps" key={tab}>
          {APPS[tab].steps.map((s, i) => (
            <li key={s} style={{ "--i": i }}>
              <span aria-hidden="true">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="hint-line rise" style={{ "--i": 3 }}>
        Календари обновляют подписки не мгновенно: Google — раз в несколько часов, Apple и Outlook — чаще. Время
        занятий — по Таллину.
      </p>
    </>
  );
}
