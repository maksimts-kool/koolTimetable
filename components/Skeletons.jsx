/**
 * Заглушки на время загрузки.
 *
 * Страница отдаётся сразу: шапка приходит первым куском ответа, а расписание
 * подтягивается потоком — пока его нет, на его месте стоят серые формы той же
 * раскладки с мерцанием, и подмена готовыми данными почти не сдвигает страницу.
 */

const HOUR_PX = 64;
const GRID_FROM = 8 * 60;
const GRID_TO = 16 * 60;
const PX = HOUR_PX / 60;

const HOURS = [];
for (let h = GRID_FROM; h <= GRID_TO; h += 60) HOURS.push(h);

// Расстановка вымышленная, но постоянная: случайные числа на сервере и в
// браузере разошлись бы. Каждая пара — [начало в минутах, длительность].
const SKELETON_DAYS = [
  [[8 * 60 + 30, 195], [12 * 60 + 30, 90], [14 * 60 + 15, 90]],
  [[8 * 60 + 30, 90], [10 * 60 + 15, 90], [12 * 60 + 30, 90]],
  [[8 * 60 + 30, 195], [12 * 60 + 30, 195]],
  [[8 * 60 + 30, 90], [10 * 60 + 15, 90], [12 * 60 + 30, 90], [14 * 60 + 15, 90]],
  [[8 * 60 + 30, 90], [10 * 60 + 15, 90]],
];

const line = (width, height, extra) => (
  <span className="skel skel-line" style={{ width, height, ...extra }} />
);

function TopSkeleton({ title = 220, tools = 1 }) {
  return (
    <section className="page-top" aria-hidden="true">
      <div>
        {line(title, 32)}
        {line(170, 14, { marginTop: 10 })}
      </div>
      <div className="page-tools">
        {Array.from({ length: tools }, (_, i) => (
          <span key={i} className="skel skel-tool" style={{ width: 200 }} />
        ))}
      </div>
    </section>
  );
}

/** Неделя сеткой: шапка, сетка и подпись. */
export default function WeekSkeleton() {
  return (
    <>
      {/* полоска загрузки вверху окна: видна ровно, пока идёт загрузка */}
      <div className="navbar" aria-hidden="true" />
      <TopSkeleton />
      <div className="week-wrap" aria-busy="true" aria-label="Загружаю расписание">
        <section className="grid-card" aria-hidden="true">
          <div className="grid-scroll">
            <div className="grid" style={{ "--cols": 5 }}>
              <div className="grid-head">
                <span />
                {SKELETON_DAYS.map((_, i) => (
                  <div key={i} className="grid-day">
                    <span className="skel grid-num" />
                    <span className="grid-dn">
                      {line(26, 12)}
                      {line(60, 10, { marginTop: 5 })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid-body">
                <div className="grid-axis" style={{ height: (GRID_TO - GRID_FROM) * PX }}>
                  {HOURS.map((h) => (
                    <span key={h} style={{ top: (h - GRID_FROM) * PX }}>
                      {String(h / 60).padStart(2, "0")}:00
                    </span>
                  ))}
                </div>
                {SKELETON_DAYS.map((blocks, d) => (
                  <div key={d} className="grid-col" style={{ height: (GRID_TO - GRID_FROM) * PX }}>
                    {blocks.map(([from, minutes], i) => (
                      <span
                        key={i}
                        className="skel skel-lesson"
                        style={{ top: (from - GRID_FROM) * PX + 2, height: minutes * PX - 4 }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="week-list" aria-hidden="true">
          {[0, 1].map((d) => (
            <div key={d} className="wl-day">
              {line(170, 16)}
              {[0, 1, 2].map((i) => (
                <span key={i} className="skel skel-row" />
              ))}
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

/** «Сегодня»: крупная карточка, «Дальше», итоги и план дня. */
export function TodaySkeleton() {
  return (
    <>
      <div className="navbar" aria-hidden="true" />
      <TopSkeleton title={280} />
      <div className="today-grid" aria-busy="true" aria-label="Загружаю расписание">
        <section className="hero skel-hero" aria-hidden="true">
          {line(120, 30, { borderRadius: 999 })}
          <div className="hero-main">
            {line("70%", 34)}
            {line("45%", 16, { marginTop: 10 })}
          </div>
          <div className="hero-foot">
            {line(140, 40)}
            {line("100%", 10, { marginTop: 14, borderRadius: 999 })}
          </div>
        </section>
        <div className="today-side" aria-hidden="true">
          <section className="panel next">
            {line(60, 12)}
            {line("80%", 20, { marginTop: 14 })}
            {line("60%", 14, { marginTop: 10 })}
            {line(110, 30, { marginTop: 16, borderRadius: 999 })}
          </section>
          <section className="stats-grid">
            {[0, 1].map((i) => (
              <div key={i}>
                {line(40, 22)}
                {line(70, 11, { marginTop: 6 })}
              </div>
            ))}
          </section>
        </div>
      </div>
      <section className="plan" aria-hidden="true">
        <div className="plan-head">{line(130, 22)}</div>
        <div className="skel-plan">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="skel skel-row" />
          ))}
        </div>
      </section>
    </>
  );
}
