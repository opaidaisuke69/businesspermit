import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { storage } from '../lib/storage'
import api, { registerDeactivationHandler } from '../lib/api'

interface User {
  id: number
  first_name: string
  middle_name?: string
  last_name: string
  email: string
  phone: string
  address?: string
  age?: number
  gender?: 'male' | 'female' | 'other'
  civil_status?: string
  ctc_number?: string
  num_employees?: number
  verification_status: 'pending' | 'verified' | 'rejected'
  onboarding_step: number
  onboarding_completed: number
}

interface AuthContextType {
  user: User | null
  loading: boolean
  deactivated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (data: Record<string, string>) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]             = useState<User | null>(null)
  const [loading, setLoading]       = useState(true)
  const [deactivated, setDeactivated] = useState(false)

  // Register the deactivation handler once on mount
  useEffect(() => {
    registerDeactivationHandler(() => {
      setUser(null)
      setDeactivated(true)
    })
  }, [])

  useEffect(() => {
    storage.getItem('lcc_user').then(raw => {
      if (raw) {
        try { setUser(JSON.parse(raw)) } catch {}
      }
    }).finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    await storage.setItem('lcc_token', data.token)
    await storage.setItem('lcc_user', JSON.stringify(data.user))
    setDeactivated(false)
    setUser(data.user)
  }

  const register = async (formData: Record<string, string>) => {
    await api.post('/auth/register', formData)
  }

  const logout = async () => {
    await storage.multiRemove(['lcc_token', 'lcc_user'])
    setDeactivated(false)
    setUser(null)
  }

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me')
    await storage.setItem('lcc_user', JSON.stringify(data))
    setUser(data)
  }

  return (
    <AuthContext.Provider value={{ user, loading, deactivated, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
