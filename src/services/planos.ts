import pb from '@/lib/pocketbase/client'
import { PlanoAssinatura, FormaPagamentoAssinatura } from '@/types'
import { gatewayPagamentoService } from './gatewayPagamento'
import { PlanoId } from '@/config/plans'

export const planosService = {
  async obterPlanoUsuario(userId: string): Promise<PlanoAssinatura | null> {
    try {
      const records = await pb.collection('planos').getList<PlanoAssinatura>(1, 1, {
        filter: `user_id = "${userId}"`,
        sort: '-created',
      })
      return records.items[0] || null
    } catch (err) {
      console.error('Erro ao buscar plano do usuário:', err)
      return null
    }
  },

  async assinarPlano(
    userId: string,
    plano: PlanoId | string = 'essencial',
    formaPagamento: FormaPagamentoAssinatura = 'pix',
  ): Promise<PlanoAssinatura> {
    try {
      // Registra a venda através do gateway de pagamento oficial
      await gatewayPagamentoService.processarAssinatura({
        userId,
        planoId: plano,
        formaPagamento,
      })

      const hoje = new Date()
      const renovacao = new Date(hoje)
      renovacao.setDate(renovacao.getDate() + 30)

      const planoExistente = await this.obterPlanoUsuario(userId)
      if (planoExistente) {
        return await pb.collection('planos').update<PlanoAssinatura>(planoExistente.id, {
          plano: plano as any,
          status: 'ativo',
          renovacao_em: renovacao.toISOString(),
        })
      }

      return await pb.collection('planos').create<PlanoAssinatura>({
        user_id: userId,
        plano: plano as any,
        status: 'ativo',
        renovacao_em: renovacao.toISOString(),
      })
    } catch (err) {
      console.error('Erro ao assinar plano:', err)
      throw err
    }
  },

  async iniciarOuVerificarTrial(userId: string): Promise<PlanoAssinatura> {
    // Se o usuário atual for o dono do sistema, garante plano ativo vitalício
    const authUser = pb.authStore.record
    const isDono =
      authUser?.id === userId &&
      (authUser?.email || '').toLowerCase().trim() === 'jaocarloss@gmail.com'

    const planoExistente = await this.obterPlanoUsuario(userId)
    if (planoExistente) {
      if (isDono) {
        // Conta do dono: sempre ativo no plano premium vitalício, nunca expirado
        if (planoExistente.status !== 'ativo' || planoExistente.plano !== 'premium') {
          return await pb.collection('planos').update<PlanoAssinatura>(planoExistente.id, {
            status: 'ativo',
            plano: 'premium',
            renovacao_em: '2099-12-31T23:59:59.000Z',
            trial_ate: '2099-12-31T23:59:59.000Z',
          })
        }
        return planoExistente
      }

      // Se está em trial, verifica se expirou (apenas para usuários comuns)
      if (planoExistente.status === 'trial' && planoExistente.trial_ate) {
        const agora = new Date()
        const trialAte = new Date(planoExistente.trial_ate)
        if (agora > trialAte) {
          // Atualiza para expirado
          return await pb.collection('planos').update<PlanoAssinatura>(planoExistente.id, {
            status: 'expirado',
          })
        }
      }
      return planoExistente
    }

    if (isDono) {
      // Se por algum motivo o dono não tiver registro, cria já como ativo premium vitalício
      try {
        return await pb.collection('planos').create<PlanoAssinatura>({
          user_id: userId,
          plano: 'premium',
          status: 'ativo',
          renovacao_em: '2099-12-31T23:59:59.000Z',
          trial_ate: '2099-12-31T23:59:59.000Z',
          aviso_teste_enviado: true,
        })
      } catch (err) {
        console.error('Erro ao criar plano do dono:', err)
      }
    }

    // Cria trial de 7 dias iniciando no plano Essencial
    const agora = new Date()
    const trialAte = new Date(agora)
    trialAte.setDate(trialAte.getDate() + 7)

    try {
      return await pb.collection('planos').create<PlanoAssinatura>({
        user_id: userId,
        plano: 'essencial',
        status: 'trial',
        trial_ate: trialAte.toISOString(),
        aviso_teste_enviado: false,
      })
    } catch (err) {
      console.error('Erro ao criar trial inicial:', err)
      throw err
    }
  },

  async simularFimTeste(userId: string): Promise<PlanoAssinatura> {
    const planoExistente = await this.obterPlanoUsuario(userId)
    const agora = new Date()
    const ontem = new Date(agora)
    ontem.setDate(ontem.getDate() - 1)

    if (planoExistente) {
      return await pb.collection('planos').update<PlanoAssinatura>(planoExistente.id, {
        status: 'expirado',
        trial_ate: ontem.toISOString(),
      })
    }

    return await pb.collection('planos').create<PlanoAssinatura>({
      user_id: userId,
      plano: 'essencial',
      status: 'expirado',
      trial_ate: ontem.toISOString(),
    })
  },

  async restaurarTeste(userId: string, dias: number = 3): Promise<PlanoAssinatura> {
    const planoExistente = await this.obterPlanoUsuario(userId)
    const agora = new Date()
    const futuro = new Date(agora)
    futuro.setDate(futuro.getDate() + dias)

    if (planoExistente) {
      return await pb.collection('planos').update<PlanoAssinatura>(planoExistente.id, {
        status: 'trial',
        trial_ate: futuro.toISOString(),
        aviso_teste_enviado: false,
      })
    }

    return await pb.collection('planos').create<PlanoAssinatura>({
      user_id: userId,
      plano: 'essencial',
      status: 'trial',
      trial_ate: futuro.toISOString(),
      aviso_teste_enviado: false,
    })
  },
}
