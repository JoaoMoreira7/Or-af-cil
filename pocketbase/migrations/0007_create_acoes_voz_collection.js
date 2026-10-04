/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Cria a coleção 'acoes_voz' para registrar cada ação aplicada por comandos de voz
    const acoesVoz = new Collection({
      name: 'acoes_voz',
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
          name: 'tipo_acao',
          type: 'select',
          required: true,
          values: ['criacao_cliente', 'criacao_orcamento', 'mudanca_status'],
          maxSelect: 1,
        },
        {
          name: 'titulo',
          type: 'text',
          required: true,
        },
        {
          name: 'descricao_resumo',
          type: 'text',
        },
        {
          name: 'registro_id',
          type: 'text',
        },
        {
          name: 'dados_aplicados',
          type: 'json',
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'desfeito'],
          maxSelect: 1,
        },
        {
          name: 'desfeito_em',
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
        'CREATE INDEX idx_acoes_voz_user_id ON acoes_voz (user_id)',
        'CREATE INDEX idx_acoes_voz_status ON acoes_voz (status)',
        'CREATE INDEX idx_acoes_voz_created ON acoes_voz (created DESC)',
      ],
    })
    app.save(acoesVoz)
  },
  (app) => {
    try {
      const acoesVoz = app.findCollectionByNameOrId('acoes_voz')
      app.delete(acoesVoz)
    } catch (_) {}
  },
)
