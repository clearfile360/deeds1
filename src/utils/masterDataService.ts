import { MasterData, MasterTableData, Clause } from '../types';
import { TN_MASTER_DATA } from './dummyData';

let masterDataCache: MasterData | null = null;

/**
 * Fetches master data from the backend Master Data Engine API with automatic caching and fallback.
 */
export async function getMasterData(): Promise<MasterData> {
  if (masterDataCache) {
    return masterDataCache;
  }

  try {
    const res = await fetch('/api/master-data/all');
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json?.masterData) {
        masterDataCache = json.masterData as MasterData;
        return masterDataCache;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch master data from backend API, using local engine dataset:', err);
  }

  masterDataCache = TN_MASTER_DATA;
  return TN_MASTER_DATA;
}

/**
 * Synchronous accessor returning cached data or local fallback
 */
export function getMasterDataSync(): MasterData {
  return masterDataCache || TN_MASTER_DATA;
}

/**
 * Helper to get specific master list
 */
export function getMasterCategory(category: keyof MasterData): MasterTableData[] | Clause[] {
  const data = getMasterDataSync();
  return (data[category] as any) || [];
}
