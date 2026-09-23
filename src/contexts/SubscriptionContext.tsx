import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { planosService } from '@/services/planos'
import { PlanoAssinatura } from '@/types'

interface SubscriptionContextType {
  plano: PlanoAssinatura | null
  loading: boolean
  isBloqueado: boolean
  isTrial: boolean
  isAtivo: boolean
  diasRestantesTrial: number
  recarregarPlano: () => Promise<void>
  simularFimDeTeste: () => Promise<void>
  restaurarTesteDemo: (dias?: number) => Promise<void>
  assinarPlanoSimulado: () => Promise<PlanoAssinatura>
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const [plano, setPlano] = useState<PlanoAssinatura | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const recarregarPlano = useCallback(async () => {
    if (!user?.id || !isAuthenticated) {
      setPlano(null)
      setLoading(false)
      return
    }

    try {
      const p = await planosService.iniciarOuVerificarTrial(user.id)
      setPlano(p)
    } catch (err) {
      console.error('Erro ao sincronizar plano/trial:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, isAuthenticated])

  useEffect(() => {
    recarregarPlano()
  }, [recarregarPlano])

  // Cálculo de dias restantes e status
  let diasRestantesTrial = 0
  let isTrial = false
  let isAtivo = false
  let isBloqueado = false

  if (plano) {
    if (plano.status === 'ativo') {
      isAtivo = true
      isBloqueado = false
    } else if (plano.status === 'trial') {
      isTrial = true
      if (plano.trial_ate) {
        const diffMs = new Date(plano.trial_ate).getTime() - Date.now()
        // Arredondamento para cima dos dias
        const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        diasRestantesTrial = Math.max(0, dias)
        if (diffMs <= 0) {
          isBloqueado = true
        }
      }
    } else if (plano.status === 'expirado' || plano.status === 'inativo') {
      isBloqueado = true
    }
  }

  const simularFimDeTeste = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const p = await planosService.simularFimTeste(user.id)
      setPlano(p)
    } finally {
      setLoading(false)
    }
  }

  const restaurarTesteDemo = async (dias = 3) => {
    if (!user?.id) return
    setLoading(true)
    try {
      const p = await planosService.restaurarTeste(user.id, dias)
      setPlano(p)
    } finally {
      setLoading(false)
    }
  }

  const assinarPlanoSimulado = async () => {
    if (!user?.id) throw new Error('Usuário não autenticado')
    setLoading(true)
    try {
      const p = await planosService.assinarPlano(user.id, 'starter')
      setPlano(p)
      return p
    } finally {
      setLoading(false)
    }
  }

  return (
    <SubscriptionContext.Provider
      value={{
        plano,
        loading,
        isBloqueado,
        isTrial,
        isAtivo,
        diasRestantesTrial,
        recarregarPlano,
        simularFimDeTeste,
        restaurarTesteDemo,
        assinarPlanoSimulado,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export const useSubscription = () => {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription deve ser usado dentro de um SubscriptionProvider')
  }
  return context
}
