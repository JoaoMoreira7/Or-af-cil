/**
 * DADOS LEGAIS DA EMPRESA — ORÇAFÁCIL
 *
 * ATENÇÃO: Os dados abaixo são PLACEHOLDERS claramente identificados para testes
 * e demonstração do sistema. Edite este arquivo único antes de publicar ou colocar
 * o sistema em produção com a razão social, CNPJ, endereço e e-mails oficiais.
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
  razaoSocial: '[RAZÃO SOCIAL EXEMPLO LTDA - PLACEHOLDER]',
  nomeFantasia: 'OrçaFácil',
  cnpj: '00.000.000/0001-00 [CNPJ PLACEHOLDER]',
  endereco:
    'Avenida Exemplo de Negócios, nº 1000, Bloco B, Sala 500 — Bairro Comercial, São Paulo - SP, CEP 00000-000 [ENDEREÇO PLACEHOLDER]',
  comarca: 'Comarca da Capital do Estado de São Paulo [COMARCA PLACEHOLDER]',
  emailContato: 'contato@orcafacil-exemplo.com.br',
  emailSuporte: 'suporte@orcafacil-exemplo.com.br',
  emailJuridico: 'juridico@orcafacil-exemplo.com.br',
  responsavelLegal: '[NOME DO REPRESENTANTE LEGAL - PLACEHOLDER]',
}
