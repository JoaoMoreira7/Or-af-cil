import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar?: string
}

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, pass: string) => Promise<void>
  signup: (name: string, email: string, pass: string) => Promise<void>
  logout: () => void
  updateUser: (data: { name?: string }) => Promise<void>
  refreshAuth: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const rec = pb.authStore.record as RecordModel
      return {
        id: rec.id,
        email: rec.email || '',
        name: rec.name || rec.email?.split('@')[0] || 'Usuário',
        avatar: rec.avatar || '',
      }
    }
    return null
  })

  const [token, setToken] = useState<string | null>(pb.authStore.token || null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const syncAuth = () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const rec = pb.authStore.record as RecordModel
      setUser({
        id: rec.id,
        email: rec.email || '',
        name: rec.name || rec.email?.split('@')[0] || 'Usuário',
        avatar: rec.avatar || '',
      })
      setToken(pb.authStore.token)
    } else {
      setUser(null)
      setToken(null)
    }
  }

  useEffect(() => {
    syncAuth()
    setIsLoading(false)

    const unsubscribe = pb.authStore.onChange(() => {
      syncAuth()
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    await pb.collection('users').authWithPassword(email.trim(), pass)
    syncAuth()
  }

  const signup = async (name: string, email: string, pass: string) => {
    // 1. Criar usuário
    const createdUser = await pb.collection('users').create({
      name: name.trim(),
      email: email.trim(),
      password: pass,
      passwordConfirm: pass,
      verified: true,
    })

    // 2. Autenticar
    await pb.collection('users').authWithPassword(email.trim(), pass)
    syncAuth()

    // 3. Criar registro inicial com Teste Grátis de 7 dias
    try {
      const trialDate = new Date()
      trialDate.setDate(trialDate.getDate() + 7)
      await pb.collection('planos').create({
        user_id: createdUser.id,
        plano: 'starter',
        status: 'trial',
        trial_ate: trialDate.toISOString(),
      })
    } catch {
      // silencioso se já existir
    }
  }

  const logout = () => {
    pb.authStore.clear()
    syncAuth()
  }

  const updateUser = async (data: { name?: string }) => {
    if (!user) return
    const updated = await pb.collection('users').update(user.id, data)
    setUser((prev) => (prev ? { ...prev, name: updated.name || prev.name } : null))
  }

  const refreshAuth = () => {
    syncAuth()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && pb.authStore.isValid,
        isLoading,
        login,
        signup,
        logout,
        updateUser,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
