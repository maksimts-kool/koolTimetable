/**
 * Хранилище недель. Три драйвера, выбираются по переменным окружения:
 *   supabase — если заданы SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (прод);
 *   blob     — если задан BLOB_READ_WRITE_TOKEN (Vercel Blob);
 *   local    — иначе: папка .data рядом с проектом (локальная разработка).
 * Код приложения работает с любым из них одинаково.
 */

import fs from "node:fs/promises";
import path from "node:path";

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

/* ---------------- supabase ---------------- */

async function supabase() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
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
  async get(id) {
    const db = await supabase();
    const { data, error } = await db.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase: ${error.message}`);
    return data ? fromRow(data) : null;
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
  async list() {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "weeks/" });
    const weeks = await Promise.all(
      blobs.map(async (b) => {
        const res = await fetch(b.url, { cache: "no-store" });
        return meta(await res.json());
      })
    );
    return weeks.sort(byWeekDesc);
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
  async list() {
    let files = [];
    try {
      files = await fs.readdir(LOCAL_DIR);
    } catch {
      return [];
    }
    const weeks = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => meta(JSON.parse(await fs.readFile(path.join(LOCAL_DIR, f), "utf8"))))
    );
    return weeks.sort(byWeekDesc);
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

export const listWeeks = () => store.list();
export const getWeek = (id) => store.get(id);
export const saveWeek = (week) => store.save(week);
export const deleteWeek = (id) => store.remove(id);
