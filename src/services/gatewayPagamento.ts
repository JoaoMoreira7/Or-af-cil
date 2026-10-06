/**
 * SERVIÇO DE GATEWAY DE PAGAMENTO — ORÇAFÁCIL
 *
 * PONTO CENTRAL DE PROCESSAMENTO DE COBRANÇAS E ASSINATURAS DO SISTEMA.
 *
 * Integração oficial em PRODUÇÃO com o gateway ASAAS para os 3 PLANOS:
 * - Essencial: R$ 49,90/mês
 * - Profissional: R$ 64,90/mês
 * - Premium: R$ 79,90/mês
 *
 * - PIX Dinâmico com geração automática de Customer, Cobrança por plano, QR Code Base64 e Copia-e-Cola
 * - Webhook idempotente para confirmação automática de pagamentos e liberação imediata do acesso
 * - Envio de e-mail de comprovante de pagamento ao cliente e notificação ao dono (jaocarloss@gmail.com)
 * - Suporte a fallback de simulação e ferramentas administrativas completas com filtros por plano
 */

import pb from '@/lib/pocketbase/client'
import { PlanoId, obterConfigPlano, normalizarPlanoId } from '@/config/plans'
import {
  FormaPagamentoAssinatura,
  PagamentoRegistro,
  PagamentoStatus,
  VendasMetricas,
} from '@/types'

export type ModoGateway = 'simulado' | 'real'

export interface ProcessarAssinaturaParams {
  userId: string
  planoId?: PlanoId | string
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
  plano_id?: PlanoId
  plano_nome?: string
  asaas_id?: string
  pix_copia_cola?: string
  pix_qr_code_base64?: string
  invoice_url?: string
}

export interface ResultadoCriacaoPixAsaas {
  sucesso: boolean
  pagamento_id: string
  plano_id?: PlanoId
  plano_nome?: string
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
   * Cria o cliente na Asaas, a cobrança do plano escolhido (49,90 / 64,90 / 79,90),
   * busca o QR Code e grava o pagamento como 'pendente'.
   */
  async criarPixAsaas(params?: {
    planoId?: PlanoId | string
    cpfCnpj?: string
    telefone?: string
  }): Promise<ResultadoCriacaoPixAsaas> {
    try {
      const planoEscolhido = normalizarPlanoId(params?.planoId)
      const res = await pb.send<ResultadoCriacaoPixAsaas>('/backend/v1/asaas/criar-pix', {
        method: 'POST',
        body: {
          plano: planoEscolhido,
          plano_id: planoEscolhido,
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
   * Processa a contratação/renovação de uma assinatura do plano escolhido
   * (Essencial R$ 49,90, Profissional R$ 64,90, Premium R$ 79,90)
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

    const planoId = normalizarPlanoId(params.planoId)
    const configPlano = obterConfigPlano(planoId)

    const agora = new Date()
    const dataVencimento = new Date(agora)
    dataVencimento.setDate(dataVencimento.getDate() + 30)

    const referencia = this.gerarReferenciaTransacao(formaPagamento)
    const valor = configPlano.precoMensal

    // SE MODO REAL E FORMA PIX: usa endpoint Asaas passando o plano
    if (this.modo === 'real' && formaPagamento === 'pix') {
      const asaasRes = await this.criarPixAsaas({ planoId })
      const pagRecord = await pb
        .collection('pagamentos')
        .getOne<PagamentoRegistro>(asaasRes.pagamento_id)

      return {
        sucesso: true,
        pagamento: pagRecord,
        mensagem: `Cobrança PIX do plano ${configPlano.nome} gerada com sucesso via Asaas! Realize o pagamento pelo seu app bancário.`,
        referencia: asaasRes.referencia,
        plano_id: planoId,
        plano_nome: configPlano.nome,
        asaas_id: asaasRes.asaas_id,
        pix_copia_cola: asaasRes.pix_copia_cola,
        pix_qr_code_base64: asaasRes.pix_qr_code_base64,
        invoice_url: asaasRes.invoice_url,
      }
    }

    // MODO SIMULADO OU CARTÃO/BOLETO DE TESTE
    const metadados: Record<string, unknown> = {
      modo: this.modo,
      plano_id: planoId,
      plano_nome: configPlano.nome,
      valor_formatado: configPlano.precoFormatado,
      processado_em: agora.toISOString(),
      gateway_provedor:
        this.modo === 'simulado' ? 'Simulação Homologada OrçaFácil' : 'Asaas Gateway (Simulado)',
    }

    if (formaPagamento === 'cartao' && dadosCartao) {
      metadados.cartao_titular = dadosCartao.nomeTitular
      metadados.cartao_final = dadosCartao.numeroMascarado
    }

    // 1. Grava na coleção 'pagamentos' com o plano e valor corretos
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
        plano_nome: configPlano.nome,
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

    // 2. Atualiza ou cria a assinatura do usuário na coleção 'planos' com o novo plano
    try {
      const planosExistentes = await pb.collection('planos').getList(1, 1, {
        filter: `user_id = "${userId}"`,
      })

      if (planosExistentes.items.length > 0) {
        await pb.collection('planos').update(planosExistentes.items[0].id, {
          plano: planoId,
          status: 'ativo',
          renovacao_em: dataVencimento.toISOString(),
        })
      } else {
        await pb.collection('planos').create({
          user_id: userId,
          plano: planoId,
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
      mensagem: `Assinatura ${configPlano.nome} (${configPlano.precoMensalExtenso}) ativada com sucesso via ${labelForma}!`,
      referencia,
      plano_id: planoId,
      plano_nome: configPlano.nome,
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
   * Recalcula métricas por plano e MRR real ponderado.
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

      // 2. Busca planos para consolidar assinantes ativos reais no momento e calcular MRR exato por plano
      const planosRes = await pb.collection('planos').getList(1, 500)

      let assinantesAtivos = 0
      let canceladosOuExpirados = 0
      let receitaMensalAtual = 0
      const agora = Date.now()

      const vendasPorPlano = {
        essencial: 0,
        profissional: 0,
        premium: 0,
      }

      for (const p of planosRes.items) {
        const idPlano = normalizarPlanoId(p.plano)
        const configPlano = obterConfigPlano(idPlano)

        if (p.status === 'ativo') {
          assinantesAtivos++
          receitaMensalAtual += configPlano.precoMensal
          vendasPorPlano[idPlano] = (vendasPorPlano[idPlano] || 0) + 1
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

      const metricas: VendasMetricas = {
        totalVendido,
        ativosAgora: assinantesAtivos,
        canceladosOuExpirados,
        receitaMensalAtual: Number(receitaMensalAtual.toFixed(2)),
        receitaTotalAcumulada: Number(receitaTotalAcumulada.toFixed(2)),
        vendasPorPlano,
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

    if (atualizado.user_id) {
      try {
        const planos = await pb.collection('planos').getList(1, 1, {
          filter: `user_id = "${atualizado.user_id}"`,
        })

        const metaPag = (atualizado.metadados as Record<string, unknown> | null) || {}
        const planoParaSetar = normalizarPlanoId(
          String(metaPag.plano_id || atualizado.plano_nome || ''),
        )

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
              plano: planoParaSetar,
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
    planoId: PlanoId = 'essencial',
  ): Promise<void> {
    const planos = await pb.collection('planos').getList(1, 1, {
      filter: `user_id = "${userId}"`,
    })

    if (planos.items.length > 0) {
      const pId = planos.items[0].id
      if (novoStatus === 'ativo') {
        const renovacao = new Date()
        renovacao.setDate(renovacao.getDate() + 30)
        await pb.collection('planos').update(pId, {
          plano: planoId,
          status: 'ativo',
          renovacao_em: renovacao.toISOString(),
        })
      } else {
        await pb.collection('planos').update(pId, {
          status: 'expirado',
        })
      }
    } else {
      const renovacao = new Date()
      renovacao.setDate(renovacao.getDate() + 30)
      await pb.collection('planos').create({
        user_id: userId,
        plano: planoId,
        status: novoStatus,
        renovacao_em: novoStatus === 'ativo' ? renovacao.toISOString() : undefined,
      })
    }
  },

  /**
   * Consulta o status seguro do gateway Asaas (somente admin jaocarloss@gmail.com).
   */
  async obterStatusGateway(): Promise<{
    sucesso: boolean
    gateway: string
    chave_configurada: boolean
    chave_mascarada: string
    chave_origem: string
    ambiente: 'producao' | 'sandbox'
    ultima_verificacao?: string
    status_verificacao?: string
    detalhes_conta?: {
      nome_empresa?: string
      email?: string
      cpf_cnpj?: string
      ultima_checagem?: string
    } | null
    webhook: {
      url: string
      token_configurado: boolean
      token_mascarado: string
      token_origem: string
      eventos_obrigatorios: string[]
    }
  }> {
    return await pb.send('/backend/v1/admin/gateway/status', {
      method: 'GET',
    })
  },

  /**
   * Testa a validade da chave Asaas em tempo real contra a API da Asaas.
   */
  async testarConexaoGateway(apiKeyCustom?: string): Promise<{
    sucesso: boolean
    conectado: boolean
    status_code?: number
    chave_mascarada?: string
    mensagem: string
    conta?: {
      nome: string
      email: string
      cpf_cnpj: string
      verificado_em: string
    }
    detalhes?: unknown
  }> {
    return await pb.send('/backend/v1/admin/gateway/testar', {
      method: 'POST',
      body: apiKeyCustom ? { api_key: apiKeyCustom } : {},
    })
  },

  /**
   * Salva com segurança uma nova chave Asaas no cofre do sistema (nunca exposta no front).
   */
  async salvarChaveGateway(
    apiKey: string,
    testarAntes: boolean = true,
  ): Promise<{
    sucesso: boolean
    mensagem: string
    chave_mascarada: string
    atualizado_em: string
    conta?: {
      nome: string
      email: string
    } | null
  }> {
    return await pb.send('/backend/v1/admin/gateway/salvar-chave', {
      method: 'POST',
      body: {
        api_key: apiKey,
        testar: testarAntes,
      },
    })
  },

  /**
   * Revela o token do Webhook Asaas para o dono logado (jaocarloss@gmail.com).
   */
  async revelarTokenWebhook(): Promise<{
    sucesso: boolean
    token: string
    token_mascarado: string
    origem: string
  }> {
    return await pb.send('/backend/v1/admin/gateway/revelar-webhook-token', {
      method: 'POST',
    })
  },

  /**
   * Regenera o token do Webhook Asaas e retorna uma única vez para cópia.
   */
  async regenerarTokenWebhook(): Promise<{
    sucesso: boolean
    novo_token: string
    token_mascarado: string
    webhook_url: string
    gerado_em: string
    mensagem: string
  }> {
    return await pb.send('/backend/v1/admin/gateway/regenerar-webhook-token', {
      method: 'POST',
    })
  },
}
