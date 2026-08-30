-- Таблица недель. Выполнить один раз в Supabase → SQL Editor.

create table if not exists public.weeks (
  id           text primary key,          -- «M-TARpv24_2026-08-31»
  group_name   text not null,
  programme    text,
  week_start   date not null,
  week_end     date not null,
  lesson_count integer not null default 0,
  file_name    text,
  uploaded_at  timestamptz not null default now(),
  data         jsonb not null             -- полная разобранная неделя
);

create index if not exists weeks_week_start_idx on public.weeks (week_start desc);
create index if not exists weeks_group_idx on public.weeks (group_name);

-- Приложение ходит в базу только с сервера и только по service-role ключу,
-- поэтому анонимный доступ закрываем полностью.
alter table public.weeks enable row level security;
-- Ни одной policy не создаём: значит, ключам anon и authenticated таблица недоступна,
-- а service-role обходит RLS по определению.
