import Link from "next/link";

const NAV = [
  { id: "today", href: "/", label: "Сегодня" },
  { id: "week", href: "/week", label: "Расписание" },
  { id: "calendar", href: "/calendar", label: "В календарь" },
];

/**
 * Шапка сайта: знак, название с группой и разделы. В админке вместо разделов —
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
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span className="brand-name">Tunniplaan</span>
          {admin ? <span className="brand-tag">админка</span> : group ? <span className="brand-grp">{group}</span> : null}
        </Link>
        {children ?? (
          <nav aria-label="Разделы" className="site-nav">
            {NAV.map((n) => (
              <Link key={n.id} href={n.href} aria-current={n.id === active ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
