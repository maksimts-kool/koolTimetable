"use client";

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
    <div className="card" style={{ maxWidth: 420 }}>
      <h2>Вход администратора</h2>
      <p className="hint">Загружать и удалять недели может только администратор.</p>
      <form onSubmit={submit} className="form-row">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          autoComplete="current-password"
          style={{ flex: 1, minWidth: 180 }}
        />
        <button className="primary" type="submit" disabled={busy || !password}>
          {busy ? "Проверяю…" : "Войти"}
        </button>
      </form>
      {error && <div className="msg error">{error}</div>}
    </div>
  );
}
