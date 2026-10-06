import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { planosService } from '@/services/planos'
import { gatewayPagamentoService } from '@/services/gatewayPagamento'
import { PlanoAssinatura, FormaPagamentoAssinatura } from '@/types'
import {
  PlanoId,
  PlanoConfig,
  obterConfigPlano,
  normalizarPlanoId,
  planoTemAcesso,
} from '@/config/plans'

interface AssinarPlanoParams {
  formaPagamento?: FormaPagamentoAssinatura
  planoId?: PlanoId | string
  dadosCartao?: {
    nomeTitular: string
    numeroMascarado: string
    validade: string
  }
}

interface SubscriptionContextType {
  assinatura: PlanoAssinatura | null
  loading: boolean
  isTrial: boolean
  isAtivo: boolean
  isExpirado: boolean
  isBloqueado: boolean
  diasRestantesTrial: number
  planoId: PlanoId
  planoConfig: PlanoConfig
  temAcessoRecurso: (planoMinimo: PlanoId) => boolean
  assinarPlano: (params?: AssinarPlanoParams) => Promise<void>
  simularFimTeste: () => Promise<void>
  restaurarTeste: () => Promise<void>
  recarregarAssinatura: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [assinatura, setAssinatura] = useState<PlanoAssinatura | null>(null)
  const [loading, setLoading] = useState(true)

  const carregarAssinatura = useCallback(async () => {
    if (!user?.id) {
      setAssinatura(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const plano = await planosService.iniciarOuVerificarTrial(user.id)
      setAssinatura(plano)
    } catch (err) {
      console.error('Erro ao verificar status do plano:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    carregarAssinatura()
  }, [carregarAssinatura])

  // Cálculos de status
  const isTrial = assinatura?.status === 'trial'
  const isAtivo = assinatura?.status === 'ativo'
  const isExpirado = assinatura?.status === 'expirado'
  const isBloqueado = isExpirado

  const diasRestantesTrial = React.useMemo(() => {
    if (!assinatura?.trial_ate) return 0
    const agora = new Date()
    const trialAte = new Date(assinatura.trial_ate)
    const diffMs = trialAte.getTime() - agora.getTime()
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return diffDias > 0 ? diffDias : 0
  }, [assinatura?.trial_ate])

  const planoId: PlanoId = normalizarPlanoId(assinatura?.plano)
  const planoConfig: PlanoConfig = obterConfigPlano(planoId)

  // Verificação de gate de recurso por nível de plano
  const temAcessoRecurso = useCallback(
    (planoMinimo: PlanoId): boolean => {
      if (isExpirado) return false
      // No período de testes liberamos todos os recursos para experimentação completa da ferramenta
      if (isTrial && diasRestantesTrial > 0) return true
      return planoTemAcesso(planoId, planoMinimo)
    },
    [isExpirado, isTrial, diasRestantesTrial, planoId],
  )

  const assinarPlano = async (params?: AssinarPlanoParams) => {
    if (!user?.id) throw new Error('Usuário não autenticado')
    setLoading(true)
    try {
      const forma = params?.formaPagamento || 'pix'
      const planoEscolhido = params?.planoId || 'essencial'
      // Processa através do gateway de pagamentos registrando a venda na coleção pagamentos
      await gatewayPagamentoService.processarAssinatura({
        userId: user.id,
        planoId: planoEscolhido,
        formaPagamento: forma,
        dadosCartao: params?.dadosCartao,
      })
      await carregarAssinatura()
    } catch (err) {
      console.error('Erro ao assinar plano:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const simularFimTeste = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const atualizado = await planosService.simularFimTeste(user.id)
      setAssinatura(atualizado)
    } catch (err) {
      console.error('Erro ao simular fim de teste:', err)
    } finally {
      setLoading(false)
    }
  }

  const restaurarTeste = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const atualizado = await planosService.restaurarTeste(user.id, 3)
      setAssinatura(atualizado)
    } catch (err) {
      console.error('Erro ao restaurar teste:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SubscriptionContext.Provider
      value={{
        assinatura,
        loading,
        isTrial,
        isAtivo,
        isExpirado,
        isBloqueado,
        diasRestantesTrial,
        planoId,
        planoConfig,
        temAcessoRecurso,
        assinarPlano,
        simularFimTeste,
        restaurarTeste,
        recarregarAssinatura: carregarAssinatura,
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
