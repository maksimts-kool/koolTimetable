/** «2026-08-31» → «31.08.2026» */
export function ruDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** «2026-08-31» → «31.08» */
export function shortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

/** Русское склонение: 1 урок, 2 урока, 5 уроков. */
export function plural(n, one = "урок", few = "урока", many = "уроков") {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}
