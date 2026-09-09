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

export interface PlanoAssinatura {
  id: string
  user_id: string
  plano: 'starter' | 'pro'
  status: 'ativo' | 'inativo'
  renovacao_em?: string
  created: string
  updated: string
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
