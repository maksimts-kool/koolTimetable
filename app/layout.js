import { Manrope, Outfit } from "next/font/google";
import "./globals.css";

// Outfit — латиница (эстонские названия предметов и дней).
// В нём нет кириллицы, поэтому русский интерфейс подхватывает Manrope:
// шрифт выбирается по глифам, стык в вёрстке незаметен.
const outfit = Outfit({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-outfit" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-manrope" });

export const metadata = {
  title: "Tunniplaan",
  description: "Расписание занятий: загрузка выгрузки из ТТК и просмотр по неделям",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={`${outfit.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
