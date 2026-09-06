/**
 * Хранилище недель. Три драйвера, выбираются по переменным окружения:
 *   supabase — если заданы SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (прод);
 *   blob     — если задан BLOB_READ_WRITE_TOKEN (Vercel Blob);
 *   local    — иначе: папка .data рядом с проектом (локальная разработка).
 * Код приложения работает с любым из них одинаково.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { revalidateTag, unstable_cache } from "next/cache";

const TABLE = "weeks";
const LOCAL_DIR = path.join(process.cwd(), ".data", "weeks");

export function driverName() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
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

/* ---------------- supabase ---------------- */

// Клиент один на процесс: и динамический import, и createClient стоят заметно
// дороже самого запроса, а на страницу их приходилось по два.
let clientPromise;

function supabase() {
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  );
  return clientPromise;
}

const fromRow = (row) => ({ ...row.data, id: row.id, uploadedAt: row.uploaded_at, fileName: row.file_name });

const supabaseDriver = {
  async list() {
    const db = await supabase();
    const { data, error } = await db
      .from(TABLE)
      .select("id, group_name, programme, week_start, week_end, lesson_count, file_name, uploaded_at")
      .order("week_start", { ascending: false });
    if (error) throw new Error(`Supabase: ${error.message}`);
    return data.map((r) => ({
      id: r.id,
      group: r.group_name,
      programme: r.programme,
      weekStart: r.week_start,
      weekEnd: r.week_end,
      lessonCount: r.lesson_count,
      fileName: r.file_name,
      uploadedAt: r.uploaded_at,
    }));
  },
  async listFull() {
    const db = await supabase();
    const { data, error } = await db
      .from(TABLE)
      .select("id, data, file_name, uploaded_at")
      .order("week_start", { ascending: false });
    if (error) throw new Error(`Supabase: ${error.message}`);
    return data.map(fromRow);
  },
  async get(id) {
    const db = await supabase();
    const { data, error } = await db.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase: ${error.message}`);
    return data ? fromRow(data) : null;
  },
  async latest() {
    const db = await supabase();
    const { data, error } = await db
      .from(TABLE)
      .select("*")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase: ${error.message}`);
    return data ? fromRow(data) : null;
  },
  // Из строки берём только расписание: остальные колонки палитре не нужны, а
  // недель в таблице много.
  async subjects() {
    const db = await supabase();
    const { data, error } = await db.from(TABLE).select("data");
    if (error) throw new Error(`Supabase: ${error.message}`);
    return subjectsOf(data.map((r) => r.data));
  },
  async save(week) {
    const db = await supabase();
    const { error } = await db.from(TABLE).upsert({
      id: week.id,
      group_name: week.group,
      programme: week.programme,
      week_start: week.weekStart,
      week_end: week.weekEnd,
      lesson_count: week.lessonCount,
      file_name: week.fileName,
      uploaded_at: week.uploadedAt,
      data: week,
    });
    if (error) throw new Error(`Supabase: ${error.message}`);
  },
  async remove(id) {
    const db = await supabase();
    const { error } = await db.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(`Supabase: ${error.message}`);
  },
};

/* ---------------- vercel blob ---------------- */

const blobKey = (id) => `weeks/${id}.json`;

const blobDriver = {
  async listFull() {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "weeks/" });
    const weeks = await Promise.all(
      blobs.map(async (b) => (await fetch(b.url, { cache: "no-store" })).json())
    );
    return weeks.sort(byWeekDesc);
  },
  async list() {
    return (await blobDriver.listFull()).map(meta);
  },
  async latest() {
    return (await blobDriver.listFull())[0] ?? null;
  },
  async subjects() {
    return subjectsOf(await blobDriver.listFull());
  },
  async get(id) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: blobKey(id) });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    return res.json();
  },
  async save(week) {
    const { put } = await import("@vercel/blob");
    await put(blobKey(week.id), JSON.stringify(week), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  },
  async remove(id) {
    const { list, del } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: blobKey(id) });
    await Promise.all(blobs.map((b) => del(b.url)));
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

const drivers = { supabase: supabaseDriver, blob: blobDriver, local: localDriver };

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
