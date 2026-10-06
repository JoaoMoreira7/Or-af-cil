import pb from '@/lib/pocketbase/client'
import { Gasto, CategoriaGasto, OrigemGasto } from '@/types'

export interface CriarGastoParams {
  descricao: string
  valor: number
  categoria: CategoriaGasto
  data: string
  origem: OrigemGasto
  orcamento_vinculado?: string | null
  observacoes?: string
}

export interface AtualizarGastoParams {
  descricao?: string
  valor?: number
  categoria?: CategoriaGasto
  data?: string
  origem?: OrigemGasto
  orcamento_vinculado?: string | null
  observacoes?: string
}

export const gastosService = {
  async listar(filtros?: {
    mesAno?: string // ex: "2025-05"
    categoria?: string
    orcamentoId?: string
  }): Promise<Gasto[]> {
    const userId = pb.authStore.record?.id
    if (!userId) return []

    const conditions: string[] = [`user_id = '${userId}'`]

    if (filtros?.mesAno) {
      // Data inicia com "YYYY-MM"
      conditions.push(`data ~ '${filtros.mesAno}'`)
    }

    if (filtros?.categoria && filtros.categoria !== 'todas') {
      conditions.push(`categoria = '${filtros.categoria}'`)
    }

    if (filtros?.orcamentoId) {
      conditions.push(`orcamento_vinculado = '${filtros.orcamentoId}'`)
    }

    const records = await pb.collection('gastos').getFullList<Gasto>({
      filter: conditions.join(' && '),
      sort: '-data,-created',
      expand: 'orcamento_vinculado',
    })

    return records
  },

  async buscarPorId(id: string): Promise<Gasto> {
    return pb.collection('gastos').getOne<Gasto>(id, {
      expand: 'orcamento_vinculado',
    })
  },

  async criar(params: CriarGastoParams): Promise<Gasto> {
    const userId = pb.authStore.record?.id
    if (!userId) {
      throw new Error('Usuário não autenticado')
    }

    const payload: Record<string, unknown> = {
      user_id: userId,
      descricao: params.descricao.trim(),
      valor: Math.max(0, Number(params.valor) || 0),
      categoria: params.categoria,
      data: params.data || new Date().toISOString().slice(0, 10),
      origem: params.origem || 'manual',
    }

    if (params.orcamento_vinculado) {
      payload.orcamento_vinculado = params.orcamento_vinculado
    }

    if (params.observacoes) {
      payload.observacoes = params.observacoes
    }

    const record = await pb.collection('gastos').create<Gasto>(payload, {
      expand: 'orcamento_vinculado',
    })

    return record
  },

  async atualizar(id: string, params: AtualizarGastoParams): Promise<Gasto> {
    const payload: Record<string, unknown> = {}
    if (params.descricao !== undefined) payload.descricao = params.descricao.trim()
    if (params.valor !== undefined) payload.valor = Math.max(0, Number(params.valor) || 0)
    if (params.categoria !== undefined) payload.categoria = params.categoria
    if (params.data !== undefined) payload.data = params.data
    if (params.origem !== undefined) payload.origem = params.origem
    if (params.orcamento_vinculado !== undefined) {
      payload.orcamento_vinculado = params.orcamento_vinculado || null
    }
    if (params.observacoes !== undefined) payload.observacoes = params.observacoes

    const record = await pb.collection('gastos').update<Gasto>(id, payload, {
      expand: 'orcamento_vinculado',
    })

    return record
  },

  async excluir(id: string): Promise<boolean> {
    return pb.collection('gastos').delete(id)
  },

  async calcularTotais(gastos: Gasto[]) {
    let total = 0
    const porCategoria: Record<CategoriaGasto, number> = {
      Material: 0,
      Transporte: 0,
      Alimentação: 0,
      'Moradia/Aluguel': 0,
      Ferramentas: 0,
      'Serviços terceirizados': 0,
      'Impostos/Taxas': 0,
      Outros: 0,
    }

    for (const g of gastos) {
      const val = Number(g.valor) || 0
      total += val
      if (porCategoria[g.categoria] !== undefined) {
        porCategoria[g.categoria] += val
      } else {
        porCategoria.Outros += val
      }
    }

    return {
      total,
      porCategoria,
      quantidade: gastos.length,
    }
  },
}
