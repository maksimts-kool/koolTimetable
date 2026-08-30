/**
 * Разбор PDF-расписания Tallinna Tehnoloogiakolledž (вид «Tunniplaan»).
 *
 * PDF — это таблица без структуры: pdf.js отдаёт разрозненные текстовые куски
 * с координатами. Восстанавливаем строки по координате Y, а колонки — по X
 * границам, взятым из строки заголовка таблицы («Aeg | Sündmuse nimetus | …»).
 */

const WEEKDAYS = ["Esmaspäev", "Teisipäev", "Kolmapäev", "Neljapäev", "Reede", "Laupäev", "Pühapäev"];
const RE_WEEK   = /Tunniplaan:\s*(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})/;
const RE_GROUP  = /Õpperühm:\s*([^,\n]+)(?:,\s*(.+))?/;
const RE_DAY    = new RegExp(`^(${WEEKDAYS.join("|")})\\s+(\\d{2}\\.\\d{2}\\.\\d{4})`);
const RE_TIME   = /^(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/;

export class ParseError extends Error {
  constructor(message, code, options) {
    super(message, options);
    this.code = code;
  }
}

/** Текстовые куски страницы → строки, отсортированные сверху вниз. */
function toLines(items) {
  const rows = [];
  for (const it of items) {
    const text = it.str;
    if (!text || !text.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, text: text.trim() });
  }
  rows.sort((a, b) => b.y - a.y);
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

const lineText = (row) => row.items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();

/** Границы колонок из строки заголовка таблицы. */
function columnBounds(headerRow) {
  const labels = ["Aeg", "Sündmuse nimetus", "Õpetaja(d)", "Õpperühm(ad)", "Ruum(id)", "Muu info"];
  const starts = labels.map((label) => {
    const hit = headerRow.items.find((i) => i.text.startsWith(label.split(" ")[0]) && label.startsWith(i.text.split(" ")[0]));
    return hit ? hit.x : null;
  });
  if (starts[0] === null || starts[1] === null) return null;
  // незаполненные колонки берём как середину между соседями
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] === null) starts[i] = i > 0 ? starts[i - 1] + 60 : 0;
  }
  return starts;
}

/** Куски строки раскладываем по колонкам: каждый кусок идёт в ближайшую колонку слева. */
function splitByColumns(row, bounds) {
  const cells = bounds.map(() => []);
  for (const item of row.items) {
    let col = 0;
    for (let i = 0; i < bounds.length; i++) {
      if (item.x >= bounds[i] - 6) col = i;
    }
    cells[col].push(item.text);
  }
  return cells.map((c) => c.join(" ").replace(/\s+/g, " ").trim());
}

const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Склейка кусков одной ячейки, разорванной переносом строки.
 * PDF рвёт длинные списки прямо посреди слова: «M-LOGITpv24, M-» + «TARpv24».
 */
function joinFragments(parts) {
  return parts
    .filter(Boolean)
    .reduce((acc, part) => (!acc ? part : acc.endsWith("-") ? acc + part : `${acc} ${part}`), "");
}

/** Подряд идущие уроки одного предмета в одном кабинете → один блок. */
function mergeLessons(lessons, maxGap = 15) {
  const blocks = [];
  for (const lesson of lessons) {
    const prev = blocks[blocks.length - 1];
    const sameCourse =
      prev &&
      prev.subject === lesson.subject &&
      prev.room === lesson.room &&
      prev.teacher === lesson.teacher &&
      toMinutes(lesson.from) - toMinutes(prev.to) <= maxGap &&
      toMinutes(lesson.from) >= toMinutes(prev.to);
    if (sameCourse) {
      prev.marks.push(lesson.from);
      prev.to = lesson.to;
      prev.lessons += 1;
    } else {
      blocks.push({ ...lesson, lessons: 1, marks: [] });
    }
  }
  return blocks;
}

/**
 * pdf.js бросает собственные типы ошибок. Опознаём их по имени класса:
 * PasswordException наружу не экспортируется, поэтому instanceof не годится.
 */
function pdfOpenError(cause) {
  if (cause?.name === "PasswordException") {
    return new ParseError(
      "PDF защищён паролем. Снимите защиту и загрузите файл заново.",
      "pdf_encrypted",
      { cause }
    );
  }
  if (cause?.name === "InvalidPDFException") {
    return new ParseError(
      "PDF повреждён или скачался не полностью — выгрузите расписание из ТТК заново.",
      "not_a_pdf",
      { cause }
    );
  }
  return new ParseError("Не удалось открыть PDF.", "pdf_open_failed", { cause });
}

/**
 * @param {Uint8Array} data содержимое PDF
 * @returns {Promise<object>} разобранная неделя
 */
export async function parseTimetablePdf(data) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let doc;
  try {
    doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  } catch (e) {
    throw pdfOpenError(e);
  }

  const rows = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    rows.push(...toLines(content.items));
  }
  await doc.destroy();

  const fullText = rows.map(lineText).join("\n");

  const week = fullText.match(RE_WEEK);
  if (!week) {
    throw new ParseError(
      "В файле нет строки «Tunniplaan: дд.мм.гггг - дд.мм.гггг». Похоже, это не выгрузка расписания ТТК.",
      "no_week_header"
    );
  }
  const group = fullText.match(RE_GROUP);
  if (!group) {
    throw new ParseError("В файле не найдена строка «Õpperühm:» с названием группы.", "no_group");
  }

  let bounds = null;
  let day = null;
  const days = new Map();

  for (const row of rows) {
    const text = lineText(row);

    const dayMatch = text.match(RE_DAY);
    if (dayMatch) {
      day = { weekday: dayMatch[1], date: dayMatch[2], lessons: [], orphans: [] };
      days.set(dayMatch[2], day);
      continue;
    }
    if (/^Aeg\b/.test(text)) {
      bounds = columnBounds(row) || bounds;
      continue;
    }
    if (!day || !bounds) continue;

    const cells = splitByColumns(row, bounds);
    const time = cells[0].match(RE_TIME);

    if (time) {
      day.lessons.push({ from: time[1], to: time[2], y: row.y, sources: [{ y: row.y, cells }] });
    } else if (cells.slice(1).some(Boolean)) {
      // строка-продолжение: перенос названия или длинный список групп.
      // Она может стоять и выше, и ниже своей строки со временем,
      // поэтому привязываем к ближайшему уроку, а не к предыдущему.
      day.orphans.push({ y: row.y, cells });
    }
  }

  for (const d of days.values()) {
    for (const orphan of d.orphans) {
      const nearest = d.lessons.reduce(
        (best, l) => (!best || Math.abs(l.y - orphan.y) < Math.abs(best.y - orphan.y) ? l : best),
        null
      );
      if (nearest) nearest.sources.push(orphan);
    }
  }

  const parsedDays = [...days.values()]
    .filter((d) => d.lessons.length)
    .map((d) => {
      const lessons = d.lessons
        .map((l) => {
          const parts = [...l.sources].sort((a, b) => b.y - a.y).map((s) => s.cells);
          const col = (i) => joinFragments(parts.map((c) => c[i]));
          return {
            from: l.from,
            to: l.to,
            subject: col(1).replace(/\s+/g, " ").trim(),
            teacher: col(2).replace(/\s+/g, " ").trim(),
            groups: col(3).replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim(),
            room: col(4).replace(/^Ruum-/, "").replace(/\s+/g, " ").trim(),
            note: col(5).replace(/\s+/g, " ").trim(),
          };
        })
        .sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
      return { weekday: d.weekday, date: d.date, blocks: mergeLessons(lessons) };
    })
    .sort((a, b) => isoDate(a.date).localeCompare(isoDate(b.date)));

  const lessonCount = parsedDays.reduce(
    (sum, d) => sum + d.blocks.reduce((s, b) => s + b.lessons, 0),
    0
  );
  if (!lessonCount) {
    throw new ParseError(
      "Расписание распозналось, но ни одного урока не найдено — проверьте, что выгрузка не пустая.",
      "no_lessons"
    );
  }

  return {
    weekStart: isoDate(week[1]),
    weekEnd: isoDate(week[2]),
    group: group[1].trim(),
    programme: (group[2] || "").trim(),
    days: parsedDays,
    lessonCount,
    parsedAt: new Date().toISOString(),
  };
}

/** «31.08.2026» → «2026-08-31» */
export function isoDate(dmy) {
  const [d, m, y] = dmy.split(".");
  return `${y}-${m}-${d}`;
}

/** «2026-08-31» → «31.08» */
export function shortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}
