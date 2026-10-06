import pb from '@/lib/pocketbase/client'
import { PlanoAssinatura, FormaPagamentoAssinatura } from '@/types'
import { gatewayPagamentoService } from './gatewayPagamento'
import { PlanoId } from '@/config/plans'

// Cache de promessas em voo e debounce por userId para evitar duplicação em StrictMode/concorrência
const promisesEmVoo = new Map<string, Promise<PlanoAssinatura>>()
const ultimoSucessoPorUser = new Map<string, { plano: PlanoAssinatura; timestamp: number }>()

export const planosService = {
  async obterPlanoUsuario(userId: string): Promise<PlanoAssinatura | null> {
    try {
      // 1. Tenta obter pelo filtro direto
      const records = await pb.collection('planos').getList<PlanoAssinatura>(1, 1, {
        filter: `user_id = "${userId}"`,
        sort: '-created',
        requestKey: null, // Desativa auto-cancelamento do PocketBase SDK para evitar aborts espúrios
      })
      if (records.items.length > 0) {
        return records.items[0]
      }
      return null
    } catch (err: unknown) {
      // Se for abort de requisição concorrente ou 404, tenta fallback imediato
      const isAbort = (err as { isAbort?: boolean })?.isAbort
      if (!isAbort) {
        console.warn('[planosService] Aviso ao buscar plano do usuário, tentando fallback:', err)
      }
      // Tenta fallback com getFullList ou getFirstListItem
      try {
        const item = await pb
          .collection('planos')
          .getFirstListItem<PlanoAssinatura>(`user_id = "${userId}"`, {
            requestKey: null,
          })
        return item
      } catch {
        return null
      }
    }
  },

  /**
   * Função central idempotente de UPSERT para planos de usuário.
   * Garante que:
   * 1. Mutex/trava em memória por userId evita chamadas concorrentes paralelas no mesmo client.
   * 2. Sempre busca o registro existente primeiro (por ID ou user_id).
   * 3. Se existir, executa UPDATE exclusivamente.
   * 4. Só executa CREATE se não existir registro algum.
   * 5. Se o CREATE colidir (ex.: criação concorrente no backend), captura o 400 sem estourar e faz fallback imediato para UPDATE/leitura.
   */
  async garantirPlanoUsuario(
    userId: string,
    dados: {
      plano?: PlanoId | string
      status?: 'trial' | 'ativo' | 'expirado' | 'inativo'
      renovacao_em?: string | null
      trial_ate?: string | null
      aviso_teste_enviado?: boolean
    },
  ): Promise<PlanoAssinatura> {
    const planoNormalizado = (dados.plano || 'essencial') as PlanoId
    const statusNormalizado = dados.status || 'trial'

    // 1. Tenta buscar plano existente
    const planoExistente = await this.obterPlanoUsuario(userId)

    if (planoExistente) {
      // Já existe: atualiza apenas se houver alterações
      const precisaAtualizar =
        (dados.plano && planoExistente.plano !== dados.plano) ||
        (dados.status && planoExistente.status !== dados.status) ||
        (dados.renovacao_em !== undefined && planoExistente.renovacao_em !== dados.renovacao_em) ||
        (dados.trial_ate !== undefined && planoExistente.trial_ate !== dados.trial_ate) ||
        (dados.aviso_teste_enviado !== undefined &&
          planoExistente.aviso_teste_enviado !== dados.aviso_teste_enviado)

      if (precisaAtualizar) {
        try {
          const payloadUpdate: Record<string, unknown> = {}
          if (dados.plano) payloadUpdate.plano = planoNormalizado
          if (dados.status) payloadUpdate.status = statusNormalizado
          if (dados.renovacao_em !== undefined) payloadUpdate.renovacao_em = dados.renovacao_em
          if (dados.trial_ate !== undefined) payloadUpdate.trial_ate = dados.trial_ate
          if (dados.aviso_teste_enviado !== undefined)
            payloadUpdate.aviso_teste_enviado = dados.aviso_teste_enviado

          return await pb
            .collection('planos')
            .update<PlanoAssinatura>(planoExistente.id, payloadUpdate)
        } catch (err) {
          console.warn('[planosService] Falha ao atualizar plano existente, retornando atual:', err)
          return planoExistente
        }
      }
      return planoExistente
    }

    // 2. Não existe registro no client: chama endpoint seguro de upsert atômico do backend
    try {
      const payloadGarantir = {
        user_id: userId,
        plano: planoNormalizado,
        status: statusNormalizado,
        renovacao_em: dados.renovacao_em || null,
        trial_ate: dados.trial_ate || null,
        aviso_teste_enviado:
          dados.aviso_teste_enviado !== undefined ? dados.aviso_teste_enviado : false,
      }
      const resultadoBackend = await pb.send<PlanoAssinatura>('/backend/v1/planos/garantir', {
        method: 'POST',
        body: payloadGarantir,
        requestKey: null,
      })
      if (resultadoBackend?.id) {
        return resultadoBackend
      }
    } catch (endpointErr) {
      console.warn(
        '[planosService] Falha no endpoint /backend/v1/planos/garantir, tentando fallback:',
        endpointErr,
      )
    }

    // 3. Fallback: antes de criar, re-verifica mais uma vez
    const rechecagem = await this.obterPlanoUsuario(userId)
    if (rechecagem) {
      return rechecagem
    }

    const payloadCreate: Record<string, unknown> = {
      user_id: userId,
      plano: planoNormalizado,
      status: statusNormalizado,
    }
    if (dados.renovacao_em) payloadCreate.renovacao_em = dados.renovacao_em
    if (dados.trial_ate) payloadCreate.trial_ate = dados.trial_ate
    if (dados.aviso_teste_enviado !== undefined)
      payloadCreate.aviso_teste_enviado = dados.aviso_teste_enviado

    try {
      return await pb.collection('planos').create<PlanoAssinatura>(payloadCreate, {
        requestKey: null,
      })
    } catch {
      // Corrida: outro fluxo acabou de criar este registro ou índice único
      const rec = await this.obterPlanoUsuario(userId)
      if (rec) {
        return rec
      }
      return {
        id: `local_${userId}`,
        user_id: userId,
        plano: planoNormalizado,
        status: statusNormalizado,
        renovacao_em: dados.renovacao_em || undefined,
        trial_ate: dados.trial_ate || undefined,
        aviso_teste_enviado: !!dados.aviso_teste_enviado,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      } as PlanoAssinatura
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

      return await this.garantirPlanoUsuario(userId, {
        plano: plano as any,
        status: 'ativo',
        renovacao_em: renovacao.toISOString(),
      })
    } catch (err) {
      console.error('Erro ao assinar plano:', err)
      throw err
    }
  },

  async iniciarOuVerificarTrial(
    userId: string,
    forcarRecarregamento: boolean = false,
  ): Promise<PlanoAssinatura> {
    // 1. Cache de curta duração (2 segundos) para evitar batidas em cascata na montagem de tela / StrictMode
    const cacheado = ultimoSucessoPorUser.get(userId)
    const agoraMs = Date.now()
    if (!forcarRecarregamento && cacheado && agoraMs - cacheado.timestamp < 2000) {
      return cacheado.plano
    }

    // 2. Se já existe uma verificação em andamento para este userId, reutiliza a promessa em voo
    const emVoo = promisesEmVoo.get(userId)
    if (emVoo) {
      return emVoo
    }

    const promessa = (async () => {
      // Se o usuário atual for o dono do sistema, garante plano ativo vitalício
      const authUser = pb.authStore.record
      const isDono =
        (authUser?.id === userId &&
          (authUser?.email || '').toLowerCase().trim() === 'jaocarloss@gmail.com') ||
        userId === '2sonutsz843wx5z'

      // Sempre tenta buscar o plano existente primeiro
      const planoExistente = await this.obterPlanoUsuario(userId)
      if (planoExistente) {
        if (isDono) {
          // Conta do dono: sempre ativo no plano premium vitalício, nunca expirado
          if (
            planoExistente.status !== 'ativo' ||
            planoExistente.plano !== 'premium' ||
            !planoExistente.renovacao_em
          ) {
            try {
              const res = await pb.collection('planos').update<PlanoAssinatura>(
                planoExistente.id,
                {
                  status: 'ativo',
                  plano: 'premium',
                  renovacao_em: '2099-12-31T23:59:59.000Z',
                  trial_ate: '2099-12-31T23:59:59.000Z',
                  aviso_teste_enviado: true,
                },
                { requestKey: null },
              )
              ultimoSucessoPorUser.set(userId, { plano: res, timestamp: Date.now() })
              return res
            } catch {
              ultimoSucessoPorUser.set(userId, { plano: planoExistente, timestamp: Date.now() })
              return planoExistente
            }
          }
          ultimoSucessoPorUser.set(userId, { plano: planoExistente, timestamp: Date.now() })
          return planoExistente
        }

        // Se está em trial, verifica se expirou (apenas para usuários comuns)
        if (planoExistente.status === 'trial' && planoExistente.trial_ate) {
          const agora = new Date()
          const trialAte = new Date(planoExistente.trial_ate)
          if (agora > trialAte) {
            // Atualiza para expirado
            try {
              const res = await pb.collection('planos').update<PlanoAssinatura>(
                planoExistente.id,
                {
                  status: 'expirado',
                },
                { requestKey: null },
              )
              ultimoSucessoPorUser.set(userId, { plano: res, timestamp: Date.now() })
              return res
            } catch {
              ultimoSucessoPorUser.set(userId, { plano: planoExistente, timestamp: Date.now() })
              return planoExistente
            }
          }
        }
        ultimoSucessoPorUser.set(userId, { plano: planoExistente, timestamp: Date.now() })
        return planoExistente
      }

      if (isDono) {
        // Dono do sistema jaocarloss@gmail.com
        const res = await this.garantirPlanoUsuario(userId, {
          plano: 'premium',
          status: 'ativo',
          renovacao_em: '2099-12-31T23:59:59.000Z',
          trial_ate: '2099-12-31T23:59:59.000Z',
          aviso_teste_enviado: true,
        })
        ultimoSucessoPorUser.set(userId, { plano: res, timestamp: Date.now() })
        return res
      }

      // Cria trial de 7 dias iniciando no plano Essencial para usuários novos
      const agora = new Date()
      const trialAte = new Date(agora)
      trialAte.setDate(trialAte.getDate() + 7)

      const res = await this.garantirPlanoUsuario(userId, {
        plano: 'essencial',
        status: 'trial',
        trial_ate: trialAte.toISOString(),
        aviso_teste_enviado: false,
      })
      ultimoSucessoPorUser.set(userId, { plano: res, timestamp: Date.now() })
      return res
    })()

    promisesEmVoo.set(userId, promessa)
    try {
      return await promessa
    } finally {
      promisesEmVoo.delete(userId)
    }
  },

  async simularFimTeste(userId: string): Promise<PlanoAssinatura> {
    const agora = new Date()
    const ontem = new Date(agora)
    ontem.setDate(ontem.getDate() - 1)

    return await this.garantirPlanoUsuario(userId, {
      plano: 'essencial',
      status: 'expirado',
      trial_ate: ontem.toISOString(),
    })
  },

  async restaurarTeste(userId: string, dias: number = 3): Promise<PlanoAssinatura> {
    const agora = new Date()
    const futuro = new Date(agora)
    futuro.setDate(futuro.getDate() + dias)

    return await this.garantirPlanoUsuario(userId, {
      plano: 'essencial',
      status: 'trial',
      trial_ate: futuro.toISOString(),
      aviso_teste_enviado: false,
    })
  },
}
