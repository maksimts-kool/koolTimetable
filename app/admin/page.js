import Link from "next/link";
import AdminPanel from "@/components/AdminPanel";
import LoginForm from "@/components/LoginForm";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { driverName, listWeeks } from "@/lib/store";
import { targetGroup } from "@/lib/tahvel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Админка · Tunniplaan" };

export default async function AdminPage() {
  const configured = adminConfigured();
  const admin = configured && (await isAdmin());
  const weeks = admin ? await listWeeks() : [];

  return (
    <main className="wrap">
      <header className="head">
        <div>
          <p className="eyebrow">Tunniplaan · управление</p>
          <h1>
            Админка
            <span className="grp">Синхронизация с Tahvel и EduPage, загрузка PDF и список недель</span>
          </h1>
        </div>
        <div className="right">
          <Link href="/">← К расписанию</Link>
        </div>
      </header>

      {!configured ? (
        <div className="card">
          <h2>Пароль не задан</h2>
          <p className="hint" style={{ margin: 0 }}>
            Добавьте переменную окружения <code>ADMIN_PASSWORD</code> (локально — в файл{" "}
            <code>.env.local</code>, на Zone — в <code>~/tunniplaan-app/.env.local</code>) и
            перезапустите приложение.
          </p>
        </div>
      ) : admin ? (
        <AdminPanel weeks={weeks} driver={driverName()} group={targetGroup().code} />
      ) : (
        <LoginForm />
      )}
    </main>
  );
}
