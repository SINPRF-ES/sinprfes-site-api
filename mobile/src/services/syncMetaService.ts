import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_LAST_SYNC_FILIADOS = '@sinprf/last_sync_filiados';

export async function setLastSyncFiliados(timestampMs: number): Promise<void> {
  await AsyncStorage.setItem(KEY_LAST_SYNC_FILIADOS, String(timestampMs));
}

export async function getLastSyncFiliados(): Promise<number | null> {
  const v = await AsyncStorage.getItem(KEY_LAST_SYNC_FILIADOS);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
