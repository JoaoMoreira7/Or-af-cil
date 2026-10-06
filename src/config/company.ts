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
  telefone?: string
  dataInscricao?: string
}

export const COMPANY_LEGAL: CompanyLegalData = {
  razaoSocial: 'QUEVRON TECNOLOGIA INOVA SIMPLES (I.S.)',
  nomeFantasia: 'OrçaFácil',
  cnpj: '69.482.315/0001-19',
  endereco: 'R. Mogi Mirim, SN — CH São José, Bela Vista — Águas de Lindoia/SP, CEP 13.942-190',
  comarca: '[A PREENCHER]',
  emailContato: 'jaocarloss@gmail.com',
  emailSuporte: 'jaocarloss@gmail.com',
  emailJuridico: 'jaocarloss@gmail.com',
  responsavelLegal: '[A PREENCHER]',
  telefone: '(35) 8846-1481 / (43) 9130-1481',
  dataInscricao: '05/10/2026',
}
