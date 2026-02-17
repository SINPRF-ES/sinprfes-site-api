import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const KEY = "SINPRFES_STABLE_DEVICE_ID_V1";

export async function getStableDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) return existing;

    // Prefer native installation id if available
    const nativeId =
      (Application as any).androidId ||
      (Application as any).getAndroidId?.() ||
      (Application as any).applicationId ||
      "";

    const seed = `${nativeId}|${Date.now()}|${Math.random()}`;

    const id = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      seed
    );

    await SecureStore.setItemAsync(KEY, id, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });

    return id;
  } catch {
    // Fallback: still return a deterministic-ish value in worst case
    return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
