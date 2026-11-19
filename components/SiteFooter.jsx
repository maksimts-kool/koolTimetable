/**
 * Подвал: откуда расписание и когда обновлено. Без недели подвала нет.
 *
 * @param week метаданные недели (fileName, uploadedAt), если есть
 */
export default function SiteFooter({ week }) {
  if (!week) return null;
  return (
    <footer className="site-foot">
      <span>
        Источник: {week.fileName} · обновлено {new Date(week.uploadedAt).toLocaleDateString("ru-RU")}
      </span>
    </footer>
  );
}
