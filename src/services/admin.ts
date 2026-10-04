import pb from '@/lib/pocketbase/client'
import { PlanoAssinatura, UsuarioAssinanteAdmin, AdminMetricas } from '@/types'
import { RecordModel } from 'pocketbase'
import { PLANO_CONFIG } from '@/config/plans'

export interface UserRecordModel extends RecordModel {
  name?: string
  email?: string
  admin?: boolean
  created: string
}

export const adminService = {
  /**
   * Carrega lista combinada de usuários e seus respectivos planos
   */
  async obterUsuariosEPlanos(): Promise<{
    metricas: AdminMetricas
    assinantes: UsuarioAssinanteAdmin[]
  }> {
    try {
      // 1. Obter todos os usuários (ordenados pelos mais recentes)
      const usersResult = await pb.collection('users').getList<UserRecordModel>(1, 500, {
        sort: '-created',
      })

      // 2. Obter todos os planos
      const planosResult = await pb.collection('planos').getList<PlanoAssinatura>(1, 500, {
        sort: '-created',
      })

      const mapPlanosPorUser = new Map<string, PlanoAssinatura>()
      for (const plano of planosResult.items) {
        if (plano.user_id && !mapPlanosPorUser.has(plano.user_id)) {
          mapPlanosPorUser.set(plano.user_id, plano)
        }
      }

      let totalEmTrial = 0
      let totalAtivos = 0
      let totalExpirados = 0

      const agora = Date.now()

      const assinantes: UsuarioAssinanteAdmin[] = usersResult.items.map((u) => {
        const plano = mapPlanosPorUser.get(u.id)

        let status = plano?.status || 'trial'
        let diasRestantes: number | undefined = undefined

        if (plano?.trial_ate) {
          const diffMs = new Date(plano.trial_ate).getTime() - agora
          const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
          diasRestantes = Math.max(0, dias)
          if (status === 'trial' && diffMs <= 0) {
            status = 'expirado'
          }
        }

        if (status === 'ativo') {
          totalAtivos++
        } else if (status === 'trial') {
          totalEmTrial++
        } else {
          totalExpirados++
        }

        return {
          id: u.id,
          name: u.name || 'Sem nome',
          email: u.email || '',
          admin: !!u.admin,
          planoStatus: status,
          planoNome:
            plano?.plano === 'pro'
              ? 'Pro'
              : `${PLANO_CONFIG.nome} (${PLANO_CONFIG.precoMensalExtenso})`,
          trialAte: plano?.trial_ate,
          renovacaoEm: plano?.renovacao_em,
          diasRestantesTrial: diasRestantes,
          created: u.created,
        }
      })

      const VALOR_MENSAL_STARTER = PLANO_CONFIG.precoMensal
      const receitaMensalEstimada = totalAtivos * VALOR_MENSAL_STARTER

      const metricas: AdminMetricas = {
        totalUsuarios: usersResult.totalItems || usersResult.items.length,
        totalEmTrial,
        totalAtivos,
        totalExpirados,
        receitaMensalEstimada,
      }

      return {
        metricas,
        assinantes,
      }
    } catch (err: unknown) {
      console.error('Erro ao buscar dados administrativos:', err)
      throw err
    }
  },
}
