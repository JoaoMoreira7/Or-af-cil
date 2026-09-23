import pb from '@/lib/pocketbase/client'
import { AudioRegistro, AudioContexto } from '@/types'

export const audiosService = {
  async listar(options?: {
    contexto?: AudioContexto | 'todos'
    busca?: string
    limite?: number
  }): Promise<AudioRegistro[]> {
    const filtros: string[] = []

    if (options?.contexto && options.contexto !== 'todos') {
      filtros.push(`contexto = "${options.contexto}"`)
    }

    if (options?.busca?.trim()) {
      const q = options.busca.trim().replace(/"/g, '\\"')
      filtros.push(`(transcricao_bruta ~ "${q}" || transcricao_corrigida ~ "${q}")`)
    }

    return await pb.collection('audios').getFullList<AudioRegistro>({
      filter: filtros.length > 0 ? filtros.join(' && ') : undefined,
      sort: '-created',
      requestKey: null,
    })
  },

  async buscarPorId(id: string): Promise<AudioRegistro> {
    return await pb.collection('audios').getOne<AudioRegistro>(id)
  },

  async marcarComoExecutado(id: string): Promise<AudioRegistro> {
    return await pb.collection('audios').update<AudioRegistro>(id, {
      comando_executado: true,
    })
  },

  async excluir(id: string): Promise<boolean> {
    return await pb.collection('audios').delete(id)
  },
}
