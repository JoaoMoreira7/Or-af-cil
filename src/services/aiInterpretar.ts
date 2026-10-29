import pb from '@/lib/pocketbase/client'
import { OrçamentoItem, ComandoStatusExtraido, AudioContexto } from '@/types'
import {
  ComandoGerarCobrancaExtraido,
  ComandoBaixaExtraido,
  ComandoPersonalizarIaExtraido,
  ComandoConsultaDevedoresExtraido,
  GastoExtraido,
  ComandoConsultaGastosExtraido,
} from '@/types'

export interface ClienteNovoExtraido {
  nome?: string | null
  telefone?: string | null
  email?: string | null
  empresa?: string | null
  endereco?: string | null
}

export interface InterpretacaoResultado {
  intencao_detectada?:
    | 'orcamento'
    | 'cliente'
    | 'comando_status'
    | 'desfazer'
    | 'gerar_cobranca'
    | 'baixa_pagamento'
    | 'personalizar_ia'
    | 'consulta_devedores'
    | 'registro_gasto'
    | 'consulta_gastos'
    | 'resultado_mes'
    | 'resumo_dia'
  comando_desfazer?: boolean
  transcricao_corrigida: string
  descricao_servico?: string
  cliente_sugerido_id?: string | null
  cliente_sugerido_nome?: string | null
  cliente_novo?: ClienteNovoExtraido | null
  gasto_extraido?: GastoExtraido | null
  comando_consulta_gastos?: ComandoConsultaGastosExtraido | null
  comando_resultado_mes?: {
    lucro: number
    receita: number
    gastos_empresa: number
    gastos_pessoal: number
    mensagem_resposta: string
  } | null
  comando_resumo_dia?: {
    qtd_aguardando: number
    valor_aguardando: number
    qtd_aprovados: number
    total_a_receber: number
    mensagem_resposta: string
  } | null
  itens: OrçamentoItem[]
  prazo?: string | null
  observacoes?: string | null
  comando_status?: ComandoStatusExtraido | null
  comando_gerar_cobranca?: ComandoGerarCobrancaExtraido | null
  comando_baixa?: ComandoBaixaExtraido | null
  comando_personalizar_ia?: ComandoPersonalizarIaExtraido | null
  comando_consulta_devedores?: ComandoConsultaDevedoresExtraido | null
  confianca: 'alta' | 'media' | 'baixa'
  duvidas: string[]
}

export interface RespostaInterpretacao {
  sucesso: boolean
  audio_id?: string | null
  transcricao_original: string
  interpretacao: InterpretacaoResultado
  citations?: string[]
}

export interface InterpretarParams {
  transcricao: string
  contexto?: AudioContexto
  userId?: string
  modo?: 'geral' | 'orcamento_itens'
  preferencias?: {
    nome_preferido?: string
    tom_resposta?: string
    usar_emojis?: boolean
    contexto_gasto_padrao?: 'empresa' | 'pessoal'
  }
}

// Mapa para travar chamadas simultâneas idênticas e evitar cliques duplos no botão ou microfone
const pendingRequests = new Map<string, Promise<RespostaInterpretacao>>()

function normalizarChave(texto: string, contexto?: string): string {
  return `${contexto || 'geral'}:${texto.trim().toLowerCase().slice(0, 100)}`
}

/**
 * Cliente Centralizado de IA do OrçaFácil
 * Implementa:
 * - Autenticação obrigatória (impede chamadas deslogadas com erro 401 claro)
 * - Trava de chamadas concorrentes duplicadas (deduplicação em voo)
 * - Timeout configurável (default 30s) com AbortController
 * - Repetição com backoff exponencial para falhas de rede transitórias (502, 503, 504)
 * - Mensagens amigáveis em português
 */
export const aiInterpretarService = {
  async interpretar(
    params: InterpretarParams,
    options?: { timeoutMs?: number; retries?: number },
  ): Promise<RespostaInterpretacao> {
    const texto = (params.transcricao || '').trim()
    if (!texto) {
      throw new Error('Por favor, informe ou fale o que deseja para a inteligência artificial.')
    }

    if (!pb.authStore.isValid || !pb.authStore.token) {
      throw new Error('Sessão expirada ou não autenticado. Por favor, faça login para usar a IA.')
    }

    const chave = normalizarChave(texto, params.contexto)
    if (pendingRequests.has(chave)) {
      // Reutiliza a promessa em andamento em vez de abrir segunda requisição duplicada
      return pendingRequests.get(chave)!
    }

    const promessa = (async () => {
      const timeoutMs = options?.timeoutMs ?? 35000
      const maxRetries = options?.retries ?? 1

      let ultimaFalha: Error | null = null

      for (let tentativa = 0; tentativa <= maxRetries; tentativa++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        try {
          const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/interpretar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: pb.authStore.token,
            },
            body: JSON.stringify({
              transcricao: texto,
              contexto: params.contexto || 'orcamento',
              modo: params.modo || 'geral',
              userId: params.userId || pb.authStore.record?.id,
              preferencias: params.preferencias,
            }),
            signal: controller.signal,
          })

          clearTimeout(timer)

          if (res.status === 401) {
            throw new Error('Sua sessão expirou. Por favor, recarregue e entre novamente.')
          }

          if (res.status === 429) {
            throw new Error(
              'Muitas solicitações seguidas à IA. Aguarde alguns instantes e tente novamente.',
            )
          }

          if (res.status === 409) {
            throw new Error('Essa mesma solicitação já está em andamento. Aguarde o retorno.')
          }

          // Se for erro temporário de servidor (502/503/504) e tiver tentativas restantes, faz retry com backoff
          if (
            (res.status === 502 || res.status === 503 || res.status === 504) &&
            tentativa < maxRetries
          ) {
            await new Promise((r) => setTimeout(r, 1200 * (tentativa + 1)))
            continue
          }

          const data = await res.json().catch(() => null)

          if (!res.ok) {
            throw new Error(
              data?.error ||
                'A inteligência artificial demorou ou encontrou uma instabilidade. Tente novamente.',
            )
          }

          return data as RespostaInterpretacao
        } catch (err: unknown) {
          clearTimeout(timer)
          const erroObj = err as Error
          if (erroObj.name === 'AbortError') {
            ultimaFalha = new Error(
              'Tempo limite excedido ao consultar a inteligência artificial. Tente novamente.',
            )
          } else {
            ultimaFalha = erroObj
          }

          if (
            tentativa < maxRetries &&
            erroObj.name !== 'AbortError' &&
            !erroObj.message.includes('sessão')
          ) {
            await new Promise((r) => setTimeout(r, 1000 * (tentativa + 1)))
            continue
          }
          break
        }
      }

      throw (
        ultimaFalha ||
        new Error('Não foi possível se comunicar com o serviço de inteligência artificial.')
      )
    })()

    pendingRequests.set(chave, promessa)
    try {
      return await promessa
    } finally {
      pendingRequests.delete(chave)
    }
  },
}
