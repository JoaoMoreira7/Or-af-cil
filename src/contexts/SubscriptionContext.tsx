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
  isDono: boolean
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

  const carregarAssinatura = useCallback(
    async (forcar: boolean = false) => {
      if (!user?.id) {
        setAssinatura(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const plano = await planosService.iniciarOuVerificarTrial(user.id, forcar)
        setAssinatura(plano)
      } catch (err) {
        console.error('Erro ao verificar status do plano:', err)
      } finally {
        setLoading(false)
      }
    },
    [user?.id],
  )

  const carregadoParaUserIdRef = React.useRef<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      carregadoParaUserIdRef.current = null
      setAssinatura(null)
      setLoading(false)
      return
    }

    // Evita chamada redundante em re-renderizações rápidas do mesmo usuário
    if (carregadoParaUserIdRef.current === user.id) {
      return
    }
    carregadoParaUserIdRef.current = user.id
    carregarAssinatura()
  }, [user?.id, carregarAssinatura])

  // Identificação do dono do produto (jaocarloss@gmail.com)
  const isDono = user?.email?.toLowerCase().trim() === 'jaocarloss@gmail.com'

  // Cálculos de status (para o dono: SEMPRE ativo, NUNCA trial, NUNCA expirado, NUNCA bloqueado)
  const isTrial = isDono ? false : assinatura?.status === 'trial'
  const isAtivo = isDono ? true : assinatura?.status === 'ativo'
  const isExpirado = isDono ? false : assinatura?.status === 'expirado'
  const isBloqueado = isDono ? false : isExpirado

  const diasRestantesTrial = React.useMemo(() => {
    if (isDono) return 0
    if (!assinatura?.trial_ate) return 0
    const agora = new Date()
    const trialAte = new Date(assinatura.trial_ate)
    const diffMs = trialAte.getTime() - agora.getTime()
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return diffDias > 0 ? diffDias : 0
  }, [isDono, assinatura?.trial_ate])

  // Dono tem acesso total no plano 'premium'
  const planoId: PlanoId = isDono ? 'premium' : normalizarPlanoId(assinatura?.plano)
  const planoConfig: PlanoConfig = obterConfigPlano(planoId)

  // Verificação de gate de recurso por nível de plano
  const temAcessoRecurso = useCallback(
    (planoMinimo: PlanoId): boolean => {
      // Dono do sistema tem acesso irrestrito a todos os recursos da aplicação
      if (isDono) return true
      if (isExpirado) return false
      // No período de testes liberamos todos os recursos para experimentação completa da ferramenta
      if (isTrial && diasRestantesTrial > 0) return true
      return planoTemAcesso(planoId, planoMinimo)
    },
    [isDono, isExpirado, isTrial, diasRestantesTrial, planoId],
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
        isDono,
        diasRestantesTrial,
        planoId,
        planoConfig,
        temAcessoRecurso,
        assinarPlano,
        simularFimTeste,
        restaurarTeste,
        recarregarAssinatura: () => carregarAssinatura(true),
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
