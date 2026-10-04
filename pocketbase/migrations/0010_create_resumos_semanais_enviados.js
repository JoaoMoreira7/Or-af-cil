/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Cria a coleção resumos_semanais_enviados para controle de duplicidade de envio
    const col = new Collection({
      name: 'resumos_semanais_enviados',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.admin = true)",
      viewRule:
        "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.admin = true)",
      createRule:
        "@request.auth.id != '' && (@request.body.user_id = @request.auth.id || @request.auth.admin = true)",
      updateRule: "@request.auth.id != '' && @request.auth.admin = true",
      deleteRule: "@request.auth.id != '' && @request.auth.admin = true",
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
          name: 'chave_semana',
          type: 'text',
          required: true,
        },
        {
          name: 'email_destinatario',
          type: 'email',
          required: false,
        },
        {
          name: 'enviado_em',
          type: 'date',
          required: false,
        },
        {
          name: 'status_envio',
          type: 'select',
          required: true,
          values: ['sucesso', 'falha_envio', 'fallback'],
          maxSelect: 1,
        },
        {
          name: 'usou_ia',
          type: 'bool',
          required: false,
        },
        {
          name: 'metricas',
          type: 'json',
          required: false,
        },
        {
          name: 'assunto',
          type: 'text',
          required: false,
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
        'CREATE UNIQUE INDEX idx_resumos_semanais_user_semana ON resumos_semanais_enviados (user_id, chave_semana)',
        'CREATE INDEX idx_resumos_semanais_user_created ON resumos_semanais_enviados (user_id, created DESC)',
      ],
    })
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('resumos_semanais_enviados')
      app.delete(col)
    } catch (_) {}
  },
)
