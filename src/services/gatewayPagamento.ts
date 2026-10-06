/**
 * SERVIÇO DE GATEWAY DE PAGAMENTO — ORÇAFÁCIL
 *
 * PONTO CENTRAL DE PROCESSAMENTO DE COBRANÇAS E ASSINATURAS DO SISTEMA.
 *
 * Integração oficial em PRODUÇÃO com o gateway ASAAS:
 * - PIX Dinâmico com geração automática de Customer, Cobrança, QR Code Base64 e Copia-e-Cola
 * - Webhook idempotente para confirmação automática de pagamentos e liberação imediata do acesso
 * - Envio de e-mail de comprovante de pagamento ao cliente e notificação ao dono (jaocarloss@gmail.com)
 * - Suporte a fallback de simulação e ferramentas administrativas completas
 */

import pb from '@/lib/pocketbase/client'
import { PLANO_CONFIG } from '@/config/plans'
import {
  FormaPagamentoAssinatura,
  PagamentoRegistro,
  PagamentoStatus,
  VendasMetricas,
} from '@/types'

export type ModoGateway = 'simulado' | 'real'

export interface ProcessarAssinaturaParams {
  userId: string
  formaPagamento: FormaPagamentoAssinatura
  dadosCartao?: {
    nomeTitular: string
    numeroMascarado: string
    validade: string
  }
}

export interface ResultadoProcessamentoAssinatura {
  sucesso: boolean
  pagamento: PagamentoRegistro
  mensagem: string
  referencia: string
  asaas_id?: string
  pix_copia_cola?: string
  pix_qr_code_base64?: string
  invoice_url?: string
}

export interface ResultadoCriacaoPixAsaas {
  sucesso: boolean
  pagamento_id: string
  asaas_id: string
  asaas_customer_id: string
  referencia: string
  valor: number
  status: string
  pix_copia_cola: string
  pix_qr_code_base64: string
  invoice_url: string
  vencimento_pix: string
  expiracao_qr?: string
  mensagem: string
}

export interface ResultadoConsultaCobrancaAsaas {
  sucesso: boolean
  cobranca: {
    id: string
    status: string
    value: number
    netValue?: number
    dueDate?: string
    paymentDate?: string
    clientPaymentDate?: string
    billingType?: string
    invoiceUrl?: string
    transactionReceiptUrl?: string
    [key: string]: unknown
  }
  status_local?: PagamentoStatus | null
}

export const gatewayPagamentoService = {
  /**
   * Modo do gateway: 'real' conecta ao Asaas em produção.
   */
  modo: 'real' as ModoGateway,

  /**
   * Gera uma referência única para a transação.
   */
  gerarReferenciaTransacao(forma: FormaPagamentoAssinatura): string {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    const prefixo = forma.toUpperCase()
    return `OF-${prefixo}-${timestamp}-${random}`
  },

  /**
   * Cria uma cobrança PIX real na Asaas através do endpoint de backend seguro em pb_hooks.
   * Cria o cliente na Asaas, a cobrança de R$ 49,90, busca o QR Code e grava o pagamento como 'pendente'.
   */
  async criarPixAsaas(params?: {
    cpfCnpj?: string
    telefone?: string
  }): Promise<ResultadoCriacaoPixAsaas> {
    try {
      const res = await pb.send<ResultadoCriacaoPixAsaas>('/backend/v1/asaas/criar-pix', {
        method: 'POST',
        body: {
          cpfCnpj: params?.cpfCnpj,
          telefone: params?.telefone,
        },
      })
      return res
    } catch (err: unknown) {
      console.error('[gatewayPagamentoService] Erro ao criar cobrança PIX no Asaas:', err)
      const errorMsg =
        (err as { data?: { error?: string } })?.data?.error ||
        (err instanceof Error ? err.message : 'Falha ao conectar ao Asaas')
      throw new Error(errorMsg)
    }
  },

  /**
   * Consulta o status atual de uma cobrança na Asaas e sincroniza o banco local.
   */
  async consultarCobrancaAsaas(asaasPaymentId: string): Promise<ResultadoConsultaCobrancaAsaas> {
    try {
      const res = await pb.send<ResultadoConsultaCobrancaAsaas>(
        `/backend/v1/asaas/cobranca/${asaasPaymentId}`,
        {
          method: 'GET',
        },
      )
      return res
    } catch (err: unknown) {
      console.error('[gatewayPagamentoService] Erro ao consultar cobrança Asaas:', err)
      throw err
    }
  },

  /**
   * Cancela uma cobrança diretamente na API Asaas (exclusivo para o dono).
   */
  async cancelarCobrancaAsaas(
    asaasPaymentId: string,
  ): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      const res = await pb.send<{ sucesso: boolean; mensagem: string }>(
        `/backend/v1/asaas/cancelar-cobranca/${asaasPaymentId}`,
        {
          method: 'POST',
        },
      )
      return res
    } catch (err: unknown) {
      console.error('[gatewayPagamentoService] Erro ao cancelar cobrança Asaas:', err)
      const errorMsg =
        (err as { data?: { error?: string } })?.data?.error ||
        (err instanceof Error ? err.message : 'Falha ao cancelar cobrança na Asaas')
      throw new Error(errorMsg)
    }
  },

  /**
   * Processa a contratação/renovação de uma assinatura do plano Starter (R$ 49,90)
   *
   * Para PIX no modo real: chama a API Asaas e retorna os dados reais de QR Code.
   * Para Cartão / Boleto ou modo simulado: executa o registro correspondente.
   */
  async processarAssinatura(
    params: ProcessarAssinaturaParams,
  ): Promise<ResultadoProcessamentoAssinatura> {
    const { userId, formaPagamento, dadosCartao } = params
    if (!userId) {
      throw new Error('Identificação do usuário não fornecida para processamento.')
    }

    const agora = new Date()
    const dataVencimento = new Date(agora)
    dataVencimento.setDate(dataVencimento.getDate() + 30)

    const referencia = this.gerarReferenciaTransacao(formaPagamento)
    const valor = PLANO_CONFIG.precoMensal

    // SE MODO REAL E FORMA PIX: usa endpoint Asaas
    if (this.modo === 'real' && formaPagamento === 'pix') {
      const asaasRes = await this.criarPixAsaas()
      const pagRecord = await pb
        .collection('pagamentos')
        .getOne<PagamentoRegistro>(asaasRes.pagamento_id)

      return {
        sucesso: true,
        pagamento: pagRecord,
        mensagem:
          'Cobrança PIX gerada com sucesso via Asaas! Realize o pagamento pelo seu app bancário.',
        referencia: asaasRes.referencia,
        asaas_id: asaasRes.asaas_id,
        pix_copia_cola: asaasRes.pix_copia_cola,
        pix_qr_code_base64: asaasRes.pix_qr_code_base64,
        invoice_url: asaasRes.invoice_url,
      }
    }

    // MODO SIMULADO OU CARTÃO/BOLETO DE TESTE
    const metadados: Record<string, unknown> = {
      modo: this.modo,
      plano_id: PLANO_CONFIG.id,
      valor_formatado: PLANO_CONFIG.precoFormatado,
      processado_em: agora.toISOString(),
      gateway_provedor:
        this.modo === 'simulado' ? 'Simulação Homologada OrçaFácil' : 'Asaas Gateway (Simulado)',
    }

    if (formaPagamento === 'cartao' && dadosCartao) {
      metadados.cartao_titular = dadosCartao.nomeTitular
      metadados.cartao_final = dadosCartao.numeroMascarado
    }

    // 1. Grava na coleção 'pagamentos'
    let pagamentoCriado: PagamentoRegistro
    try {
      pagamentoCriado = await pb.collection('pagamentos').create<PagamentoRegistro>({
        user_id: userId,
        valor,
        forma_pagamento: formaPagamento,
        status: 'pago',
        data_compra: agora.toISOString(),
        data_vencimento: dataVencimento.toISOString(),
        referencia_transacao: referencia,
        plano_nome: PLANO_CONFIG.nome,
        pago_em: agora.toISOString(),
        metadados,
      })
    } catch (err: unknown) {
      console.error('Erro ao gravar pagamento na coleção pagamentos:', err)
      throw new Error(
        'Falha ao registrar comprovante de pagamento no sistema. Detalhes: ' +
          (err instanceof Error ? err.message : String(err)),
      )
    }

    // 2. Atualiza ou cria a assinatura do usuário na coleção 'planos'
    try {
      const planosExistentes = await pb.collection('planos').getList(1, 1, {
        filter: `user_id = "${userId}"`,
      })

      if (planosExistentes.items.length > 0) {
        await pb.collection('planos').update(planosExistentes.items[0].id, {
          plano: 'starter',
          status: 'ativo',
          renovacao_em: dataVencimento.toISOString(),
        })
      } else {
        await pb.collection('planos').create({
          user_id: userId,
          plano: 'starter',
          status: 'ativo',
          renovacao_em: dataVencimento.toISOString(),
        })
      }
    } catch (err: unknown) {
      console.error('Erro ao ativar plano do usuário após pagamento:', err)
    }

    const labelForma =
      formaPagamento === 'pix'
        ? 'PIX'
        : formaPagamento === 'cartao'
          ? 'Cartão de Crédito'
          : 'Boleto Bancário'

    return {
      sucesso: true,
      pagamento: pagamentoCriado,
      mensagem: `Assinatura ${PLANO_CONFIG.nome} ativada com sucesso via ${labelForma}!`,
      referencia,
    }
  },

  /**
   * Lista os pagamentos do usuário atual (dono de sua própria conta).
   */
  async listarMeusPagamentos(userId: string): Promise<PagamentoRegistro[]> {
    try {
      const res = await pb.collection('pagamentos').getList<PagamentoRegistro>(1, 100, {
        filter: `user_id = "${userId}"`,
        sort: '-data_compra',
      })
      return res.items
    } catch (err) {
      console.error('Erro ao listar pagamentos do usuário:', err)
      return []
    }
  },

  /**
   * Lista todas as vendas da plataforma para o painel exclusivo do dono.
   * Inclui expand dos dados do usuário (nome, e-mail).
   */
  async listarTodasVendasAdmin(): Promise<{
    metricas: VendasMetricas
    vendas: PagamentoRegistro[]
  }> {
    try {
      // 1. Busca todos os pagamentos
      const pagamentosRes = await pb.collection('pagamentos').getList<PagamentoRegistro>(1, 500, {
        sort: '-data_compra',
        expand: 'user_id',
      })

      // 2. Busca planos para consolidar assinantes ativos reais no momento
      const planosRes = await pb.collection('planos').getList(1, 500)

      let assinantesAtivos = 0
      let canceladosOuExpirados = 0
      const agora = Date.now()

      for (const p of planosRes.items) {
        if (p.status === 'ativo') {
          assinantesAtivos++
        } else if (p.status === 'expirado' || p.status === 'inativo') {
          canceladosOuExpirados++
        } else if (p.status === 'trial' && p.trial_ate) {
          const diff = new Date(p.trial_ate).getTime() - agora
          if (diff <= 0) {
            canceladosOuExpirados++
          }
        }
      }

      // 3. Calcula receita acumulada a partir dos pagamentos 'pago'
      let receitaTotalAcumulada = 0
      let totalVendido = 0

      for (const pag of pagamentosRes.items) {
        if (pag.status === 'pago') {
          receitaTotalAcumulada += pag.valor || 0
          totalVendido++
        }
      }

      const receitaMensalAtual = assinantesAtivos * PLANO_CONFIG.precoMensal

      const metricas: VendasMetricas = {
        totalVendido,
        ativosAgora: assinantesAtivos,
        canceladosOuExpirados,
        receitaMensalAtual,
        receitaTotalAcumulada,
      }

      return {
        metricas,
        vendas: pagamentosRes.items,
      }
    } catch (err: unknown) {
      console.error('Erro ao listar vendas administrativas:', err)
      throw err
    }
  },

  /**
   * Altera manualmente o status de uma venda e atualiza o acesso da assinatura correspondente.
   * Usado pelo dono (jaocarloss@gmail.com).
   */
  async alterarStatusVendaManual(
    pagamentoId: string,
    novoStatus: PagamentoStatus,
  ): Promise<PagamentoRegistro> {
    const atualizado = await pb.collection('pagamentos').update<PagamentoRegistro>(pagamentoId, {
      status: novoStatus,
      pago_em: novoStatus === 'pago' ? new Date().toISOString() : undefined,
    })

    // Sincroniza o plano do usuário correspondente
    if (atualizado.user_id) {
      try {
        const planos = await pb.collection('planos').getList(1, 1, {
          filter: `user_id = "${atualizado.user_id}"`,
        })

        if (planos.items.length > 0) {
          const planoId = planos.items[0].id
          if (novoStatus === 'cancelado') {
            await pb.collection('planos').update(planoId, {
              status: 'expirado',
            })
          } else if (novoStatus === 'pago') {
            const renovacao = new Date()
            renovacao.setDate(renovacao.getDate() + 30)
            await pb.collection('planos').update(planoId, {
              status: 'ativo',
              renovacao_em: renovacao.toISOString(),
            })
          }
        }
      } catch (err) {
        console.error('Erro ao sincronizar status do plano após alteração manual da venda:', err)
      }
    }

    return atualizado
  },

  /**
   * Altera diretamente o status de acesso de uma assinatura (cancelamento ou reativação imediata)
   * pelo ID do usuário.
   */
  async alterarAcessoUsuarioManual(
    userId: string,
    novoStatus: 'ativo' | 'expirado',
  ): Promise<void> {
    const planos = await pb.collection('planos').getList(1, 1, {
      filter: `user_id = "${userId}"`,
    })

    if (planos.items.length > 0) {
      const planoId = planos.items[0].id
      if (novoStatus === 'ativo') {
        const renovacao = new Date()
        renovacao.setDate(renovacao.getDate() + 30)
        await pb.collection('planos').update(planoId, {
          status: 'ativo',
          renovacao_em: renovacao.toISOString(),
        })
      } else {
        await pb.collection('planos').update(planoId, {
          status: 'expirado',
        })
      }
    } else {
      const renovacao = new Date()
      renovacao.setDate(renovacao.getDate() + 30)
      await pb.collection('planos').create({
        user_id: userId,
        plano: 'starter',
        status: novoStatus,
        renovacao_em: novoStatus === 'ativo' ? renovacao.toISOString() : undefined,
      })
    }
  },
}
