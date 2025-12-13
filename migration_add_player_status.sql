-- Миграция: Добавление поля status в таблицу player_stats
-- Выполните этот SQL в Supabase SQL Editor

-- Добавляем поле status в таблицу player_stats
ALTER TABLE player_stats 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Обновляем существующие записи, устанавливая статус 'active' по умолчанию
UPDATE player_stats 
SET status = 'active' 
WHERE status IS NULL;

-- Добавляем комментарий к полю
COMMENT ON COLUMN player_stats.status IS 'Статус игрока: active или benched';

