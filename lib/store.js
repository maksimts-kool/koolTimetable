/**
 * Хранилище недель. Два драйвера, выбираются по переменным окружения:
 *   mysql    — если задан MYSQL_HOST (прод: MariaDB на Zone);
 *   local    — иначе: папка .data рядом с проектом (локальная разработка).
 * Код приложения работает с любым из них одинаково.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { revalidateTag, unstable_cache } from "next/cache";

// своё имя таблицы: база на хостинге общая с другими проектами
const TABLE = "tunniplaan_weeks";
const LOCAL_DIR = path.join(process.cwd(), ".data", "weeks");

export function driverName() {
  if (process.env.MYSQL_HOST) return "mysql";
  return "local";
}

/** Идентификатор недели: группа + понедельник недели. */
export function weekId(group, weekStart) {
  return `${group}_${weekStart}`.replace(/[^A-Za-z0-9_.-]/g, "-");
}

const meta = (w) => ({
  id: w.id,
  group: w.group,
  programme: w.programme,
  weekStart: w.weekStart,
  weekEnd: w.weekEnd,
  lessonCount: w.lessonCount,
  fileName: w.fileName,
  uploadedAt: w.uploadedAt,
});

const byWeekDesc = (a, b) => b.weekStart.localeCompare(a.weekStart);

/**
 * Названия предметов из набора недель, без повторов и по алфавиту. По ним
 * строится палитра: цвет предмета не должен зависеть от того, какая неделя
 * открыта, поэтому список собирается сразу по всем неделям.
 */
const subjectsOf = (weeks) =>
  [
    ...new Set(
      (weeks ?? []).flatMap((w) =>
        (w?.days ?? []).flatMap((d) => (d?.blocks ?? []).map((b) => b.subject).filter(Boolean))
      )
    ),
  ].sort();

/* ---------------- mysql / mariadb ---------------- */

// Схема создаётся сама при первом подключении — отдельный SQL руками не нужен.
// data — полная неделя в JSON; остальные колонки дублируют её поля для
// сортировки и списка недель без разбора всего JSON.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    id           VARCHAR(100) NOT NULL PRIMARY KEY,
    group_name   VARCHAR(100) NOT NULL,
    programme    VARCHAR(255) NULL,
    week_start   DATE NOT NULL,
    week_end     DATE NOT NULL,
    lesson_count INT NOT NULL DEFAULT 0,
    file_name    VARCHAR(255) NULL,
    uploaded_at  DATETIME(3) NOT NULL,
    data         LONGTEXT NOT NULL CHECK (JSON_VALID(data)),
    KEY weeks_week_start_idx (week_start),
    KEY weeks_group_idx (group_name)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

// Пул один на процесс; таблицу проверяем один раз, на первом запросе.
let poolPromise;

function mysql() {
  poolPromise ??= (async () => {
    const { createPool } = await import("mysql2/promise");
    const pool = createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      connectionLimit: 4,
      // даты отдаём строками как есть: «2026-08-31», время — в UTC
      dateStrings: true,
      timezone: "Z",
      charset: "utf8mb4",
    });
    await pool.query(SCHEMA);
    return pool;
  })().catch((error) => {
    poolPromise = undefined; // следующий запрос попробует подключиться заново
    throw error;
  });
  return poolPromise;
}

async function sql(query, params) {
  try {
    const [rows] = await (await mysql()).query(query, params);
    return rows;
  } catch (error) {
    throw new Error(`MySQL: ${error.message}`);
  }
}

// DATETIME хранится в UTC без пояса: «2026-09-27 17:31:00.123» ↔ ISO-строка
const toSqlTime = (iso) => new Date(iso || Date.now()).toISOString().replace("T", " ").slice(0, 23);
const fromSqlTime = (value) => `${value.replace(" ", "T")}Z`;

// Колонку с проверкой JSON_VALID одни версии MariaDB отдают как JSON — и тогда
// mysql2 разбирает её сам, — другие как обычный текст.
const parseData = (data) => (typeof data === "string" ? JSON.parse(data) : data);

const fromRow = (row) => ({
  ...parseData(row.data),
  id: row.id,
  uploadedAt: fromSqlTime(row.uploaded_at),
  fileName: row.file_name,
});

const mysqlDriver = {
  async list() {
    const rows = await sql(
      `SELECT id, group_name, programme, week_start, week_end, lesson_count, file_name, uploaded_at
         FROM ${TABLE} ORDER BY week_start DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      group: r.group_name,
      programme: r.programme,
      weekStart: r.week_start,
      weekEnd: r.week_end,
      lessonCount: r.lesson_count,
      fileName: r.file_name,
      uploadedAt: fromSqlTime(r.uploaded_at),
    }));
  },
  async listFull() {
    const rows = await sql(
      `SELECT id, data, file_name, uploaded_at FROM ${TABLE} ORDER BY week_start DESC`
    );
    return rows.map(fromRow);
  },
  async get(id) {
    const rows = await sql(`SELECT id, data, file_name, uploaded_at FROM ${TABLE} WHERE id = ?`, [id]);
    return rows.length ? fromRow(rows[0]) : null;
  },
  async latest() {
    const rows = await sql(
      `SELECT id, data, file_name, uploaded_at FROM ${TABLE} ORDER BY week_start DESC LIMIT 1`
    );
    return rows.length ? fromRow(rows[0]) : null;
  },
  // Из строки берём только расписание: остальные колонки палитре не нужны.
  async subjects() {
    const rows = await sql(`SELECT data FROM ${TABLE}`);
    return subjectsOf(rows.map((r) => parseData(r.data)));
  },
  async save(week) {
    await sql(
      `INSERT INTO ${TABLE}
         (id, group_name, programme, week_start, week_end, lesson_count, file_name, uploaded_at, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         group_name = VALUES(group_name), programme = VALUES(programme),
         week_start = VALUES(week_start), week_end = VALUES(week_end),
         lesson_count = VALUES(lesson_count), file_name = VALUES(file_name),
         uploaded_at = VALUES(uploaded_at), data = VALUES(data)`,
      [
        week.id,
        week.group,
        week.programme || null,
        week.weekStart,
        week.weekEnd,
        week.lessonCount ?? 0,
        week.fileName || null,
        toSqlTime(week.uploadedAt),
        JSON.stringify(week),
      ]
    );
  },
  async remove(id) {
    await sql(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  },
};

/* ---------------- локальные файлы ---------------- */

const localDriver = {
  async listFull() {
    let files = [];
    try {
      files = await fs.readdir(LOCAL_DIR);
    } catch {
      return [];
    }
    const weeks = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => JSON.parse(await fs.readFile(path.join(LOCAL_DIR, f), "utf8")))
    );
    return weeks.sort(byWeekDesc);
  },
  async list() {
    return (await localDriver.listFull()).map(meta);
  },
  async latest() {
    return (await localDriver.listFull())[0] ?? null;
  },
  async subjects() {
    return subjectsOf(await localDriver.listFull());
  },
  async get(id) {
    try {
      return JSON.parse(await fs.readFile(path.join(LOCAL_DIR, `${id}.json`), "utf8"));
    } catch {
      return null;
    }
  },
  async save(week) {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, `${week.id}.json`), JSON.stringify(week, null, 2), "utf8");
  },
  async remove(id) {
    await fs.rm(path.join(LOCAL_DIR, `${id}.json`), { force: true });
  },
};

const drivers = { mysql: mysqlDriver, local: localDriver };

const store = drivers[driverName()];

/* ---------------- кэш чтений ---------------- */

/**
 * Расписание меняется редко: крон ходит в Tahvel раз в сутки, админ — руками.
 * Читать его из базы на каждый показ страницы незачем, поэтому чтения идут
 * через Data Cache, а записи сбрасывают его по тегу. `revalidate` подстрахует
 * случай, когда база поменялась мимо приложения.
 */
const TAG = "weeks";
const TTL = 300;

const cached = (fn, key) => unstable_cache(fn, [key], { tags: [TAG], revalidate: TTL });

const listCached = cached(() => store.list(), "weeks:list");
const listFullCached = cached(() => store.listFull(), "weeks:list-full");
const getCached = cached((id) => store.get(id), "weeks:get");
const latestCached = cached(() => store.latest(), "weeks:latest");
const subjectsCached = cached(() => store.subjects(), "weeks:subjects");

/** Запись прошла — показанные данные больше не действительны. */
function invalidate() {
  try {
    revalidateTag(TAG);
  } catch {
    // вне запроса (скрипт, тест) кэша всё равно нет — сбрасывать нечего
  }
}

/** Метаданные всех недель, от свежих к старым. */
export const listWeeks = () => listCached();

/** Все недели целиком — одним запросом вместо N штук по одной. */
export const listWeeksFull = () => listFullCached();

/**
 * Названия предметов по всем неделям сразу. Палитра считается по ним, а не по
 * одной открытой неделе: иначе один и тот же предмет от недели к неделе менял
 * бы цвет — набор предметов у недель разный, а цвета расставляются по набору.
 */
export const listSubjects = () => subjectsCached();

export const getWeek = (id) => getCached(id);

/** Самая свежая неделя — её показывает главная, когда неделя не выбрана. */
export const latestWeek = () => latestCached();

export async function saveWeek(week) {
  await store.save(week);
  invalidate();
}

export async function deleteWeek(id) {
  await store.remove(id);
  invalidate();
}
