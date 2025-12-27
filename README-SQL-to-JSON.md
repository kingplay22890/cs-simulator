Инструкция: как преобразовать SQL из `teams_rows.sql` в `teams-local.json`

1) Поместите ваш `teams_rows.sql` рядом с этим репозиторием или укажите путь.
2) Запустите скрипт-конвертер (нужен Python 3):

```powershell
cd c:\cs-simulator.3\cs-simulator-main\cs-simulator-main
python tools\convert_sql_to_json.py "C:\Users\Nikit\Downloads\teams_rows.sql" teams-local.json
```

3) После выполнения будет создан/обновлён `teams-local.json` в каталоге проекта. Откройте `http://localhost:8000/index.html` (запустите `python -m http.server 8000`) — приложение подхватит локальный JSON как запасной источник.

Примечания:
- Скрипт пытается распарсить простые `INSERT INTO table (col1,col2,...) VALUES (...),(...);`.
- Перед использованием проверьте `teams-local.json` и исправьте поля (например: `players` должны быть массивом объектов).
- Если INSERT содержит JSON внутри single-quotes, скрипт постарается распарсить такие поля.
