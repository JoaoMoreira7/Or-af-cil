/**
 * CONFIGURAÇÃO DO PLANO ÚNICO — ORÇAFÁCIL
 *
 * Centraliza os dados de precificação e nomenclatura do plano único da plataforma
 * para garantir consistência em telas, cobranças, notificações e relatórios administrativos.
 */

export interface PlanoConfig {
  id: 'starter'
  nome: string
  precoMensal: number
  precoFormatado: string
  precoMensalExtenso: string
  periodoMes: string
  diasTrial: number
}

export const PLANO_CONFIG: PlanoConfig = {
  id: 'starter',
  nome: 'Starter',
  precoMensal: 49.9,
  precoFormatado: 'R$ 49,90',
  precoMensalExtenso: 'R$ 49,90/mês',
  periodoMes: '/mês',
  diasTrial: 7,
}
