import pb from '@/lib/pocketbase/client'
import { PreferenciasIa, TomRespostaIa } from '@/types'

const PREF_PADRAO: PreferenciasIa = {
  user_id: '',
  nome_preferido: '',
  tom_resposta: 'amigavel',
  usar_emojis: true,
}

export const preferenciasIaService = {
  /**
   * Obtém as preferências da IA do usuário logado
   */
  async obter(userId?: string): Promise<PreferenciasIa> {
    const uid = userId || pb.authStore.record?.id
    if (!uid) return PREF_PADRAO

    try {
      const record = await pb
        .collection('preferencias_ia')
        .getFirstListItem<PreferenciasIa>(`user_id = "${uid}"`)
      return record
    } catch {
      // Se ainda não existir registro no banco, retorna configuração padrão usando primeiro nome do usuário
      const fallbackNome = (pb.authStore.record?.name || '').split(' ')[0] || ''
      return {
        ...PREF_PADRAO,
        user_id: uid,
        nome_preferido: fallbackNome,
      }
    }
  },

  /**
   * Salva ou atualiza as preferências da IA
   */
  async salvar(dados: {
    nome_preferido?: string
    tom_resposta?: TomRespostaIa
    usar_emojis?: boolean
    user_id?: string
  }): Promise<PreferenciasIa> {
    const uid = dados.user_id || pb.authStore.record?.id
    if (!uid) throw new Error('Usuário não autenticado')

    try {
      const existente = await pb
        .collection('preferencias_ia')
        .getFirstListItem<PreferenciasIa>(`user_id = "${uid}"`)

      return await pb.collection('preferencias_ia').update<PreferenciasIa>(existente.id as string, {
        nome_preferido: dados.nome_preferido ?? existente.nome_preferido,
        tom_resposta: dados.tom_resposta ?? existente.tom_resposta,
        usar_emojis: dados.usar_emojis ?? existente.usar_emojis,
      })
    } catch {
      // Se não existe, cria novo registro
      return await pb.collection('preferencias_ia').create<PreferenciasIa>({
        user_id: uid,
        nome_preferido: dados.nome_preferido || '',
        tom_resposta: dados.tom_resposta || 'amigavel',
        usar_emojis: dados.usar_emojis !== undefined ? dados.usar_emojis : true,
      })
    }
  },
}
