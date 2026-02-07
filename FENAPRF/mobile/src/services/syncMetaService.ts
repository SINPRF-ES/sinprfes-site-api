import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_LAST_SYNC_USERS = '@fenaprf/last_sync_users';

export async function setLastSyncUsers(timestampMs: number): Promise<void> {
  await AsyncStorage.setItem(KEY_LAST_SYNC_USERS, String(timestampMs));
}

export async function getLastSyncUsers(): Promise<number | null> {
  const v = await AsyncStorage.getItem(KEY_LAST_SYNC_USERS);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
