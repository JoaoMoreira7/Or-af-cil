import pb from '@/lib/pocketbase/client'
import { OrçamentoItem } from '@/types'

export interface ClienteNovoExtraido {
  nome?: string | null
  telefone?: string | null
  email?: string | null
  empresa?: string | null
  endereco?: string | null
}

import { ComandoStatusExtraido, AudioContexto } from '@/types'

import {
  ComandoGerarCobrancaExtraido,
  ComandoBaixaExtraido,
  ComandoPersonalizarIaExtraido,
  ComandoConsultaDevedoresExtraido,
  GastoExtraido,
  ComandoConsultaGastosExtraido,
} from '@/types'

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
  comando_desfazer?: boolean
  transcricao_corrigida: string
  descricao_servico?: string
  cliente_sugerido_id?: string | null
  cliente_sugerido_nome?: string | null
  cliente_novo?: ClienteNovoExtraido | null
  gasto_extraido?: GastoExtraido | null
  comando_consulta_gastos?: ComandoConsultaGastosExtraido | null
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

export const aiInterpretarService = {
  async interpretar(params: {
    transcricao: string
    contexto?: AudioContexto
    userId?: string
    preferencias?: {
      nome_preferido?: string
      tom_resposta?: string
      usar_emojis?: boolean
    }
  }): Promise<RespostaInterpretacao> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/interpretar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({
        transcricao: params.transcricao,
        contexto: params.contexto || 'orcamento',
        userId: params.userId || pb.authStore.record?.id,
        preferencias: params.preferencias,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Falha ao interpretar áudio com IA')
    }

    return data
  },
}
