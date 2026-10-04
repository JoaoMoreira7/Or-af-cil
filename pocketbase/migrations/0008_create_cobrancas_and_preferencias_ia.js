/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Cria a coleção 'cobrancas' para simulação de cobranças vinculadas aos orçamentos
    const cobrancas = new Collection({
      name: 'cobrancas',
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
          name: 'orcamento_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('orcamentos').id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'cliente_id',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('clientes').id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'cliente_nome',
          type: 'text',
          required: true,
        },
        {
          name: 'orcamento_numero',
          type: 'text',
          required: true,
        },
        {
          name: 'valor',
          type: 'number',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'pago'],
          maxSelect: 1,
        },
        {
          name: 'codigo_pix',
          type: 'text',
        },
        {
          name: 'pago_em',
          type: 'date',
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
        'CREATE INDEX idx_cobrancas_user_id ON cobrancas (user_id)',
        'CREATE INDEX idx_cobrancas_orcamento_id ON cobrancas (orcamento_id)',
        'CREATE INDEX idx_cobrancas_status ON cobrancas (status)',
        'CREATE INDEX idx_cobrancas_created ON cobrancas (created DESC)',
      ],
    })
    app.save(cobrancas)

    // 2. Cria a coleção 'preferencias_ia' para personalizar o assistente por usuário
    const preferenciasIa = new Collection({
      name: 'preferencias_ia',
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
          name: 'nome_preferido',
          type: 'text',
        },
        {
          name: 'tom_resposta',
          type: 'select',
          required: true,
          values: ['formal', 'amigavel', 'direto'],
          maxSelect: 1,
        },
        {
          name: 'usar_emojis',
          type: 'bool',
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
      indexes: ['CREATE UNIQUE INDEX idx_pref_ia_user_id ON preferencias_ia (user_id)'],
    })
    app.save(preferenciasIa)

    // 3. Atualiza coleção 'acoes_voz' para aceitar os novos tipos de ação:
    // 'gerar_cobranca', 'baixa_pagamento', 'atualizar_preferencias_ia'
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
        ]
        app.save(colAcoes)
      }
    } catch (e) {
      console.log('Aviso ao atualizar tipo_acao de acoes_voz:', e)
    }
  },
  (app) => {
    try {
      const cobrancas = app.findCollectionByNameOrId('cobrancas')
      app.delete(cobrancas)
    } catch (_) {}

    try {
      const preferenciasIa = app.findCollectionByNameOrId('preferencias_ia')
      app.delete(preferenciasIa)
    } catch (_) {}
  },
)
