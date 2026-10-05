/**
 * SERVIÇO DE GATEWAY DE PAGAMENTO — ORÇAFÁCIL
 *
 * PONTO ÚNICO DE PROCESSAMENTO DE COBRANÇAS E ASSINATURAS DO SISTEMA.
 *
 * ============================================================================
 * [GATEWAY REAL: conectar credenciais Mercado Pago/Stripe aqui]
 *
 * Para migrar do modo simulado atual para um gateway real (Mercado Pago, Stripe,
 * Asaas, PagBank, etc.), altere a flag `MODO_GATEWAY` para 'real' e implemente as
 * chamadas de API nas funções correspondentes abaixo (gerarQrCodePixReal,
 * processarCartaoReal, gerarBoletoReal). Toda a camada visual de telas (Planos,
 * Paywall, Painel de Vendas e Admin) consome exclusivamente este service.
 * ============================================================================
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
    numeroMascarado: string // Ex: **** **** **** 1234 (nunca gravar número completo)
    validade: string
  }
}

export interface ResultadoProcessamentoAssinatura {
  sucesso: boolean
  pagamento: PagamentoRegistro
  mensagem: string
  referencia: string
}

export const gatewayPagamentoService = {
  /**
   * Flag de controle do ambiente.
   * Quando receber as credenciais de produção, basta mudar para 'real'.
   */
  modo: 'simulado' as ModoGateway,

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
   * Processa a contratação/renovação de uma assinatura do plano Starter (R$ 49,90)
   *
   * 1. Processa a cobrança (no modo simulado com validação, ou via gateway real);
   * 2. Registra o pagamento na coleção 'pagamentos';
   * 3. Atualiza ou cria a assinatura do usuário na coleção 'planos' para 'ativo' com +30 dias.
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

    // ========================================================================
    // GATEWAY REAL: conectar credenciais Mercado Pago/Stripe aqui
    // Exemplo:
    // if (this.modo === 'real') {
    //   const respostaGateway = await fetch('https://api.mercadopago.com/v1/payments', ...)
    //   ...
    // }
    // ========================================================================

    const metadados: Record<string, unknown> = {
      modo: this.modo,
      plano_id: PLANO_CONFIG.id,
      valor_formatado: PLANO_CONFIG.precoFormatado,
      processado_em: agora.toISOString(),
      gateway_provedor:
        this.modo === 'simulado' ? 'Simulação Homologada OrçaFácil' : 'Mercado Pago / Stripe',
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
      // Não interrompe o retorno do comprovante já gerado
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
   * Usado exclusivamente pelo dono (jaocarloss@gmail.com).
   */
  async alterarStatusVendaManual(
    pagamentoId: string,
    novoStatus: PagamentoStatus,
  ): Promise<PagamentoRegistro> {
    const atualizado = await pb.collection('pagamentos').update<PagamentoRegistro>(pagamentoId, {
      status: novoStatus,
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
      // Se não havia registro de plano, cria com o status desejado
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
