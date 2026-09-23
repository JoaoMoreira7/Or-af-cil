/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Cria a coleção 'audios' para histórico de transcrições e interpretações
    const audios = new Collection({
      name: 'audios',
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
          name: 'transcricao_bruta',
          type: 'text',
          required: true,
        },
        {
          name: 'transcricao_corrigida',
          type: 'text',
        },
        {
          name: 'contexto',
          type: 'select',
          required: true,
          values: ['orcamento', 'cliente', 'comando_status', 'geral'],
          maxSelect: 1,
        },
        {
          name: 'resultado_json',
          type: 'json',
        },
        {
          name: 'confianca',
          type: 'select',
          values: ['alta', 'media', 'baixa'],
          maxSelect: 1,
        },
        {
          name: 'comando_executado',
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
      indexes: [
        'CREATE INDEX idx_audios_user_id ON audios (user_id)',
        'CREATE INDEX idx_audios_contexto ON audios (contexto)',
        'CREATE INDEX idx_audios_created ON audios (created DESC)',
      ],
    })
    app.save(audios)

    // 2. Concede ao agente nativo acesso de leitura/listagem na coleção orcamentos
    // para permitir raciocínio sobre identificadores e status
    try {
      $ai.agents.putTools(app, 'orcamento-assistente', [
        { collection: 'orcamentos', perms: { read: true, list: true } },
      ])
    } catch (_) {}
  },
  (app) => {
    try {
      $ai.agents.deleteTools(app, 'orcamento-assistente', ['orcamentos'])
    } catch (_) {}
    try {
      const audios = app.findCollectionByNameOrId('audios')
      app.delete(audios)
    } catch (_) {}
  },
)
