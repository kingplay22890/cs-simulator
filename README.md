# CS Match Simulator

Небольшое фронтенд‑приложение для симуляции матчей CS с рейтингом Elo, профилями команд и таблицей рейтингов. Данные хранятся в Supabase (Postgres) с Realtime‑обновлением.

## Быстрый старт

1) Клонируйте репозиторий
```bash
git clone https://github.com/<you>/cs-simulator.git
cd cs-simulator
```

2) Создайте js/config.js из примера и вставьте ключи из Supabase → Project Settings → API:
```js
// js/config.js
window.SUPABASE_URL = 'https://<project>.supabase.co';
window.SUPABASE_ANON_KEY = '<anon key>';
```
В репозитории уже есть js/config.example.js. Файл js/config.js добавлен в .gitignore — не коммитьте реальные ключи.

3) Поднимите локальный сервер (любой):
```bash
# Python
python -m http.server 5500
# затем откройте http://localhost:5500/index.html
```

## Настройка базы (один раз)
В Supabase (SQL Editor) выполните:
```sql
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  logo_url text default '',
  rating int not null default 1500,
  players jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.teams enable row level security;

drop policy if exists "read for all" on public.teams;
drop policy if exists "insert for all (demo)" on public.teams;
drop policy if exists "update for all (demo)" on public.teams;

create policy "read for all" on public.teams for select using (true);
create policy "insert for all (demo)" on public.teams for insert with check (true);
create policy "update for all (demo)" on public.teams for update using (true) with check (true);
```
Включите Realtime для таблицы public.teams (Table Editor → Enable Realtime).

## Страницы
- index.html — настройка команд, симуляция матчей, запись результатов (Supabase).
- ratings.html — таблица рейтингов, Realtime‑обновления.
- team-profile.html — профиль команды: состав, история матчей, метрики. Тоже Realtime.

## Разработка
- Основные скрипты:
  - js/script.js — логика форм, симуляция, обновление рейтингов (async + Supabase API).
  - js/ratings.js — чтение рейтингов из Supabase, Realtime подписка.
  - js/team-profile.js — профиль команды, Realtime подписка.
  - js/api.js — обёртки над Supabase, миграция из localStorage при первом запуске.

## Публикация изменений
```bash
git add .
git commit -m "Supabase integration & realtime"
git push origin main
```

## Безопасность
- Не коммитьте реальные ключи: js/config.js в .gitignore.
- DEMO‑политики дают запись всем. Для продакшна ограничьте запись (аутентификация, сервисные ключи, RPC/Edge Functions). 
