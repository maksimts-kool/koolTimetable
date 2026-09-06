/**
 * Заглушки на время загрузки.
 *
 * Страница отдаётся сразу: шапка и разметка приходят первым куском ответа, а
 * неделя подтягивается потоком — пока её нет, на её месте стоит серая сетка с
 * мерцанием. Так же закрыта и вторая пауза: календарь рисуется только в
 * браузере, и от разметки сервера до его монтирования доска раньше стояла
 * пустой.
 *
 * Размеры взяты те же, что резервирует Timetable под настоящую сетку
 * (шапка дня + пятнадцатиминутные строки по 25px), поэтому подмена заглушки
 * готовым расписанием не сдвигает страницу.
 */

const DAY_HEADER_PX = 60;
const PX_PER_MINUTE = 25 / 15;

// Типовые границы учебного дня: сетка недели почти всегда попадает в них, и
// заглушка получается той же высоты, что и расписание.
const GRID_FROM = 8 * 60;
const GRID_TO = 16 * 60 + 15;

const BOARD_PX = DAY_HEADER_PX + (GRID_TO - GRID_FROM) * PX_PER_MINUTE;

const HOURS = [];
for (let h = GRID_FROM / 60; h <= Math.floor(GRID_TO / 60); h++) HOURS.push(h);

// Расстановка занятий вымышленная, но постоянная: случайные числа на сервере и
// в браузере разошлись бы, и React ругался бы на несовпадение разметки.
// Каждая пара — [начало в минутах от полуночи, длительность].
const SKELETON_DAYS = [
  [[8 * 60 + 15, 90], [10 * 60 + 15, 135], [13 * 60, 90]],
  [[9 * 60, 135], [12 * 60 + 30, 90], [14 * 60 + 15, 90]],
  [[8 * 60 + 15, 180], [12 * 60, 135]],
  [[10 * 60, 90], [11 * 60 + 45, 90], [13 * 60 + 45, 135]],
  [[8 * 60 + 45, 135], [11 * 60 + 30, 90]],
];

const LIST_ROWS = [0, 1, 2, 3, 4, 5, 6];
const LEGEND_CARDS = [0, 1, 2, 3, 4, 5];

/**
 * Сетка недели на время загрузки — и с сервера, и до монтирования календаря.
 *
 * @param height высота настоящей сетки, если она уже известна: тогда подмена
 *   заглушки календарём проходит совсем без сдвига.
 */
export function BoardSkeleton({ height }) {
  return (
    <div
      className="skel-cal"
      style={{ "--skel-board-h": `${Math.round(height || BOARD_PX)}px` }}
      aria-hidden="true"
    >
      <div className="skel-grid">
        <div className="skel-axis">
          {HOURS.map((h) => (
            <span key={h} className="skel-hour" style={{ top: (h * 60 - GRID_FROM) * PX_PER_MINUTE }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {SKELETON_DAYS.map((blocks, day) => (
          <div className="skel-col" key={day}>
            <div className="skel-dayhead">
              <span className="skel skel-line" style={{ width: 82 }} />
              <span className="skel skel-line sm" style={{ width: 58 }} />
            </div>
            <div className="skel-day">
              {blocks.map(([from, minutes], i) => (
                <div
                  key={i}
                  className="skel-ev"
                  style={{
                    top: (from - GRID_FROM) * PX_PER_MINUTE,
                    height: minutes * PX_PER_MINUTE - 2,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* на узком экране расписание показывается списком — заглушка тоже */}
      <div className="skel-list">
        {LIST_ROWS.map((i) => (
          <div className="skel-row" key={i}>
            <span className="skel skel-line" style={{ width: 74 }} />
            <span className="skel skel-line" style={{ width: `${52 + ((i * 13) % 34)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Вся страница недели целиком: шапка, сетка и легенда. */
export default function WeekSkeleton() {
  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">Tallinna Tehnoloogiakolledž</p>
          <h1>
            Tunniplaan
            <span className="grp">
              <span className="skel skel-line" style={{ width: 210, height: 15 }} />
            </span>
          </h1>
        </div>
        <div className="right">
          <div className="weekpick">
            <span>Неделя</span>
            <span className="skel skel-select" />
          </div>
          <div className="stats">
            {["уроков", "часов", "учебных дней"].map((label) => (
              <div className="stat" key={label}>
                <b>
                  <span className="skel skel-line" style={{ width: 34, height: 17 }} />
                </b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="board">
        <BoardSkeleton />
      </div>

      <section className="legend">
        <h2>Предметы недели</h2>
        <div className="subs">
          {LEGEND_CARDS.map((i) => (
            <div className="sub skel-sub" key={i}>
              <div>
                <span className="skel skel-line" style={{ width: 128 + ((i * 29) % 52), height: 13 }} />
                <span className="skel skel-line sm" style={{ width: 88, marginTop: 7 }} />
              </div>
              <div className="side">
                <span className="skel skel-line sm" style={{ width: 74 }} />
                <div className="days">
                  <span className="skel skel-dot" />
                  <span className="skel skel-dot" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
