import pb from '@/lib/pocketbase/client'
import {
  DocumentoLido,
  DocumentoTipo,
  DocumentoAcaoAplicada,
  DocumentoDadosExtraidos,
} from '@/types'

export interface AnalisarDocumentoResposta {
  sucesso: boolean
  leitura_automatica: boolean
  modo_visao_suportado: boolean
  mensagem_assistente: string
  preferencias_aplicadas?: {
    nome_preferido?: string
    tom_resposta?: string
    usar_emojis?: boolean
  }
  dados_extraidos: DocumentoDadosExtraidos
}

export interface CriarDocumentoLidoParams {
  user_id: string
  foto?: File | Blob
  tipo_documento: DocumentoTipo
  fornecedor?: string
  data_documento?: string
  valor_total?: number
  valor_impostos?: number
  dados_extraidos: DocumentoDadosExtraidos
  acao_aplicada?: DocumentoAcaoAplicada
  orcamento_vinculado_id?: string
  orcamento_gerado_id?: string
  observacoes?: string
}

export const documentosLidosService = {
  /**
   * Envia imagem ou dados para a rota do backend /backend/v1/analisar-documento
   */
  async analisarDocumento(params: {
    imagemBase64?: string
    arquivo?: File | Blob
    texto?: string
    nomeArquivo?: string
  }): Promise<AnalisarDocumentoResposta> {
    const formData = new FormData()
    if (params.arquivo) {
      formData.append('foto', params.arquivo, params.nomeArquivo || 'documento.jpg')
    }
    if (params.imagemBase64) {
      formData.append('imagem_base64', params.imagemBase64)
    }
    if (params.texto) {
      formData.append('texto', params.texto)
    }
    if (params.nomeArquivo) {
      formData.append('nome_arquivo', params.nomeArquivo)
    }

    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/analisar-documento`,
      {
        method: 'POST',
        headers: {
          Authorization: pb.authStore.token,
        },
        body: formData,
      },
    )

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Falha ao analisar documento com IA')
    }

    return data
  },

  /**
   * Salva o registro do documento lido na coleção 'documentos_lidos'
   */
  async salvar(params: CriarDocumentoLidoParams): Promise<DocumentoLido> {
    const formData = new FormData()
    formData.append('user_id', params.user_id)
    formData.append('tipo_documento', params.tipo_documento)
    if (params.fornecedor) formData.append('fornecedor', params.fornecedor)
    if (params.data_documento) formData.append('data_documento', params.data_documento)
    if (params.valor_total !== undefined) formData.append('valor_total', String(params.valor_total))
    if (params.valor_impostos !== undefined)
      formData.append('valor_impostos', String(params.valor_impostos))
    formData.append('dados_extraidos', JSON.stringify(params.dados_extraidos))
    formData.append('acao_aplicada', params.acao_aplicada || 'apenas_salvo')
    if (params.orcamento_vinculado_id)
      formData.append('orcamento_vinculado_id', params.orcamento_vinculado_id)
    if (params.orcamento_gerado_id)
      formData.append('orcamento_gerado_id', params.orcamento_gerado_id)
    if (params.observacoes) formData.append('observacoes', params.observacoes)
    if (params.foto) {
      formData.append('foto', params.foto)
    }

    const record = await pb.collection('documentos_lidos').create(formData, {
      expand: 'orcamento_vinculado_id,orcamento_gerado_id',
    })

    return record as unknown as DocumentoLido
  },

  /**
   * Atualiza a ação aplicada em um documento lido (ex: vinculado a orçamento)
   */
  async atualizarAcao(
    id: string,
    params: {
      acao_aplicada: DocumentoAcaoAplicada
      orcamento_vinculado_id?: string | null
      orcamento_gerado_id?: string | null
    },
  ): Promise<DocumentoLido> {
    const record = await pb.collection('documentos_lidos').update(id, params)
    return record as unknown as DocumentoLido
  },

  /**
   * Lista os documentos lidos do usuário ordenados pelos mais recentes
   */
  async listar(userId?: string): Promise<DocumentoLido[]> {
    const uid = userId || pb.authStore.record?.id
    if (!uid) return []

    try {
      const records = await pb.collection('documentos_lidos').getFullList({
        filter: `user_id = "${uid}"`,
        sort: '-created',
        expand: 'orcamento_vinculado_id,orcamento_gerado_id',
      })
      return records as unknown as DocumentoLido[]
    } catch (err) {
      console.warn('Erro ao listar documentos lidos:', err)
      return []
    }
  },

  /**
   * Exclui um documento lido
   */
  async excluir(id: string): Promise<void> {
    await pb.collection('documentos_lidos').delete(id)
  },

  /**
   * Obtém a URL pública do arquivo de imagem do PocketBase
   */
  obterUrlFoto(doc: DocumentoLido): string | null {
    if (!doc || !doc.foto) return null
    return pb.files.getURL(doc as unknown as { [key: string]: unknown }, doc.foto)
  },
}
