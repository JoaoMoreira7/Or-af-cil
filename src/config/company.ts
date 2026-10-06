/**
 * DADOS LEGAIS DA EMPRESA — ORÇAFÁCIL
 *
 * Qualquer alteração feita aqui reflete automaticamente nos Termos de Uso,
 * na Política de Privacidade e nos cabeçalhos de impressão de orçamentos.
 */

export interface CompanyLegalData {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  endereco: string
  comarca: string
  emailContato: string
  emailSuporte: string
  emailJuridico: string
  responsavelLegal: string
}

export const COMPANY_LEGAL: CompanyLegalData = {
  razaoSocial: 'QUEVRON TECNOLOGIA INOVA SIMPLES (I.S.)',
  nomeFantasia: 'OrçaFácil',
  cnpj: '69.482.315/0001-19',
  endereco: '[A PREENCHER]',
  comarca: '[A PREENCHER]',
  emailContato: '[A PREENCHER]',
  emailSuporte: '[A PREENCHER]',
  emailJuridico: '[A PREENCHER]',
  responsavelLegal: '[A PREENCHER]',
}
