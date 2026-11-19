import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import Subscribe from "@/components/Subscribe";
import { targetGroup } from "@/lib/tahvel";

export const metadata = { title: "В календарь · Tunniplaan" };

export default function CalendarPage() {
  return (
    <>
      <SiteHeader active="calendar" group={targetGroup().code} />
      <main className="wrap wrap-narrow">
        <Subscribe />
        <SiteFooter />
      </main>
    </>
  );
}
