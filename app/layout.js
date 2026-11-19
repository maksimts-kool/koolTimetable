import { Inter } from "next/font/google";
import "./globals.css";

// Inter закрывает и латиницу с эстонскими буквами (названия предметов), и
// кириллицу интерфейса — один шрифт без стыков.
const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], display: "swap", variable: "--font-inter" });

export const metadata = {
  title: "Tunniplaan",
  description: "Расписание группы TARpv24: что идёт сейчас, неделя сеткой и подписка в календарь",
};

export const viewport = { themeColor: "#F5F6FA" };

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
