## Локальная конфигурация (Вариант 1 — Простой фронтенд)

### Для разработки локально:

1. **Скопируйте шаблон конфига:**
   ```bash
   cp js/config.local.js.example js/config.local.js
   ```

2. **Отредактируйте `js/config.local.js`** и вставьте ваши реальные ключи:
   ```javascript
   window.SUPABASE_URL = 'https://pwjshenmyzmmyevecpcc.supabase.co';
   window.SUPABASE_ANON_KEY = 'ваш_реальный_anon_ключ';
   ```

3. Получайте значения отсюда: https://supabase.com/dashboard → Settings → API

### Система загрузки конфигов:

В `index.html` порядок загрузки скриптов:
```html
<!-- 1. Попытка загрузить локальный конфиг (не коммитится) -->
<script src="js/config.local.js"></script>
<!-- 2. Фоллбэк — дефолтный конфиг (коммитится в git) -->
<script src="js/config.js"></script>
```

Если `config.local.js` существует — используются его значения  
Если нет — используются значения из `config.js` (пример/дефолт)

### Безопасность:

- ✅ `js/config.local.js` в `.gitignore` — не коммитится в git
- ✅ `js/config.local.js.example` — шаблон для разработчиков
- ✅ Реальные ключи остаются на локальной машине
- ✅ Просто и работает без сборщика (Webpack/Vite)

### Для Vercel/деплоя:

Добавьте переменные окружения в Vercel → Settings → Environment Variables:
```
VITE_SUPABASE_URL=https://pwjshenmyzmmyevecpcc.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_ключ
```

И обновите скрипт подстановки при сборке (если будете использовать Vite в будущем).

**На данный момент:** просто используйте локальный `js/config.local.js` для разработки.
