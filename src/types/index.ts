export interface Cliente {
  id: string
  nome: string
  email: string
  telefone?: string
  empresa?: string
  endereco?: string
  user_id: string
  created: string
  updated: string
}

export interface OrçamentoItem {
  descricao: string
  quantidade: number
  valor_unitario: number
}

export type OrçamentoStatus = 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado' | 'cancelado'

export interface Orçamento {
  id: string
  numero: string
  cliente_id: string
  descricao: string
  itens: OrçamentoItem[]
  impostos: number
  subtotal: number
  valor_total: number
  status: OrçamentoStatus
  user_id: string
  created: string
  updated: string
  expand?: {
    cliente_id?: Cliente
  }
}

export type PlanoStatus = 'trial' | 'ativo' | 'expirado' | 'inativo'

export interface PlanoAssinatura {
  id: string
  user_id: string
  plano: 'starter' | 'pro'
  status: PlanoStatus
  trial_ate?: string
  renovacao_em?: string
  aviso_teste_enviado?: boolean
  created: string
  updated: string
}

export interface UsuarioAssinanteAdmin {
  id: string
  name: string
  email: string
  admin: boolean
  planoStatus: PlanoStatus
  planoNome: string
  trialAte?: string
  renovacaoEm?: string
  diasRestantesTrial?: number
  created: string
}

export interface AdminMetricas {
  totalUsuarios: number
  totalEmTrial: number
  totalAtivos: number
  totalExpirados: number
  receitaMensalEstimada: number
}

export type AudioContexto = 'orcamento' | 'cliente' | 'comando_status' | 'desfazer' | 'geral'

export interface ComandoStatusExtraido {
  orcamento_id?: string | null
  orcamento_numero?: string | null
  cliente_nome?: string | null
  status_anterior?: string | null
  novo_status: OrçamentoStatus | null
  mensagem_confirmacao: string
}

export interface AudioRegistro {
  id: string
  user_id: string
  transcricao_bruta: string
  transcricao_corrigida?: string
  contexto: AudioContexto
  resultado_json?: Record<string, unknown>
  confianca?: 'alta' | 'media' | 'baixa'
  comando_executado?: boolean
  created: string
  updated: string
}

export type AcaoVozTipo =
  | 'criacao_cliente'
  | 'criacao_orcamento'
  | 'mudanca_status'
  | 'gerar_cobranca'
  | 'baixa_pagamento'
  | 'atualizar_preferencias_ia'
export type AcaoVozStatus = 'ativo' | 'desfeito'

export interface AcaoVozRegistro {
  id: string
  user_id: string
  tipo_acao: AcaoVozTipo
  titulo: string
  descricao_resumo?: string
  registro_id?: string
  dados_aplicados: Record<string, unknown>
  status: AcaoVozStatus
  desfeito_em?: string
  created: string
  updated: string
}

export type CobrancaStatus = 'pendente' | 'pago'

export interface Cobranca {
  id: string
  user_id: string
  orcamento_id: string
  cliente_id?: string
  cliente_nome: string
  orcamento_numero: string
  valor: number
  status: CobrancaStatus
  codigo_pix?: string
  pago_em?: string
  created: string
  updated: string
  expand?: {
    orcamento_id?: Orçamento
    cliente_id?: Cliente
  }
}

export type TomRespostaIa = 'formal' | 'amigavel' | 'direto'

export interface PreferenciasIa {
  id?: string
  user_id: string
  nome_preferido?: string
  tom_resposta: TomRespostaIa
  usar_emojis: boolean
  created?: string
  updated?: string
}

export interface ComandoGerarCobrancaExtraido {
  orcamento_id: string
  orcamento_numero: string
  cliente_id?: string
  cliente_nome: string
  valor: number
  mensagem_confirmacao: string
}

export interface ComandoBaixaExtraido {
  orcamento_id: string
  orcamento_numero: string
  cliente_nome?: string
  cobranca_id?: string | null
  valor: number
  mensagem_confirmacao: string
}

export interface ComandoPersonalizarIaExtraido {
  nome_preferido?: string
  tom_resposta?: TomRespostaIa
  usar_emojis?: boolean
  mensagem_confirmacao: string
}

export interface ComandoConsultaDevedoresExtraido {
  total_devido: number
  qtd_orcamentos_pendentes: number
  mensagem_resposta: string
}

export function formatarMoedaBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0)
}

export function formatarData(dataIso: string): string {
  if (!dataIso) return '-'
  try {
    const data = new Date(dataIso)
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(data)
  } catch {
    return dataIso
  }
}

export function formatarDataHora(dataIso: string): string {
  if (!dataIso) return '-'
  try {
    const data = new Date(dataIso)
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(data)
  } catch {
    return dataIso
  }
}
