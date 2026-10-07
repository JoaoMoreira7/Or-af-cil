import pb from '@/lib/pocketbase/client'
import { Cobranca, CobrancaStatus } from '@/types'

export interface CriarCobrancaParams {
  orcamento_id: string
  cliente_id?: string
  cliente_nome: string
  orcamento_numero: string
  valor: number
  user_id?: string
}

/**
 * Gera um código PIX copia-e-cola fictício padronizado para simulação
 */
export function gerarCodigoPixSimulado(params: {
  orcamentoNumero: string
  valor: number
  clienteNome: string
}): string {
  const numLimpo = params.orcamentoNumero.replace(/\D/g, '') || '001'
  const valCentavos = Math.round(params.valor * 100)
  const basePayload = `00020126580014br.gov.bcb.pix0136orcafacil-simulacao-cobranca-orc${numLimpo}520400005303986540${params.valor.toFixed(2)}5802BR5920ORCAFACIL SAAS LTDA6009SAO PAULO62140510ORC${numLimpo}${valCentavos}6304`

  // Calcula CRC16 matematicamente correto para o payload simulado
  let crc = 0xffff
  for (let i = 0; i < basePayload.length; i++) {
    const c = basePayload.charCodeAt(i)
    crc ^= (c & 0xff) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0')
  return basePayload + crcHex
}

export const cobrancasService = {
  /**
   * Lista todas as cobranças do usuário logado
   */
  async listar(options?: {
    filtroStatus?: 'todos' | CobrancaStatus
    orcamentoId?: string
  }): Promise<Cobranca[]> {
    const filtros: string[] = []

    if (options?.filtroStatus && options.filtroStatus !== 'todos') {
      filtros.push(`status = "${options.filtroStatus}"`)
    }

    if (options?.orcamentoId) {
      filtros.push(`orcamento_id = "${options.orcamentoId}"`)
    }

    try {
      const records = await pb.collection('cobrancas').getFullList<Cobranca>({
        filter: filtros.length > 0 ? filtros.join(' && ') : undefined,
        sort: '-created',
        expand: 'orcamento_id,cliente_id',
      })
      return records
    } catch (err) {
      console.warn('Erro ao listar cobranças:', err)
      return []
    }
  },

  /**
   * Busca cobrança vinculada a um orçamento
   */
  async buscarPorOrcamentoId(orcamentoId: string): Promise<Cobranca | null> {
    try {
      const record = await pb
        .collection('cobrancas')
        .getFirstListItem<Cobranca>(`orcamento_id = "${orcamentoId}"`, {
          sort: '-created',
          expand: 'orcamento_id,cliente_id',
        })
      return record || null
    } catch {
      return null
    }
  },

  /**
   * Cria uma nova cobrança simulada vinculada a um orçamento aprovado
   */
  async criar(params: CriarCobrancaParams): Promise<Cobranca> {
    const uid = params.user_id || pb.authStore.record?.id
    if (!uid) throw new Error('Usuário não autenticado')

    // Verifica se já existe cobrança aberta para este orçamento
    const existente = await this.buscarPorOrcamentoId(params.orcamento_id)
    if (existente) {
      return existente
    }

    const pixSimulado = gerarCodigoPixSimulado({
      orcamentoNumero: params.orcamento_numero,
      valor: params.valor,
      clienteNome: params.cliente_nome,
    })

    const record = await pb.collection('cobrancas').create<Cobranca>({
      user_id: uid,
      orcamento_id: params.orcamento_id,
      cliente_id: params.cliente_id || undefined,
      cliente_nome: params.cliente_nome,
      orcamento_numero: params.orcamento_numero,
      valor: params.valor,
      status: 'pendente',
      codigo_pix: pixSimulado,
    })

    return record
  },

  /**
   * Registra a baixa da cobrança (marca como pago)
   */
  async marcarComoPago(id: string): Promise<Cobranca> {
    const agoraIso = new Date().toISOString()
    return await pb.collection('cobrancas').update<Cobranca>(id, {
      status: 'pago',
      pago_em: agoraIso,
    })
  },

  /**
   * Reverte status de pago para pendente (usado no desfazer)
   */
  async marcarComoPendente(id: string): Promise<Cobranca> {
    return await pb.collection('cobrancas').update<Cobranca>(id, {
      status: 'pendente',
      pago_em: null,
    })
  },

  /**
   * Exclui cobrança (usado no desfazer de geração de cobrança)
   */
  async excluir(id: string): Promise<boolean> {
    return await pb.collection('cobrancas').delete(id)
  },
}
