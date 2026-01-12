-- migration_add_team_country.sql
-- Добавляет поля country и region в таблицу teams (Postgres)
ALTER TABLE IF EXISTS teams
  ADD COLUMN IF NOT EXISTS country text;

ALTER TABLE IF EXISTS teams
  ADD COLUMN IF NOT EXISTS region text;

-- При необходимости можно заполнить пустыми строками для существующих записей:
-- UPDATE teams SET country = '' WHERE country IS NULL;
-- UPDATE teams SET region = '' WHERE region IS NULL;
