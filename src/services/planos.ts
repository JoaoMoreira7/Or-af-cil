import pb from '@/lib/pocketbase/client'
import { PlanoAssinatura } from '@/types'

export const planosService = {
  async obterPlanoUsuario(userId: string): Promise<PlanoAssinatura | null> {
    try {
      const registros = await pb.collection('planos').getList<PlanoAssinatura>(1, 1, {
        filter: `user_id = "${userId}"`,
      })
      return registros.items[0] || null
    } catch {
      return null
    }
  },

  async assinarPlano(userId: string, plano: 'starter' | 'pro'): Promise<PlanoAssinatura> {
    const dataRenovacao = new Date()
    dataRenovacao.setDate(dataRenovacao.getDate() + 30)

    try {
      const atual = await this.obterPlanoUsuario(userId)
      if (atual) {
        return await pb.collection('planos').update<PlanoAssinatura>(atual.id, {
          plano,
          status: 'ativo',
          renovacao_em: dataRenovacao.toISOString(),
        })
      } else {
        return await pb.collection('planos').create<PlanoAssinatura>({
          user_id: userId,
          plano,
          status: 'ativo',
          renovacao_em: dataRenovacao.toISOString(),
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar assinatura do plano'
      throw new Error(msg)
    }
  },
}
