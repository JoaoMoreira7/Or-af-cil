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

export interface InterpretacaoResultado {
  intencao_detectada?: 'orcamento' | 'cliente' | 'comando_status' | 'desfazer'
  comando_desfazer?: boolean
  transcricao_corrigida: string
  descricao_servico?: string
  cliente_sugerido_id?: string | null
  cliente_sugerido_nome?: string | null
  cliente_novo?: ClienteNovoExtraido | null
  itens: OrçamentoItem[]
  prazo?: string | null
  observacoes?: string | null
  comando_status?: ComandoStatusExtraido | null
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
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Falha ao interpretar áudio com IA')
    }

    return data
  },
}
