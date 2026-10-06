import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'
import { planosService } from '@/services/planos'

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar?: string
  admin?: boolean
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
        admin: !!rec.admin,
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
        admin: !!rec.admin,
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

    // 3. Upsert inicial centralizado com Teste Grátis de 7 dias ou plano do Dono
    try {
      const emailNormalizado = (email || '').toLowerCase().trim()
      const isDono = emailNormalizado === 'jaocarloss@gmail.com'

      if (isDono) {
        await planosService.garantirPlanoUsuario(createdUser.id, {
          plano: 'premium',
          status: 'ativo',
          renovacao_em: '2099-12-31T23:59:59.000Z',
          trial_ate: '2099-12-31T23:59:59.000Z',
          aviso_teste_enviado: true,
        })
      } else {
        const trialDate = new Date()
        trialDate.setDate(trialDate.getDate() + 7)
        await planosService.garantirPlanoUsuario(createdUser.id, {
          plano: 'essencial',
          status: 'trial',
          trial_ate: trialDate.toISOString(),
          aviso_teste_enviado: false,
        })
      }
    } catch (err) {
      console.warn('[Signup] Aviso ao configurar plano inicial:', err)
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
