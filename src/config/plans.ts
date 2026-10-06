/**
 * CONFIGURAÇÃO CENTRAL DOS PLANOS — ORÇAFÁCIL
 *
 * Estrutura oficial da escada de 3 planos definida pelo usuário:
 * 1. Essencial (R$ 49,90/mês) — Entrada
 * 2. Profissional (R$ 64,90/mês) — Melhor custo-benefício (Mais escolhido)
 * 3. Premium (R$ 79,90/mês) — Completo
 *
 * Slogan oficial: "Feito para quem vive de serviço"
 */

export type PlanoId = 'essencial' | 'profissional' | 'premium'

export interface RecursoPlano {
  nome: string
  incluido: boolean
  destaque?: boolean
}

export interface PlanoConfig {
  id: PlanoId
  nome: string
  precoMensal: number
  precoFormatado: string
  precoMensalExtenso: string
  periodoMes: string
  posicionamento: 'Entrada' | 'Melhor custo-benefício' | 'Completo'
  badgeDestaque?: string // ex: "Mais escolhido" para o Profissional
  descricaoCurta: string
  recursos: string[]
  diasTrial: number
}

export const PLANOS_LISTA: PlanoConfig[] = [
  {
    id: 'essencial',
    nome: 'Essencial',
    precoMensal: 49.9,
    precoFormatado: 'R$ 49,90',
    precoMensalExtenso: 'R$ 49,90/mês',
    periodoMes: '/mês',
    posicionamento: 'Entrada',
    descricaoCurta: 'O núcleo completo para emitir propostas rápidas e organizar seus clientes.',
    recursos: [
      'Orçamentos e propostas básicas ilimitadas',
      'Cadastro completo de clientes com histórico',
      'Inteligência Artificial de voz para criação ágil',
      'Registro de gastos e despesas por comando de voz',
      'Dashboard financeiro e métricas essenciais',
      'Exportação em PDF pronta para impressão',
      'Pagamento via PIX Real Asaas com baixa instantânea',
    ],
    diasTrial: 7,
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    precoMensal: 64.9,
    precoFormatado: 'R$ 64,90',
    precoMensalExtenso: 'R$ 64,90/mês',
    periodoMes: '/mês',
    posicionamento: 'Melhor custo-benefício',
    badgeDestaque: 'Mais escolhido',
    descricaoCurta:
      'Tudo do Essencial com recursos avançados de campo, cobrança WhatsApp e resumo em áudio.',
    recursos: [
      'Tudo incluído no plano Essencial',
      'Assistente de Campo (leitura de fotos de notas, recibos e orçamentos em papel)',
      'Contas a Receber avançado com cobrança direta pelo WhatsApp',
      'Resumo semanal executivo gerado em áudio (podcast de 1 minuto)',
      'Geração de código PIX dinâmico para seus clientes com QR Code',
      'Acompanhamento de orçamentos pendentes há mais de 5 dias',
      'Suporte prioritário via WhatsApp',
    ],
    diasTrial: 7,
  },
  {
    id: 'premium',
    nome: 'Premium',
    precoMensal: 79.9,
    precoFormatado: 'R$ 79,90',
    precoMensalExtenso: 'R$ 79,90/mês',
    periodoMes: '/mês',
    posicionamento: 'Completo',
    badgeDestaque: 'Completo',
    descricaoCurta:
      'A experiência definitiva com relatórios executivos avançados e canal direto prioritário.',
    recursos: [
      'Tudo incluído no plano Profissional',
      'Exportação e relatórios contábeis/financeiros avançados (CSV/PDF detalhado)',
      'Selo e atendimento com Suporte Prioritário VIP',
      'Análise financeira consolidada por categoria de gasto e lucro real',
      'Prioridade no processamento de leitura de documentos pela IA',
      'Canal de suporte direto exclusivo com especialista OrçaFácil',
    ],
    diasTrial: 7,
  },
]

export const PLANOS_MAP: Record<PlanoId, PlanoConfig> = {
  essencial: PLANOS_LISTA[0],
  profissional: PLANOS_LISTA[1],
  premium: PLANOS_LISTA[2],
}

/**
 * Plano padrão/destaque para recomendações e fallback compatível
 */
export const PLANO_DESTAQUE = PLANOS_MAP.profissional
export const PLANO_ENTRADA = PLANOS_MAP.essencial
export const PLANO_CONFIG = PLANOS_MAP.essencial // Mantém retrocompatibilidade onde PLANO_CONFIG é importado

/**
 * Normaliza identificador de plano vindo do banco ('starter' legado ou novo)
 */
export function normalizarPlanoId(planoStr?: string | null): PlanoId {
  if (!planoStr) return 'essencial'
  const normalizado = planoStr.toLowerCase().trim()
  if (normalizado === 'starter' || normalizado === 'essencial') return 'essencial'
  if (normalizado === 'pro' || normalizado === 'profissional') return 'profissional'
  if (normalizado === 'premium') return 'premium'
  return 'essencial'
}

/**
 * Retorna o objeto PlanoConfig correspondente a qualquer string de plano
 */
export function obterConfigPlano(planoStr?: string | null): PlanoConfig {
  const id = normalizarPlanoId(planoStr)
  return PLANOS_MAP[id] || PLANOS_MAP.essencial
}

/**
 * Hierarquia de planos para verificação de permissão (gate)
 */
export const HIERARQUIA_PLANOS: Record<PlanoId, number> = {
  essencial: 1,
  profissional: 2,
  premium: 3,
}

/**
 * Verifica se um plano do usuário tem permissão para acessar um recurso de nível mínimo
 */
export function planoTemAcesso(
  planoUsuario: string | undefined | null,
  planoMinimo: PlanoId,
): boolean {
  const idUsuario = normalizarPlanoId(planoUsuario)
  const nivelUsuario = HIERARQUIA_PLANOS[idUsuario] || 1
  const nivelMinimo = HIERARQUIA_PLANOS[planoMinimo]
  return nivelUsuario >= nivelMinimo
}
