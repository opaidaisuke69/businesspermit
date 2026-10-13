import axios from 'axios'
import { storage } from './storage'

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.8.148/lccsystem/bpa-backend/api'

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
})

// ── Deactivation callback ─────────────────────────────────────
// AuthContext registers this so the interceptor can trigger logout
// without needing React hooks in this module.
let _onDeactivated: (() => void) | null = null

export function registerDeactivationHandler(fn: () => void) {
  _onDeactivated = fn
}

// ── Request interceptor — attach token ───────────────────────
api.interceptors.request.use(async (config) => {
  const token = await storage.getItem('lcc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor — handle auth errors ────────────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const data = err.response?.data

    // Account deactivated — force logout immediately
    if (err.response?.status === 403 && data?.account_deactivated) {
      await storage.multiRemove(['lcc_token', 'lcc_user'])
      _onDeactivated?.()
      return Promise.reject(err)
    }

    // Token expired / invalid — clear storage
    if (err.response?.status === 401) {
      await storage.multiRemove(['lcc_token', 'lcc_user'])
    }

    return Promise.reject(err)
  }
)

export default api
