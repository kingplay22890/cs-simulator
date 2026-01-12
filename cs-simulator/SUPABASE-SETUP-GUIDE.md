# Инструкция по подключению Supabase к CS Simulator

## Шаг 1: Выполнить SQL в Supabase Dashboard

1. Откройте https://supabase.com/dashboard
2. Выберите ваш проект `pwjshenmyzmmyevecpcc`
3. В левом меню перейдите: **SQL Editor** → **New Query**
4. Скопируйте **ВСЕ** содержимое файла `SUPABASE-SETUP.sql` (находится в корне проекта)
5. Вставьте в SQL Editor и нажмите **Run** (зелёная кнопка)
6. Должна появиться зелёная галочка "Success"

## Шаг 2: Добавить Allowed Web Origins для CORS

1. В Supabase Dashboard откройте: **Settings** → **API**
2. Найдите секцию **Allowed web origins**
3. Добавьте две строки:
   ```
   http://localhost:8000
   http://127.0.0.1:8000
   ```
4. Нажмите **Save**

## Шаг 3: Загрузить данные команд в таблицу teams

Есть 2 варианта:

### Вариант A: Через CSV Import (простой)
1. В Supabase Dashboard откройте **Table Editor** → **teams**
2. Нажмите кнопку **Import data** → **CSV**
3. Загрузите `teams_rows.json` (или преобразуйте его в CSV)
4. Убедитесь, что колонки совпадают: `name`, `logo_url`, `country`, `region`, `rating`, `players`

### Вариант B: Через SQL Insert
Если данные в `teams_rows.json`, выполните в SQL Editor:
```sql
-- Пример INSERT (замените на реальные данные из вашего teams_rows.json)
INSERT INTO teams (name, logo_url, country, region, rating, players) VALUES
('G2', 'https://...', 'USA', 'Americas', 1800, '[]'),
('Vitality', 'https://...', 'France', 'Europe', 1750, '[]'),
... (остальные команды)
```

## Шаг 4: Проверить подключение в приложении

1. Убедитесь, что HTTP сервер запущен:
   ```powershell
   cd c:\cs-simulator.3\cs-simulator-main\cs-simulator-main
   python -m http.server 8000
   ```
2. Откройте в браузере: **http://localhost:8000/index.html**
3. Откройте DevTools (F12) → **Console**
4. Должны увидеть:
   - `Supabase connection: OK` (если успешно подключилось)
   - Список команд загружен (или `Loaded teams: N teams`)

## Если всё ещё ошибка 400:

1. Проверьте в DevTools → **Network** → найдите запрос к `/rest/v1/teams`
2. Посмотрите **Response** (тело ответа) — там должна быть информация об ошибке
3. Если видите `401` или `403` — проблема с RLS или ключом
4. Если видите `CORS` ошибку — добавьте origins в шаге 2

## Если RLS блокирует доступ:

Временно отключите RLS для отладки:
```sql
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_matches DISABLE ROW LEVEL SECURITY;
```

После проверки снова включите:
```sql
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_matches ENABLE ROW LEVEL SECURITY;
```

## Контрольный чек-лист:

- [ ] SQL скрипт выполнен в Supabase (зелёная галочка)
- [ ] Добавлены origins в Settings → API
- [ ] Таблицы созданы (видны в Table Editor: teams, player_stats, player_matches)
- [ ] Данные загружены в таблицу teams (проверить в Table Editor)
- [ ] HTTP сервер запущен на порту 8000
- [ ] Браузер показывает команды (или баннер с "Load local sample")
- [ ] Console показывает "Supabase connection: OK"

## Если остались вопросы:

Скопируйте текст ошибки из DevTools → Console и Сomments, пришлите его — помогу.
