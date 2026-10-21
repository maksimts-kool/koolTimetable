/**
 * Симуляция времени для проверки «живых» частей страницы: полосы «сегодня»,
 * линии «сейчас», прошедших и идущих уроков. Включается в админке и живёт
 * только в localStorage этого браузера — сервер и другие посетители видят
 * настоящее время.
 *
 * Хранится точка отсчёта: какое время было выставлено (`at`) и когда
 * (`setAt`, по настоящим часам). Дальше часы идут сами, со скоростью `speed`.
 */

const KEY = "tunniplaan:sim";
/** Событие в этой же вкладке: storage приходит только в соседние. */
export const SIM_EVENT = "tunniplaan:sim";

export function readSim() {
  try {
    const sim = JSON.parse(localStorage.getItem(KEY));
    if (sim && Number.isFinite(sim.at) && Number.isFinite(sim.setAt)) {
      return { ...sim, speed: Number(sim.speed) > 0 ? Number(sim.speed) : 1 };
    }
  } catch {
    /* на сервере localStorage нет, в приватном режиме он бывает закрыт */
  }
  return null;
}

/** @param sim { at, speed } или null — выключить */
export function writeSim(sim) {
  try {
    if (sim) localStorage.setItem(KEY, JSON.stringify({ ...sim, setAt: Date.now() }));
    else localStorage.removeItem(KEY);
  } catch {
    /* не сохранилось — симуляции просто не будет */
  }
  window.dispatchEvent(new Event(SIM_EVENT));
}

/** Текущий момент с учётом симуляции. */
export function clientDate() {
  const sim = typeof window === "undefined" ? null : readSim();
  return sim ? new Date(sim.at + (Date.now() - sim.setAt) * sim.speed) : new Date();
}

/** Подписка на включение, выключение и смену симуляции — в любой вкладке. */
export function onSimChange(callback) {
  const onStorage = (e) => e.key === KEY && callback();
  window.addEventListener(SIM_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SIM_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** «2026-10-21T10:20» по Таллину → миллисекунды эпохи. */
export function tallinnToEpoch(local) {
  const [date, time = "00:00"] = local.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // сдвиг Таллина в этот момент (+2 зимой, +3 летом): смотрим, сколько
  // показывают его часы, когда в UTC столько же
  const shown = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Tallinn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(asUtc));
  const [sd, st] = shown.split(" ");
  const [sy, smo, sdd] = sd.split("-").map(Number);
  const [sh, smi] = st.split(":").map(Number);
  const offset = Date.UTC(sy, smo - 1, sdd, sh, smi) - asUtc;
  return asUtc - offset;
}
