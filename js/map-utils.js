(function () {
  const DEFAULT_MAP_POOL = [
    'Mirage',
    'Dust2',
    'Ancient',
    'Overpass',
    'Train',
    'Nuke',
    'Inferno'
  ];

  const MAP_THEMES = {
    Dust2: { gradient: 'linear-gradient(120deg,#c7903c,#e9d8a6)', accent: '#f4b942' },
    Ancient: { gradient: 'linear-gradient(120deg,#0f4c5c,#81b29a)', accent: '#4cb5ae' },
    Overpass: { gradient: 'linear-gradient(120deg,#c96f32,#f2a365)', accent: '#f4a261' },
    Nuke: { gradient: 'linear-gradient(120deg,#143f6b,#f5b700)', accent: '#f5b700' },
    Vertigo: { gradient: 'linear-gradient(120deg,#5a189a,#9d4edd)', accent: '#9d4edd' },
    Inferno: { gradient: 'linear-gradient(120deg,#8a1c1c,#f28482)', accent: '#e63946' },
    Train: { gradient: 'linear-gradient(120deg,#0c7b93,#00a8cc)', accent: '#00a8cc' },
    Mirage: { gradient: 'linear-gradient(120deg,#a855f7,#ec4899)', accent: '#d946ef' },
    Anubis: { gradient: 'linear-gradient(120deg,#b97329,#f2c14e)', accent: '#f2c14e' }
  };

  function getPool() {
    return [...DEFAULT_MAP_POOL];
  }

  function getTheme(mapName) {
    return MAP_THEMES[mapName] || { gradient: 'linear-gradient(120deg,#334155,#1e293b)', accent: '#94a3b8' };
  }

  const MAP_IMAGES = {
    'Inferno': 'https://liquipedia.net/commons/images/thumb/0/08/CS2_de_inferno.png/534px-CS2_de_inferno.png',
    'Dust2': 'https://liquipedia.net/commons/images/thumb/d/d7/CS2_Dust_2_A_Site.jpg/534px-CS2_Dust_2_A_Site.jpg',
    'Dust II': 'https://liquipedia.net/commons/images/thumb/d/d7/CS2_Dust_2_A_Site.jpg/534px-CS2_Dust_2_A_Site.jpg',
    'Mirage': 'https://liquipedia.net/commons/images/thumb/f/f1/CS2_de_mirage.png/534px-CS2_de_mirage.png',
    'Train': 'https://liquipedia.net/commons/images/thumb/4/44/CS2_de_train.png/534px-CS2_de_train.png',
    'Overpass': 'https://liquipedia.net/commons/images/thumb/3/3c/CS2_de_overpass.png/534px-CS2_de_overpass.png',
    'Ancient': 'https://liquipedia.net/commons/images/thumb/f/fc/CS2_de_ancient.png/534px-CS2_de_ancient.png',
    'Nuke': 'https://liquipedia.net/commons/images/thumb/a/ad/CS2_de_nuke.png/534px-CS2_de_nuke.png'
  };

  function getMapImage(mapName) {
    if (!mapName) return null;
    // Прямое совпадение
    if (MAP_IMAGES[mapName]) return MAP_IMAGES[mapName];
    // Нормализация для Dust2/Dust II
    const normalized = mapName.trim();
    if (normalized === 'Dust2' || normalized === 'Dust II' || normalized === 'Dust 2') {
      return MAP_IMAGES['Dust2'] || MAP_IMAGES['Dust II'];
    }
    // Проверяем все ключи с нормализацией пробелов
    for (const key in MAP_IMAGES) {
      if (key.replace(/\s+/g, '') === normalized.replace(/\s+/g, '')) {
        return MAP_IMAGES[key];
      }
    }
    return null;
  }

  window.mapUtils = {
    getPool,
    getTheme,
    getMapImage
  };
})();

