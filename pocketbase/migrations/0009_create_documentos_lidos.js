/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Cria a coleção 'documentos_lidos' para armazenar fotos de notas, recibos e orçamentos
    const documentosLidos = new Collection({
      name: 'documentos_lidos',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user_id = @request.auth.id",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'foto',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/heic',
            'application/pdf',
          ],
        },
        {
          name: 'tipo_documento',
          type: 'select',
          required: true,
          values: [
            'nota_fiscal',
            'recibo',
            'orcamento_papel',
            'lista_materiais',
            'comprovante',
            'outro',
          ],
          maxSelect: 1,
        },
        {
          name: 'fornecedor',
          type: 'text',
        },
        {
          name: 'data_documento',
          type: 'text',
        },
        {
          name: 'valor_total',
          type: 'number',
        },
        {
          name: 'valor_impostos',
          type: 'number',
        },
        {
          name: 'dados_extraidos',
          type: 'json',
        },
        {
          name: 'acao_aplicada',
          type: 'select',
          required: false,
          values: ['nenhuma', 'orcamento_criado', 'despesa_vinculada', 'apenas_salvo'],
          maxSelect: 1,
        },
        {
          name: 'orcamento_vinculado_id',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('orcamentos').id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'orcamento_gerado_id',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('orcamentos').id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'observacoes',
          type: 'text',
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_documentos_lidos_user_id ON documentos_lidos (user_id)',
        'CREATE INDEX idx_documentos_lidos_tipo ON documentos_lidos (tipo_documento)',
        'CREATE INDEX idx_documentos_lidos_created ON documentos_lidos (created DESC)',
      ],
    })
    app.save(documentosLidos)

    // 2. Atualiza a coleção 'acoes_voz' para aceitar os tipos de ação gerados pelo Assistente de Campo
    try {
      const colAcoes = app.findCollectionByNameOrId('acoes_voz')
      const campoTipoAcao = colAcoes.fields.getByName('tipo_acao')
      if (campoTipoAcao) {
        campoTipoAcao.values = [
          'criacao_cliente',
          'criacao_orcamento',
          'mudanca_status',
          'gerar_cobranca',
          'baixa_pagamento',
          'atualizar_preferencias_ia',
          'documento_orcamento',
          'documento_despesa',
        ]
        app.save(colAcoes)
      }
    } catch (e) {
      console.log('Aviso ao atualizar tipo_acao de acoes_voz para assistente de campo:', e)
    }
  },
  (app) => {
    try {
      const documentosLidos = app.findCollectionByNameOrId('documentos_lidos')
      app.delete(documentosLidos)
    } catch (_) {}
  },
)
