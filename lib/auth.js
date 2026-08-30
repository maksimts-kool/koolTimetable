/**
 * Вход администратора: один пароль из переменной окружения ADMIN_PASSWORD,
 * сессия — подписанная HMAC кука. Никаких пользователей и базы: админ один.
 */

import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "tt_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

const secret = () =>
  process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "";

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Пароль вообще задан? Без него админку показывать нельзя. */
export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected || typeof input !== "string" || !input) return false;
  // сравниваем хэши, чтобы длина пароля не утекала по времени ответа
  const h = (v) => crypto.createHash("sha256").update(v).digest();
  return crypto.timingSafeEqual(h(input), h(expected));
}

export async function startSession() {
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = String(expires);
  const store = await cookies();
  store.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function isAdmin() {
  if (!adminConfigured()) return false;
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return false;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(sign(payload), signature)) return false;
  return Number(payload) > Date.now();
}
