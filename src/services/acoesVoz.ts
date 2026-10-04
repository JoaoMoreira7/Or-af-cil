import pb from '@/lib/pocketbase/client'
import { AcaoVozRegistro, AcaoVozTipo, OrçamentoStatus } from '@/types'
import { clientesService } from './clientes'
import { orcamentosService } from './orcamentos'

export interface CriarAcaoVozParams {
  tipo_acao: AcaoVozTipo
  titulo: string
  descricao_resumo?: string
  registro_id?: string
  dados_aplicados: Record<string, unknown>
  user_id: string
}

export const acoesVozService = {
  /**
   * Salva uma ação aplicada por voz
   */
  async registrar(params: CriarAcaoVozParams): Promise<AcaoVozRegistro> {
    const record = await pb.collection('acoes_voz').create({
      user_id: params.user_id,
      tipo_acao: params.tipo_acao,
      titulo: params.titulo,
      descricao_resumo: params.descricao_resumo || '',
      registro_id: params.registro_id || '',
      dados_aplicados: params.dados_aplicados,
      status: 'ativo',
    })

    return record as unknown as AcaoVozRegistro
  },

  /**
   * Lista ações das últimas 24 horas para o usuário atual
   */
  async listarUltimas24Horas(userId?: string): Promise<AcaoVozRegistro[]> {
    const uid = userId || pb.authStore.record?.id
    if (!uid) return []

    // Calcula timestamp de 24 horas atrás em ISO
    const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const filter = `user_id = "${uid}" && created >= "${limite24h}"`

    try {
      const records = await pb.collection('acoes_voz').getFullList({
        filter,
        sort: '-created',
      })
      return records as unknown as AcaoVozRegistro[]
    } catch (err) {
      console.warn('Erro ao listar ações de voz:', err)
      return []
    }
  },

  /**
   * Obtém a ação de voz ativa mais recente nas últimas 24h para desfazer por comando falado
   */
  async obterUltimaAcaoAtiva24h(userId?: string): Promise<AcaoVozRegistro | null> {
    const uid = userId || pb.authStore.record?.id
    if (!uid) return null

    const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const filter = `user_id = "${uid}" && status = "ativo" && created >= "${limite24h}"`

    try {
      const record = await pb.collection('acoes_voz').getFirstListItem(filter, {
        sort: '-created',
      })
      return (record as unknown as AcaoVozRegistro) || null
    } catch {
      return null
    }
  },

  /**
   * Desfaz uma ação aplicada por voz:
   * - criacao_cliente: exclui o cliente criado
   * - criacao_orcamento: exclui o orçamento criado (e cliente secundário se tiver sido criado junto)
   * - mudanca_status: restaura o status anterior do orçamento
   * Marca a ação como 'desfeito'
   */
  async desfazer(acao: AcaoVozRegistro): Promise<{ sucesso: boolean; mensagem: string }> {
    if (acao.status === 'desfeito') {
      return { sucesso: false, mensagem: 'Esta ação já foi desfeita anteriormente.' }
    }

    const agoraIso = new Date().toISOString()
    const dados = (acao.dados_aplicados || {}) as Record<string, unknown>

    try {
      if (acao.tipo_acao === 'criacao_cliente') {
        const clienteId = acao.registro_id || (dados.cliente_id as string)
        if (clienteId) {
          try {
            await clientesService.excluir(clienteId)
          } catch (err) {
            console.warn('Erro ao excluir cliente no desfazer:', err)
            throw new Error('Não foi possível excluir o cliente (verifique se já há vínculos).')
          }
        }
      } else if (acao.tipo_acao === 'criacao_orcamento') {
        const orcamentoId = acao.registro_id || (dados.orcamento_id as string)
        if (orcamentoId) {
          try {
            await orcamentosService.excluir(orcamentoId)
          } catch (err) {
            console.warn('Erro ao excluir orçamento no desfazer:', err)
            throw new Error('Não foi possível excluir o orçamento criado.')
          }
        }
        // Se um cliente novo também foi criado especificamente junto com este orçamento e marcado para remoção:
        const clienteCriadoId = dados.cliente_criado_junto_id as string | undefined
        if (clienteCriadoId) {
          try {
            await clientesService.excluir(clienteCriadoId)
          } catch {
            // Ignora se não puder excluir cliente associado
          }
        }
      } else if (acao.tipo_acao === 'mudanca_status') {
        const orcamentoId = acao.registro_id || (dados.orcamento_id as string)
        const statusAnterior = (dados.status_anterior as OrçamentoStatus) || 'rascunho'
        if (orcamentoId) {
          await orcamentosService.atualizarStatus(orcamentoId, statusAnterior)
        }
      }

      // Atualiza o registro na coleção acoes_voz para status = 'desfeito'
      await pb.collection('acoes_voz').update(acao.id, {
        status: 'desfeito',
        desfeito_em: agoraIso,
      })

      return {
        sucesso: true,
        mensagem: `Ação "${acao.titulo}" desfeita com sucesso.`,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao reverter ação'
      return { sucesso: false, mensagem: msg }
    }
  },
}
