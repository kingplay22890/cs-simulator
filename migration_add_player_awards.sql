-- Миграция: Добавление поля awards в таблицу player_stats
-- Выполните этот SQL в Supabase SQL Editor

-- Добавляем поле awards в таблицу player_stats
ALTER TABLE player_stats 
ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]'::jsonb;

-- Обновляем существующие записи, устанавливая пустой массив по умолчанию
UPDATE player_stats 
SET awards = '[]'::jsonb 
WHERE awards IS NULL;

-- Добавляем комментарий к полю
COMMENT ON COLUMN player_stats.awards IS 'Массив наград игрока в формате JSON: [{"name": "название", "img": "URL или эмодзи"}]';

