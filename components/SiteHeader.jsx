import Link from "next/link";
import { Suspense } from "react";
import SettingsMenu from "@/components/SettingsMenu";
import { assignColors } from "@/lib/colors";
import { optionalIdOf } from "@/lib/optional";
import { listSubjects } from "@/lib/store";

const NAV = [
  { id: "today", href: "/", label: "Сегодня" },
  { id: "week", href: "/week", label: "Расписание" },
  { id: "calendar", href: "/calendar", label: "В календарь" },
];

/**
 * Шапка сайта: логотип (знак, название и группа), разделы и шестерёнка настроек. В админке вместо разделов —
 * свои действия (children), а рядом с названием — метка «админка».
 *
 * @param active id текущего раздела
 * @param admin шапка админки
 */
export default function SiteHeader({ active, group, admin = false, children }) {
  return (
    <header className="site-head">
      <div className="site-head-in">
        <Link href="/" className="brand">
          {/* в логотипе уже есть «Tunniplaan» и группа TARpv24 */}
          <img src="/logo.png" alt={`Tunniplaan ${group ?? "TARpv24"}`} className="brand-logo" width="590" height="132" />
          {admin ? <span className="brand-tag">админка</span> : null}
        </Link>
        {children ?? (
          <>
            <nav aria-label="Разделы" className="site-nav">
              {NAV.map((n) => (
                <Link key={n.id} href={n.href} aria-current={n.id === active ? "page" : undefined}>
                  {n.label}
                </Link>
              ))}
            </nav>
            {/* шапка не ждёт базу: шестерёнка сразу, цвет значка — когда придут предметы */}
            <Suspense fallback={<SettingsMenu />}>
              <ColoredSettings />
            </Suspense>
          </>
        )}
      </div>
    </header>
  );
}

/** Шестерёнка с цветом значка как у предмета в сетке; без базы значок тёмный. */
async function ColoredSettings() {
  const subjects = await listSubjects().catch(() => []);
  const colors = {};
  for (const [name, c] of assignColors(subjects)) {
    const id = optionalIdOf(name);
    if (id && !colors[id]) colors[id] = c.bg;
  }
  return <SettingsMenu colors={colors} />;
}
