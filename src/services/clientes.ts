import pb from '@/lib/pocketbase/client'
import { Cliente } from '@/types'

export const clientesService = {
  async listar(): Promise<Cliente[]> {
    return await pb.collection('clientes').getFullList<Cliente>({
      sort: '-created',
    })
  },

  async buscarPorId(id: string): Promise<Cliente> {
    return await pb.collection('clientes').getOne<Cliente>(id)
  },

  async criar(dados: Omit<Cliente, 'id' | 'created' | 'updated'>): Promise<Cliente> {
    return await pb.collection('clientes').create<Cliente>(dados)
  },

  async atualizar(id: string, dados: Partial<Cliente>): Promise<Cliente> {
    return await pb.collection('clientes').update<Cliente>(id, dados)
  },

  async excluir(id: string): Promise<boolean> {
    // Checar se cliente possui orçamentos associados
    const countOrcamentos = await pb.collection('orcamentos').getList(1, 1, {
      filter: `cliente_id = "${id}"`,
    })

    if (countOrcamentos.totalItems > 0) {
      throw new Error(
        `Este cliente possui ${countOrcamentos.totalItems} orçamento(s) vinculado(s) e não pode ser excluído.`,
      )
    }

    return await pb.collection('clientes').delete(id)
  },
}
