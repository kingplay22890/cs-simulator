-- ============================================================================
-- Скрипт для Supabase SQL Editor
-- Скопируйте ВСЕ команды ниже и выполните их в https://supabase.com/dashboard
-- ============================================================================

-- 1. Создание таблицы teams (если её ещё нет)
CREATE TABLE IF NOT EXISTS teams (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  country TEXT,
  region TEXT,
  rating INTEGER DEFAULT 1500,
  players JSONB DEFAULT '[]'::jsonb,
  history JSONB DEFAULT '[]'::jsonb,
  awards JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Создание таблицы player_stats
CREATE TABLE IF NOT EXISTS player_stats (
  id BIGSERIAL PRIMARY KEY,
  player_name TEXT NOT NULL UNIQUE,
  current_team TEXT,
  total_matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  avg_rating DECIMAL(10, 2) DEFAULT 1.0,
  best_rating DECIMAL(10, 2) DEFAULT 1.0,
  win_rate INTEGER DEFAULT 0,
  total_kills INTEGER DEFAULT 0,
  total_deaths INTEGER DEFAULT 0,
  kd_ratio DECIMAL(10, 2) DEFAULT 0,
  avg_adr DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  awards JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Создание таблицы player_matches
CREATE TABLE IF NOT EXISTS player_matches (
  id BIGSERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  opponent TEXT NOT NULL,
  match_date TIMESTAMP NOT NULL,
  result TEXT NOT NULL,
  score TEXT,
  rating DECIMAL(10, 2),
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  adr DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Создание индексов
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);
CREATE INDEX IF NOT EXISTS idx_teams_rating ON teams(rating DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_name ON player_stats(player_name);
CREATE INDEX IF NOT EXISTS idx_player_matches_name ON player_matches(player_name);
CREATE INDEX IF NOT EXISTS idx_player_matches_date ON player_matches(match_date DESC);

-- 5. ВКЛЮЧЕНИЕ RLS (Row Level Security)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_matches ENABLE ROW LEVEL SECURITY;

-- 6. УДАЛЕНИЕ СТАРЫХ ПОЛИТИК (если есть)
DROP POLICY IF EXISTS "Allow public read access to teams" ON teams;
DROP POLICY IF EXISTS "Allow public write access to teams" ON teams;
DROP POLICY IF EXISTS "Allow public update access to teams" ON teams;
DROP POLICY IF EXISTS "Allow public read access to player_stats" ON player_stats;
DROP POLICY IF EXISTS "Allow public write access to player_stats" ON player_stats;
DROP POLICY IF EXISTS "Allow public update access to player_stats" ON player_stats;
DROP POLICY IF EXISTS "Allow public read access to player_matches" ON player_matches;
DROP POLICY IF EXISTS "Allow public write access to player_matches" ON player_matches;

-- 7. СОЗДАНИЕ НОВЫХ RLS ПОЛИТИК ДЛЯ TEAMS
CREATE POLICY "Allow public read access to teams" ON teams
  FOR SELECT USING (true);

CREATE POLICY "Allow public write access to teams" ON teams
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to teams" ON teams
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to teams" ON teams
  FOR DELETE USING (true);

-- 8. СОЗДАНИЕ RLS ПОЛИТИК ДЛЯ PLAYER_STATS
CREATE POLICY "Allow public read access to player_stats" ON player_stats
  FOR SELECT USING (true);

CREATE POLICY "Allow public write access to player_stats" ON player_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to player_stats" ON player_stats
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to player_stats" ON player_stats
  FOR DELETE USING (true);

-- 9. СОЗДАНИЕ RLS ПОЛИТИК ДЛЯ PLAYER_MATCHES
CREATE POLICY "Allow public read access to player_matches" ON player_matches
  FOR SELECT USING (true);

CREATE POLICY "Allow public write access to player_matches" ON player_matches
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete access to player_matches" ON player_matches
  FOR DELETE USING (true);

-- ============================================================================
-- ДАЛЬШЕ НУЖНО В SUPABASE DASHBOARD:
-- ============================================================================
-- 1. Перейдите в Settings → API → Allowed web origins
-- 2. Добавьте эти origins:
--    - http://localhost:8000
--    - http://127.0.0.1:8000
-- 3. Сохраните
--
-- 4. (Опционально) Загрузите данные из teams_rows.json в таблицу teams
--    Для этого используйте csv import или выполните INSERT вручную
-- ============================================================================
