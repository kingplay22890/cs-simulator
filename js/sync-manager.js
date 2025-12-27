/**
 * Sync Manager - Offline-first synchronization with Supabase
 * Keeps track of pending changes and syncs them when requested
 */

(function() {
  const PENDING_KEY = 'cs_pending_sync';
  const SYNC_INTERVAL = 5000; // Auto-sync attempt every 5s (only if enabled)
  
  let autoSyncEnabled = localStorage.getItem('cs_auto_sync_enabled') === 'true';
  let isSyncing = false;
  let pendingCount = 0;
  let syncListeners = [];

  const SyncManager = {
    /**
     * Add a pending change to the queue
     */
    queueChange(type, data) {
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
        pending.push({
          type,
          data,
          timestamp: Date.now(),
          id: Math.random().toString(36).substr(2, 9)
        });
        localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        pendingCount = pending.length;
        this.notifyListeners();
        console.log(`📦 Queued ${type}:`, data, `(${pendingCount} pending)`);
      } catch (e) {
        console.error('Error queueing change:', e);
      }
    },

    /**
     * Get all pending changes
     */
    getPending() {
      try {
        return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      } catch {
        return [];
      }
    },

    /**
     * Get count of pending changes
     */
    getPendingCount() {
      return pendingCount;
    },

    /**
     * Clear all pending changes
     */
    clearPending() {
      localStorage.removeItem(PENDING_KEY);
      pendingCount = 0;
      this.notifyListeners();
    },

    /**
     * Sync pending changes to Supabase
     */
    async syncToDatabase() {
      if (isSyncing) {
        console.warn('⏳ Sync already in progress, skipping...');
        return { success: false, message: 'Sync already in progress' };
      }

      if (!window.csApi) {
        return { success: false, message: 'API not available' };
      }

      isSyncing = true;
      const pending = this.getPending();

      if (pending.length === 0) {
        isSyncing = false;
        return { success: true, synced: 0, message: 'No pending changes' };
      }

      let synced = 0;
      let errors = [];

      for (const change of pending) {
        try {
          console.log(`🔄 Syncing ${change.type}:`, change.data);

          switch (change.type) {
            case 'updatePlayerStats':
              // await window.csApi.updatePlayerStats(change.data.playerName, change.data.stats);
              if (window.csApi.updatePlayerStats) {
                const result = await window.csApi.updatePlayerStats(
                  change.data.playerName,
                  change.data.stats
                );
                if (result !== null) {
                  synced++;
                  console.log(`✅ Synced player stats: ${change.data.playerName}`);
                }
              }
              break;

            case 'savePlayerMatch':
              if (window.csApi.savePlayerMatch) {
                const result = await window.csApi.savePlayerMatch(change.data);
                if (result !== null) {
                  synced++;
                  console.log(`✅ Synced match for player: ${change.data.player_name}`);
                }
              }
              break;

            case 'updateTeam':
              if (window.csApi && window.csApi.updateTeam) {
                const result = await window.csApi.updateTeam(change.data.name, change.data);
                if (result !== null) {
                  synced++;
                  console.log(`✅ Synced team: ${change.data.name}`);
                }
              }
              break;

            default:
              console.warn(`Unknown sync type: ${change.type}`);
          }
        } catch (e) {
          console.error(`❌ Error syncing ${change.type}:`, e);
          errors.push({ type: change.type, error: e.message });
        }
      }

      // Remove synced changes from pending
      const updatedPending = pending.slice(synced);
      localStorage.setItem(PENDING_KEY, JSON.stringify(updatedPending));
      pendingCount = updatedPending.length;

      isSyncing = false;
      this.notifyListeners();

      const result = {
        success: errors.length === 0,
        synced,
        total: pending.length,
        remaining: updatedPending.length,
        errors
      };

      console.log(
        `📊 Sync complete: ${synced}/${pending.length} synced, ${updatedPending.length} remaining`
      );

      return result;
    },

    /**
     * Enable/disable auto sync
     */
    setAutoSync(enabled) {
      autoSyncEnabled = enabled;
      localStorage.setItem('cs_auto_sync_enabled', enabled ? 'true' : 'false');
      if (enabled) {
        this.startAutoSync();
      }
    },

    /**
     * Get auto sync status
     */
    isAutoSyncEnabled() {
      return autoSyncEnabled;
    },

    /**
     * Start auto-sync loop
     */
    startAutoSync() {
      if (this._autoSyncTimer) return;
      console.log('🔁 Starting auto-sync...');
      this._autoSyncTimer = setInterval(() => {
        if (pendingCount > 0 && !isSyncing) {
          console.log(`🔄 Auto-syncing ${pendingCount} pending changes...`);
          this.syncToDatabase();
        }
      }, SYNC_INTERVAL);
    },

    /**
     * Stop auto-sync loop
     */
    stopAutoSync() {
      if (this._autoSyncTimer) {
        clearInterval(this._autoSyncTimer);
        this._autoSyncTimer = null;
        console.log('⏹️ Auto-sync stopped');
      }
    },

    /**
     * Subscribe to sync events
     */
    onSyncChange(callback) {
      if (!syncListeners.includes(callback)) {
        syncListeners.push(callback);
      }
    },

    /**
     * Unsubscribe from sync events
     */
    offSyncChange(callback) {
      syncListeners = syncListeners.filter(cb => cb !== callback);
    },

    /**
     * Notify all listeners of changes
     */
    notifyListeners() {
      syncListeners.forEach(cb => {
        try {
          cb({
            pendingCount,
            isAutoSyncEnabled: autoSyncEnabled,
            isSyncing
          });
        } catch (e) {
          console.error('Error in sync listener:', e);
        }
      });
    }
  };

  // Start auto-sync if it was previously enabled
  if (autoSyncEnabled) {
    SyncManager.startAutoSync();
  }

  // Expose globally
  window.SyncManager = SyncManager;
})();
