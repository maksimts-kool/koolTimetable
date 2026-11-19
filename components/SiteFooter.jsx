import Link from "next/link";

/**
 * Подвал: откуда расписание и когда обновлено.
 *
 * @param week метаданные недели (fileName, uploadedAt), если есть
 * @param embed во фрейме ссылка на админку не нужна
 */
export default function SiteFooter({ week, embed = false }) {
  return (
    <footer className="site-foot">
      {week ? (
        <span>
          Источник: {week.fileName} · обновлено {new Date(week.uploadedAt).toLocaleDateString("ru-RU")}
        </span>
      ) : null}
      {embed ? null : <Link href="/admin">Админка</Link>}
    </footer>
  );
}
