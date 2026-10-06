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

export type FormaPagamentoAssinatura = 'pix' | 'cartao' | 'boleto'
export type PagamentoStatus = 'pago' | 'pendente' | 'cancelado'

export interface PagamentoRegistro {
  id: string
  user_id: string
  valor: number
  forma_pagamento: FormaPagamentoAssinatura
  status: PagamentoStatus
  data_compra: string
  data_vencimento: string
  referencia_transacao: string
  plano_nome?: string
  metadados?: Record<string, unknown>
  created: string
  updated: string
  expand?: {
    user_id?: {
      id: string
      name?: string
      email?: string
      admin?: boolean
    }
  }
}

export interface VendasMetricas {
  totalVendido: number // quantidade de assinaturas vendidas
  ativosAgora: number // assinantes ativos
  canceladosOuExpirados: number // cancelados ou expirados
  receitaMensalAtual: number // ativos * 49.90
  receitaTotalAcumulada: number // soma dos pagamentos com status 'pago'
}

export type AudioContexto =
  | 'orcamento'
  | 'cliente'
  | 'comando_status'
  | 'desfazer'
  | 'gasto'
  | 'geral'

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
  | 'documento_orcamento'
  | 'documento_despesa'
  | 'registro_gasto'
export type AcaoVozStatus = 'ativo' | 'desfeito'

export type DocumentoTipo =
  | 'nota_fiscal'
  | 'recibo'
  | 'orcamento_papel'
  | 'lista_materiais'
  | 'comprovante'
  | 'outro'

export type DocumentoAcaoAplicada =
  | 'nenhuma'
  | 'orcamento_criado'
  | 'despesa_vinculada'
  | 'apenas_salvo'

export interface DocumentoItemExtraido {
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
}

export interface DocumentoDadosExtraidos {
  tipo_documento: DocumentoTipo
  fornecedor?: string
  data_documento?: string
  itens: DocumentoItemExtraido[]
  valor_total: number
  valor_impostos?: number
  observacoes?: string
  confianca?: 'alta' | 'media' | 'baixa'
}

export interface DocumentoLido {
  id: string
  user_id: string
  foto?: string
  tipo_documento: DocumentoTipo
  fornecedor?: string
  data_documento?: string
  valor_total?: number
  valor_impostos?: number
  dados_extraidos?: DocumentoDadosExtraidos
  acao_aplicada?: DocumentoAcaoAplicada
  orcamento_vinculado_id?: string
  orcamento_gerado_id?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    orcamento_vinculado_id?: Orçamento
    orcamento_gerado_id?: Orçamento
  }
}

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

export type CategoriaGasto =
  | 'Material'
  | 'Transporte'
  | 'Alimentação'
  | 'Moradia/Aluguel'
  | 'Ferramentas'
  | 'Serviços terceirizados'
  | 'Impostos/Taxas'
  | 'Outros'

export type OrigemGasto = 'voz' | 'manual' | 'documento'

export interface Gasto {
  id: string
  user_id: string
  descricao: string
  valor: number
  categoria: CategoriaGasto
  data: string
  origem: OrigemGasto
  orcamento_vinculado?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    orcamento_vinculado?: Orçamento
  }
}

export interface GastoExtraido {
  descricao: string
  valor: number | null
  categoria: CategoriaGasto
  data: string
  origem?: OrigemGasto
  orcamento_vinculado_id?: string | null
  orcamento_vinculado_numero?: string | null
  precisa_confirmacao?: boolean
  mensagem_resposta?: string
}

export interface ComandoConsultaGastosExtraido {
  total_mes: number
  qtd_gastos: number
  maior_categoria?: string | null
  valor_maior_categoria?: number
  mensagem_resposta: string
}

export interface ResumoSemanalMetricas {
  orcamentos_criados: number
  orcamentos_enviados: number
  orcamentos_aprovados: number
  valor_aprovado: number
  cobrancas_pagas: number
  valor_pago: number
  cobrancas_pendentes: number
  valor_pendente: number
  novos_clientes: number
  orcamentos_sem_resposta_5_dias: number
  total_gastos?: number
  qtd_gastos?: number
}

export interface ResumoSemanalData {
  sucesso: boolean
  resumo_texto: string
  metricas: ResumoSemanalMetricas
  preferencias_aplicadas?: {
    nome_preferido?: string
    tom_resposta?: TomRespostaIa
    usar_emojis?: boolean
  }
  gerado_em: string
  cache_chave?: string
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
