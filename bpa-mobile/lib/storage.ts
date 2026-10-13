/**
 * Storage abstraction using expo-secure-store.
 * Provides the same getItem/setItem/removeItem/multiRemove API
 * that AsyncStorage had, so swapping is a one-line change.
 */
import * as SecureStore from 'expo-secure-store'

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value)
  },

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key)
  },

  async multiRemove(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k => SecureStore.deleteItemAsync(k)))
  },
}
