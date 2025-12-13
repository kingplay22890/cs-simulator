(function () {
  const STORAGE_KEY = 'cs_player_awards';

  const normalizeName = (name) => (name || '').trim().toLowerCase();

  function readStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('Unable to read player awards store, resetting.', error);
      return {};
    }
  }

  function writeStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store || {}));
    } catch (error) {
      console.warn('Unable to persist player awards store.', error);
    }
  }

  function mergeAwards(...awardLists) {
    const map = new Map();
    awardLists
      .filter(Boolean)
      .forEach((list) => {
        list.forEach((award) => {
          if (!award) return;
          const name = (award.name || '').trim();
          const img = (award.img || '').trim();
          const key = `${name.toLowerCase()}|${img}`;
          if (!map.has(key)) {
            map.set(key, { name, img });
          }
        });
      });
    return Array.from(map.values());
  }

  function getAwards(playerName) {
    if (!playerName) return [];
    const store = readStore();
    const key = normalizeName(playerName);
    const list = store[key];
    return Array.isArray(list) ? [...list] : [];
  }

  async function replaceAwards(playerName, awards, statsSnapshot) {
    if (!playerName) return [];
    const normalizedAwards = mergeAwards(awards || []);
    const store = readStore();
    store[normalizeName(playerName)] = normalizedAwards;
    writeStore(store);
    await syncRemoteAwards(playerName, normalizedAwards, statsSnapshot, 'replace');
    return normalizedAwards;
  }

  async function addAwards(playerName, awardsToAdd, statsSnapshot) {
    if (!playerName || !Array.isArray(awardsToAdd) || awardsToAdd.length === 0) {
      return getAwards(playerName);
    }
    const store = readStore();
    const key = normalizeName(playerName);
    const current = Array.isArray(store[key]) ? store[key] : [];
    const merged = mergeAwards(current, awardsToAdd);
    if (merged.length === current.length) {
      return merged;
    }
    store[key] = merged;
    writeStore(store);
    await syncRemoteAwards(playerName, awardsToAdd, statsSnapshot, 'append');
    return merged;
  }

  async function syncRemoteAwards(playerName, awardsPayload, statsSnapshot, mode) {
    if (!window.csApi || typeof window.csApi.updatePlayerStats !== 'function') return;
    try {
      let stats = statsSnapshot;
      if (!stats && typeof window.csApi.fetchPlayerStats === 'function') {
        stats = await window.csApi.fetchPlayerStats(playerName);
      }
      if (!stats) return;
      const currentAwards = Array.isArray(stats.awards) ? stats.awards : [];
      const nextAwards =
        mode === 'replace'
          ? mergeAwards(awardsPayload)
          : mergeAwards(currentAwards, awardsPayload);
      await window.csApi.updatePlayerStats(playerName, {
        ...stats,
        awards: nextAwards
      });
    } catch (error) {
      console.warn(`Failed to sync awards for ${playerName}`, error);
    }
  }

  window.playerAwardsStore = {
    getAwards,
    addAwards,
    replaceAwards,
    mergeAwards
  };
})();

