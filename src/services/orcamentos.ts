import pb from '@/lib/pocketbase/client'
import { Orçamento, OrçamentoItem } from '@/types'

export interface IAOrcamentoResultado {
  itens: OrçamentoItem[]
  cliente_sugerido: string | null
  citations?: string[]
}

export const orcamentosService = {
  async listar(options?: {
    filtroStatus?: string
    busca?: string
    ordenacao?: string
  }): Promise<Orçamento[]> {
    const filtros: string[] = []

    if (options?.filtroStatus && options.filtroStatus !== 'todos') {
      filtros.push(`status = "${options.filtroStatus}"`)
    }

    if (options?.busca?.trim()) {
      const q = options.busca.trim().replace(/"/g, '\\"')
      filtros.push(`(descricao ~ "${q}" || numero ~ "${q}")`)
    }

    let sort = '-created'
    if (options?.ordenacao === 'antigos') sort = 'created'
    else if (options?.ordenacao === 'maior_valor') sort = '-valor_total'
    else if (options?.ordenacao === 'menor_valor') sort = 'valor_total'

    return await pb.collection('orcamentos').getFullList<Orçamento>({
      filter: filtros.length > 0 ? filtros.join(' && ') : undefined,
      sort,
      expand: 'cliente_id',
    })
  },

  async buscarPorId(id: string): Promise<Orçamento> {
    return await pb.collection('orcamentos').getOne<Orçamento>(id, {
      expand: 'cliente_id',
    })
  },

  async obterProximoNumero(userId: string): Promise<string> {
    try {
      const ultimos = await pb.collection('orcamentos').getList<Orçamento>(1, 1, {
        filter: `user_id = "${userId}"`,
        sort: '-created',
      })

      if (ultimos.items.length === 0) {
        return '#001'
      }

      const match = ultimos.items[0].numero?.match(/#?(\d+)/)
      if (match) {
        const proximo = parseInt(match[1], 10) + 1
        return `#${String(proximo).padStart(3, '0')}`
      }
      return '#001'
    } catch {
      return '#001'
    }
  },

  async criar(dados: Omit<Orçamento, 'id' | 'created' | 'updated'>): Promise<Orçamento> {
    return await pb.collection('orcamentos').create<Orçamento>(dados, {
      expand: 'cliente_id',
    })
  },

  async atualizar(id: string, dados: Partial<Orçamento>): Promise<Orçamento> {
    return await pb.collection('orcamentos').update<Orçamento>(id, dados, {
      expand: 'cliente_id',
    })
  },

  async atualizarStatus(id: string, status: Orçamento['status']): Promise<Orçamento> {
    return await pb.collection('orcamentos').update<Orçamento>(
      id,
      { status },
      {
        expand: 'cliente_id',
      },
    )
  },

  async excluir(id: string): Promise<boolean> {
    return await pb.collection('orcamentos').delete(id)
  },

  async gerarComIA(descricao: string, userId: string): Promise<IAOrcamentoResultado> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/orcamento/gerar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({
        descricao,
        userId,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Erro ao gerar orçamento com IA')
    }

    return data
  },
}
