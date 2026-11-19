import Link from "next/link";
import AdminPanel, { LogoutButton } from "@/components/AdminPanel";
import LoginForm from "@/components/LoginForm";
import SiteHeader from "@/components/SiteHeader";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { driverName, listWeeks } from "@/lib/store";
import { targetGroup } from "@/lib/tahvel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Админка · Tunniplaan" };

export default async function AdminPage() {
  const configured = adminConfigured();
  const admin = configured && (await isAdmin());

  // вход — отдельной карточкой посреди экрана, без шапки
  if (configured && !admin) return <LoginForm />;

  const weeks = admin ? await listWeeks() : [];
  const group = targetGroup().code;

  return (
    <>
      <SiteHeader admin>
        <nav aria-label="Действия" className="site-nav">
          <Link href="/">Открыть сайт</Link>
          {admin ? <LogoutButton /> : null}
        </nav>
      </SiteHeader>
      <main className="wrap wrap-admin">
        <div className="page-top rise" style={{ "--i": 0 }}>
          <div>
            <h1>Управление</h1>
            <p className="sub">
              Группа {group} · хранилище {driverName()}
              {admin ? ` · недель: ${weeks.length}` : ""}
            </p>
          </div>
        </div>

        {admin ? (
          <AdminPanel weeks={weeks} group={group} />
        ) : (
          <section className="panel rise" style={{ "--i": 1 }}>
            <h2>Пароль не задан</h2>
            <p className="hint">
              Добавьте переменную окружения <code>ADMIN_PASSWORD</code> (локально — в файл <code>.env.local</code>, на
              Zone — в <code>~/tunniplaan-app/.env.local</code>) и перезапустите приложение.
            </p>
          </section>
        )}
      </main>
    </>
  );
}
