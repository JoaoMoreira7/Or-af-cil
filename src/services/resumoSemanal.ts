import pb from '@/lib/pocketbase/client'
import { ResumoSemanalData } from '@/types'

/**
 * Retorna a chave da semana do ano no formato YYYY-WW para o cache semanal.
 * Uma nova chave é gerada a cada semana (segunda-feira).
 */
export function getChaveSemanaAtual(d = new Date()): string {
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
  return `${target.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

const STORAGE_KEY_PREFIX = 'orcafacil_resumo_semanal_'

export interface DisparoEmailResumoResultado {
  sucesso: boolean
  ja_enviado?: boolean
  destinatario?: string
  chave_semana?: string
  usou_ia?: boolean
  registro_id?: string
  mensagem?: string
  error?: string
}

export interface DisparoTesteResumoResultado {
  sucesso: boolean
  email_enviado?: boolean
  destinatario?: string
  chave_semana?: string
  usou_ia?: boolean
  metricas?: Record<string, unknown>
  aviso_envio?: string
  mensagem?: string
  error?: string
}

export const resumoSemanalService = {
  /**
   * Dispara e-mail de teste do resumo semanal para o endereço informado (apenas admin).
   * Não grava na coleção de enviados para não bloquear o envio real de segunda-feira.
   */
  async dispararTesteEmail(email: string): Promise<DisparoTesteResumoResultado> {
    if (!pb.authStore.token) {
      throw new Error('Usuário não autenticado')
    }

    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/resumo-semanal-teste`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      },
    )

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error || 'Erro ao disparar e-mail de teste do resumo semanal')
    }

    return data as DisparoTesteResumoResultado
  },

  /**
   * Dispara ou força o envio do e-mail do resumo semanal para o usuário autenticado.
   */
  async dispararEmail(options?: {
    userId?: string
    forcarReenvio?: boolean
  }): Promise<DisparoEmailResumoResultado> {
    const uid = options?.userId || pb.authStore.record?.id
    if (!uid) {
      throw new Error('Usuário não autenticado')
    }

    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/resumo-semanal/enviar-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          userId: uid,
          forcarReenvio: !!options?.forcarReenvio,
        }),
      },
    )

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error || 'Erro ao disparar e-mail do resumo semanal')
    }

    return data as DisparoEmailResumoResultado
  },

  /**
   * Obtém o resumo semanal do usuário.
   * Se já houver resumo em cache para a semana atual (e forcarRegeneracao = false),
   * retorna o resumo em cache sem consumir a IA.
   */
  async obter(options?: {
    forcarRegeneracao?: boolean
    userId?: string
  }): Promise<ResumoSemanalData> {
    const uid = options?.userId || pb.authStore.record?.id
    if (!uid) {
      throw new Error('Usuário não autenticado')
    }

    const semanaChave = getChaveSemanaAtual()
    const storageKey = `${STORAGE_KEY_PREFIX}${uid}_${semanaChave}`

    // 1. Tenta carregar do cache caso não tenha sido forçada a regeneração
    if (!options?.forcarRegeneracao) {
      try {
        const cachedStr = localStorage.getItem(storageKey)
        if (cachedStr) {
          const cachedData = JSON.parse(cachedStr) as ResumoSemanalData
          if (cachedData?.resumo_texto && cachedData.sucesso) {
            return {
              ...cachedData,
              cache_chave: semanaChave,
            }
          }
        }
      } catch (cacheErr) {
        console.warn('Falha ao ler cache de resumo semanal:', cacheErr)
      }
    }

    // 2. Chama backend /backend/v1/resumo-semanal
    try {
      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/resumo-semanal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          userId: uid,
        }),
      })

      if (!res.ok) {
        const erroJson = await res.json().catch(() => null)
        throw new Error(erroJson?.error || 'Erro ao gerar resumo semanal')
      }

      const data = (await res.json()) as ResumoSemanalData
      data.cache_chave = semanaChave

      // Salva no cache do navegador para a semana
      try {
        localStorage.setItem(storageKey, JSON.stringify(data))
      } catch (errSaveCache) {
        console.warn('Falha ao salvar cache de resumo semanal:', errSaveCache)
      }

      return data
    } catch (err) {
      // 3. Fallback defensivo com dados locais se a rede falhar
      console.warn('Erro ao chamar backend de resumo semanal, gerando fallback:', err)
      const fallback: ResumoSemanalData = {
        sucesso: true,
        resumo_texto:
          'Olá! Aqui é o seu resumo semanal em áudio. Esta semana seus orçamentos e atendimentos estão em andamento. Acesse o menu de orçamentos para acompanhar as respostas pendentes e manter seu negócio acelerado. Tenha uma excelente semana!',
        metricas: {
          orcamentos_criados: 0,
          orcamentos_enviados: 0,
          orcamentos_aprovados: 0,
          valor_aprovado: 0,
          cobrancas_pagas: 0,
          valor_pago: 0,
          cobrancas_pendentes: 0,
          valor_pendente: 0,
          novos_clientes: 0,
          orcamentos_sem_resposta_5_dias: 0,
        },
        gerado_em: new Date().toISOString(),
        cache_chave: semanaChave,
      }
      return fallback
    }
  },

  /**
   * Limpa o cache da semana atual para o usuário
   */
  limparCache(userId?: string): void {
    const uid = userId || pb.authStore.record?.id
    if (!uid) return
    const semanaChave = getChaveSemanaAtual()
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${uid}_${semanaChave}`)
    } catch {
      /* noop */
    }
  },
}
