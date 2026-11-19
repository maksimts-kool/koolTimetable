"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setPassword("");
      router.refresh();
    } else {
      setError(data.error || "Не удалось войти.");
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit} className="login-card">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span className="brand-name">Tunniplaan</span>
        </span>
        <div>
          <h1>Вход в админку</h1>
          <p className="sub">Только для администратора расписания.</p>
        </div>
        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            className={error ? "invalid" : undefined}
            autoFocus
          />
        </label>
        {error ? (
          <p role="alert" className="field-error">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn primary wide" disabled={busy || !password}>
          {busy ? "Проверяю…" : "Войти"}
        </button>
        <Link href="/" className="back">
          ← К расписанию
        </Link>
      </form>
    </main>
  );
}
