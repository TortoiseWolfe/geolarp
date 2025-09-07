import { db } from './database';

export class StorageManager {
  private static instance: StorageManager;
  private storageThreshold = 0.8; // 80% threshold

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  async checkStorageQuota(): Promise<{
    usage: number;
    quota: number;
    percentUsed: number;
  }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = quota > 0 ? (usage / quota) : 0;

      return {
        usage,
        quota,
        percentUsed
      };
    }

    return {
      usage: 0,
      quota: 0,
      percentUsed: 0
    };
  }

  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    }
    return false;
  }

  async checkPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persisted' in navigator.storage) {
      const isPersisted = await navigator.storage.persisted();
      return isPersisted;
    }
    return false;
  }

  async performCleanupIfNeeded(): Promise<void> {
    const { percentUsed } = await this.checkStorageQuota();
    
    if (percentUsed > this.storageThreshold) {
      console.log(`Storage usage at ${(percentUsed * 100).toFixed(1)}%, performing cleanup...`);
      await this.performCleanup();
    }
  }

  async performCleanup(): Promise<void> {
    try {
      // Clear old map tiles (older than 30 days)
      await db.clearOldTiles(30);
      
      // Clear very old tiles if still over threshold
      const { percentUsed } = await this.checkStorageQuota();
      if (percentUsed > this.storageThreshold) {
        await db.clearOldTiles(7);
      }
      
      console.log('Storage cleanup completed');
    } catch (error) {
      console.error('Error during storage cleanup:', error);
    }
  }

  async getStorageStats(): Promise<{
    mapTilesCount: number;
    charactersCount: number;
    encountersCount: number;
    estimatedSize: number;
  }> {
    const mapTilesCount = await db.mapTiles.count();
    const charactersCount = await db.characters.count();
    const encountersCount = await db.encounters.count();
    
    const { usage } = await this.checkStorageQuota();
    
    return {
      mapTilesCount,
      charactersCount,
      encountersCount,
      estimatedSize: usage
    };
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async monitorStorage(callback: (stats: any) => void, intervalMs: number = 60000): () => void {
    const checkStorage = async () => {
      try {
        const quota = await this.checkStorageQuota();
        const stats = await this.getStorageStats();
        const isPersistent = await this.checkPersistentStorage();
        
        callback({
          ...quota,
          ...stats,
          isPersistent,
          formattedUsage: this.formatBytes(quota.usage),
          formattedQuota: this.formatBytes(quota.quota)
        });
        
        // Perform cleanup if needed
        await this.performCleanupIfNeeded();
      } catch (error) {
        console.error('Error monitoring storage:', error);
      }
    };
    
    // Check immediately
    checkStorage();
    
    // Set up interval
    const intervalId = setInterval(checkStorage, intervalMs);
    
    // Return cleanup function
    return () => clearInterval(intervalId);
  }
}

export const storageManager = StorageManager.getInstance();