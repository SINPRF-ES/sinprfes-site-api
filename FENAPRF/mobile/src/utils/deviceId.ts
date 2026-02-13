import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const SECURE_DEVICE_ID_KEY = 'fenaprf_stable_device_id';

export async function getStableDeviceId(): Promise<string> {
  try {
    let id = await SecureStore.getItemAsync(SECURE_DEVICE_ID_KEY);
    if (id) return id;

    if (Platform.OS === 'android') {
      id = (Application as any).androidId;
    } else if (Platform.OS === 'ios') {
      id = await Application.getIosIdForVendorAsync();
    }

    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }

    await SecureStore.setItemAsync(SECURE_DEVICE_ID_KEY, id);
    return id;
  } catch (error) {
    return 'unknown_device';
  }
}
