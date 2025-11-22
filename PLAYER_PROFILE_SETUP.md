# Настройка Supabase для профилей игроков

## SQL для создания таблиц

Запустите этот SQL в Supabase SQL Editor:

```sql
-- Таблица для профилей игроков
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица для истории матчей игроков
CREATE TABLE IF NOT EXISTS player_matches (
  id BIGSERIAL PRIMARY KEY,
  player_name TEXT NOT NULL REFERENCES player_stats(player_name),
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

-- Индексы для оптимизации (пропускаем если уже существуют)
CREATE INDEX IF NOT EXISTS idx_player_stats_name ON player_stats(player_name);
CREATE INDEX IF NOT EXISTS idx_player_matchs_name ON player_matches(player_name);
CREATE INDEX IF NOT EXISTS idx_player_matches_date ON player_matches(match_date DESC);

-- Таблица для команд (если её ещё нет)e
CREATE TABLE IF NOT EXISTS teams (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  rating INTEGER DEFAULT 1500,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS政策 (если нужна защита)
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to player_stats" ON player_stats
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to player_matches" ON player_matches
  FOR SELECT USING (true);
```

## Интеграция в js/api.js

Если у вас ещё нет файла `js/api.js`, создайте его:

```javascript
// Инициализация Supabase
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_KEY';

window.csApi = {
  client: null,
  
  async init() {
    if (typeof supabase === 'undefined') {
      console.error('Supabase не загружен');
      return false;
    }
    
    this.client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return true;
  },
  
  async fetchTeams() {
    const { data } = await this.client.from('teams').select('*');
    return data || [];
  },
  
  async upsertTeam(team) {
    const { data, error } = await this.client
      .from('teams')
      .upsert(team, { onConflict: 'name' });
    if (error) console.error('Error upserting team:', error);
    return data;
  },
  
  async updatePlayerStats(playerName, stats) {
    const { data, error } = await this.client
      .from('player_stats')
      .upsert({ player_name: playerName, ...stats }, { onConflict: 'player_name' });
    if (error) console.error('Error updating player stats:', error);
    return data;
  }
};

// Инициализируем при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  await window.csApi.init();
});
```

## Подключение Supabase JS к HTML

Добавьте в `<head>` вашего HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/api.js"></script>
```

## Переменные окружения

Создайте файл `js/config.example.js` с примером:

```javascript
window.SUPABASE_CONFIG = {
  URL: 'https://your-project.supabase.co',
  KEY: 'your-anon-key'
};
```

Скопируйте в `js/config.js` и заполните ваши данные из Supabase Dashboard.

---

Готово! Теперь:
- Каждый игрок имеет профиль с URL: `player-profile.html?player=NickName`
- Статистика собирается из история матчей команд
- Можно сохранять статистику в Supabase
- Ники в баннере команды - это ссылки на профили
