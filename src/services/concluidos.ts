import pb from '@/lib/pocketbase/client'
import { Orçamento, Cobranca, Cliente } from '@/types'

export interface ItemConcluido {
  orcamento: Orçamento
  cobranca: Cobranca | null
  cliente: Cliente | null
  isPago: boolean
  valorTotal: number
  dataConclusao: string // updated do orcamento ou pago_em da cobranca
  itensDescricao: string
}

export type PeriodoConcluidosFiltro = 'este_mes' | 'ultimos_3_meses' | 'este_ano' | 'tudo'
export type SituacaoConcluidosFiltro = 'todos' | 'pagos' | 'aguardando'

export interface MetricasConcluidos {
  totalConcluido: number
  quantidadeConcluidos: number
  totalRecebido: number
  totalAReceber: number
  ticketMedio: number
  quantidadePagos: number
  quantidadeAguardando: number
}

function obterDataInicioPeriodo(periodo: PeriodoConcluidosFiltro): Date | null {
  const agora = new Date()
  if (periodo === 'este_mes') {
    return new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0)
  }
  if (periodo === 'ultimos_3_meses') {
    return new Date(agora.getFullYear(), agora.getMonth() - 2, 1, 0, 0, 0, 0)
  }
  if (periodo === 'este_ano') {
    return new Date(agora.getFullYear(), 0, 1, 0, 0, 0, 0)
  }
  return null
}

export const concluidosService = {
  /**
   * Lista serviços e vendas concluídos (orçamentos com status 'aprovado')
   * cruzando com a cobrança correspondente e cliente associado.
   */
  async listar(options?: {
    periodo?: PeriodoConcluidosFiltro
    situacao?: SituacaoConcluidosFiltro
    busca?: string
  }): Promise<{
    itens: ItemConcluido[]
    metricas: MetricasConcluidos
  }> {
    const periodo = options?.periodo || 'este_mes'
    const situacao = options?.situacao || 'todos'
    const busca = options?.busca?.trim().toLowerCase() || ''

    // 1. Monta filtro de orçamentos: sempre status aprovado
    const filtrosOrc: string[] = ['status = "aprovado"']

    const dataInicio = obterDataInicioPeriodo(periodo)
    if (dataInicio) {
      // Formata YYYY-MM-DD HH:mm:ss para filtro no PocketBase
      const iso = dataInicio.toISOString().replace('T', ' ').substring(0, 19)
      // Usamos updated ou created para cobrir aprovação
      filtrosOrc.push(`updated >= "${iso}"`)
    }

    // Busca rápida no servidor se houver termo
    if (busca) {
      const q = busca.replace(/"/g, '\\"')
      filtrosOrc.push(`(descricao ~ "${q}" || numero ~ "${q}")`)
    }

    try {
      // 2. Busca paralela de orçamentos aprovados e cobranças
      const [orcamentos, cobrancas] = await Promise.all([
        pb.collection('orcamentos').getFullList<Orçamento>({
          filter: filtrosOrc.join(' && '),
          sort: '-updated',
          expand: 'cliente_id',
        }),
        pb.collection('cobrancas').getFullList<Cobranca>({
          sort: '-created',
          expand: 'cliente_id',
        }),
      ])

      // 3. Mapeia cobranças por orcamento_id
      const cobrancaPorOrcamento = new Map<string, Cobranca>()
      for (const cob of cobrancas) {
        if (cob.orcamento_id) {
          // Mantém a cobrança mais recente ou prioritariamente 'pago'
          const existente = cobrancaPorOrcamento.get(cob.orcamento_id)
          if (!existente || cob.status === 'pago') {
            cobrancaPorOrcamento.set(cob.orcamento_id, cob)
          }
        }
      }

      // 4. Constrói a lista unificada
      const todosItens: ItemConcluido[] = orcamentos.map((orc) => {
        const cob = cobrancaPorOrcamento.get(orc.id) || null
        const isPago = cob?.status === 'pago'
        const cliente = (orc.expand?.cliente_id as Cliente) || null
        const dataConclusao = isPago && cob?.pago_em ? cob.pago_em : orc.updated || orc.created

        // Descrição resumida dos itens
        let itensDescricao = ''
        if (orc.itens && Array.isArray(orc.itens) && orc.itens.length > 0) {
          itensDescricao = orc.itens
            .map((it) => (it.quantidade > 1 ? `${it.quantidade}x ${it.descricao}` : it.descricao))
            .join(', ')
        } else {
          itensDescricao = orc.descricao || 'Serviço prestado'
        }

        return {
          orcamento: orc,
          cobranca: cob,
          cliente,
          isPago,
          valorTotal: Number(orc.valor_total) || 0,
          dataConclusao,
          itensDescricao,
        }
      })

      // 5. Filtro em memória de situação (pagos / aguardando pagamento)
      let itensFiltrados = todosItens.filter((item) => {
        if (situacao === 'pagos') return item.isPago
        if (situacao === 'aguardando') return !item.isPago
        return true
      })

      // Filtro complementar de busca por nome do cliente (caso o cliente não esteja no texto do orçamento)
      if (busca) {
        itensFiltrados = itensFiltrados.filter((item) => {
          const num = item.orcamento.numero?.toLowerCase() || ''
          const desc = item.orcamento.descricao?.toLowerCase() || ''
          const itens = item.itensDescricao.toLowerCase()
          const cliNome = (
            item.cliente?.nome ||
            item.cobranca?.cliente_nome ||
            item.orcamento.expand?.cliente_id?.nome ||
            ''
          ).toLowerCase()

          return (
            num.includes(busca) ||
            desc.includes(busca) ||
            itens.includes(busca) ||
            cliNome.includes(busca)
          )
        })
      }

      // 6. Ordenação: mais recentes primeiro (por dataConclusao desc)
      itensFiltrados.sort(
        (a, b) => new Date(b.dataConclusao).getTime() - new Date(a.dataConclusao).getTime(),
      )

      // 7. Cálculo das Métricas de Resumo sobre o conjunto do período (antes do filtro de situação para manter consistência)
      let totalConcluido = 0
      let totalRecebido = 0
      let totalAReceber = 0
      let quantidadePagos = 0
      let quantidadeAguardando = 0

      for (const item of todosItens) {
        totalConcluido += item.valorTotal
        if (item.isPago) {
          totalRecebido += item.valorTotal
          quantidadePagos += 1
        } else {
          totalAReceber += item.valorTotal
          quantidadeAguardando += 1
        }
      }

      const quantidadeConcluidos = todosItens.length
      const ticketMedio = quantidadeConcluidos > 0 ? totalConcluido / quantidadeConcluidos : 0

      return {
        itens: itensFiltrados,
        metricas: {
          totalConcluido,
          quantidadeConcluidos,
          totalRecebido,
          totalAReceber,
          ticketMedio,
          quantidadePagos,
          quantidadeAguardando,
        },
      }
    } catch (err) {
      console.error('Erro ao listar concluídos:', err)
      return {
        itens: [],
        metricas: {
          totalConcluido: 0,
          quantidadeConcluidos: 0,
          totalRecebido: 0,
          totalAReceber: 0,
          ticketMedio: 0,
          quantidadePagos: 0,
          quantidadeAguardando: 0,
        },
      }
    }
  },
}
