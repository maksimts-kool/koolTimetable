"use client";

/**
 * Переключатель «хожу / не хожу» для необязательного предмета: значок с
 * цветом предмета, подпись и тумблер. Это настоящий switch — Tab и пробел
 * работают как у галочки.
 *
 * @param option запись из OPTIONAL_SUBJECTS
 * @param color цвет предмета в палитре (значок)
 */
export default function OptSwitch({ option, attends, onChange, color }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={attends}
      className={`optswitch${attends ? " on" : ""}`}
      style={{ "--c": color ?? "var(--ink)" }}
      onClick={() => onChange(option.id, !attends)}
      title={option.hint}
    >
      <span className="optswitch-badge" aria-hidden="true">
        {option.badge}
      </span>
      <span className="optswitch-text">
        <b>{option.toggle ?? option.label}</b>
        <span>{attends ? "Видно в расписании и календаре" : "Скрыто — экзамен сдан"}</span>
      </span>
      <span className="optswitch-track" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
