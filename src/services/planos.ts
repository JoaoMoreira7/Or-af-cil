import pb from '@/lib/pocketbase/client'
import { PlanoAssinatura, FormaPagamentoAssinatura } from '@/types'
import { gatewayPagamentoService } from '@/services/gatewayPagamento'

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

  async assinarPlano(
    userId: string,
    plano: 'starter' | 'pro' = 'starter',
    formaPagamento: FormaPagamentoAssinatura = 'pix',
  ): Promise<PlanoAssinatura> {
    try {
      // Registra a venda através do gateway de pagamento oficial
      await gatewayPagamentoService.processarAssinatura({
        userId,
        formaPagamento,
      })

      const atual = await this.obterPlanoUsuario(userId)
      if (!atual) {
        throw new Error('Falha ao obter registro atualizado da assinatura')
      }
      return atual
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar assinatura do plano'
      throw new Error(msg)
    }
  },

  async iniciarOuVerificarTrial(userId: string): Promise<PlanoAssinatura> {
    const atual = await this.obterPlanoUsuario(userId)
    if (atual) {
      // Se estiver em trial, verificar se a data já expirou
      if (atual.status === 'trial' && atual.trial_ate) {
        const expirou = new Date(atual.trial_ate).getTime() <= Date.now()
        if (expirou) {
          return await pb.collection('planos').update<PlanoAssinatura>(atual.id, {
            status: 'expirado',
          })
        }
      }
      return atual
    }

    // Se ainda não existir registro de plano, inicia o trial de 7 dias
    const trialDate = new Date()
    trialDate.setDate(trialDate.getDate() + 7)
    return await pb.collection('planos').create<PlanoAssinatura>({
      user_id: userId,
      plano: 'starter',
      status: 'trial',
      trial_ate: trialDate.toISOString(),
    })
  },

  async simularFimTeste(userId: string): Promise<PlanoAssinatura> {
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)

    const atual = await this.obterPlanoUsuario(userId)
    if (atual) {
      return await pb.collection('planos').update<PlanoAssinatura>(atual.id, {
        status: 'expirado',
        trial_ate: ontem.toISOString(),
      })
    } else {
      return await pb.collection('planos').create<PlanoAssinatura>({
        user_id: userId,
        plano: 'starter',
        status: 'expirado',
        trial_ate: ontem.toISOString(),
      })
    }
  },

  async restaurarTeste(userId: string, dias: number = 3): Promise<PlanoAssinatura> {
    const futuro = new Date()
    futuro.setDate(futuro.getDate() + dias)

    const atual = await this.obterPlanoUsuario(userId)
    if (atual) {
      return await pb.collection('planos').update<PlanoAssinatura>(atual.id, {
        status: 'trial',
        trial_ate: futuro.toISOString(),
      })
    } else {
      return await pb.collection('planos').create<PlanoAssinatura>({
        user_id: userId,
        plano: 'starter',
        status: 'trial',
        trial_ate: futuro.toISOString(),
      })
    }
  },
}
