import AsyncStorage from '@react-native-async-storage/async-storage';

export class AsyncStorageService {
  static async getItem<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  static async setItem<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // TODO: Handle error
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // TODO: Handle error
    }
  }

  static async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch {
      // TODO: Handle error
    }
  }
}