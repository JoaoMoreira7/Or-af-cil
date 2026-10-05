/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Criação da coleção 'pagamentos' (registro oficial de vendas de assinaturas)
    const pagamentos = new Collection({
      name: 'pagamentos',
      type: 'base',
      // Regra de listagem e visualização: o dono vê apenas seus pagamentos; admin (ou o dono jaocarloss@gmail.com) vê todos
      listRule:
        "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.admin = true || @request.auth.email = 'jaocarloss@gmail.com')",
      viewRule:
        "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.admin = true || @request.auth.email = 'jaocarloss@gmail.com')",
      createRule:
        "@request.auth.id != '' && (@request.body.user_id = @request.auth.id || @request.auth.admin = true || @request.auth.email = 'jaocarloss@gmail.com')",
      updateRule:
        "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.admin = true || @request.auth.email = 'jaocarloss@gmail.com')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.admin = true || @request.auth.email = 'jaocarloss@gmail.com')",
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'valor',
          type: 'number',
          required: true,
        },
        {
          name: 'forma_pagamento',
          type: 'select',
          required: true,
          values: ['pix', 'cartao', 'boleto'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pago', 'pendente', 'cancelado'],
          maxSelect: 1,
        },
        {
          name: 'data_compra',
          type: 'date',
          required: true,
        },
        {
          name: 'data_vencimento',
          type: 'date',
          required: true,
        },
        {
          name: 'referencia_transacao',
          type: 'text',
          required: true,
        },
        {
          name: 'plano_nome',
          type: 'text',
        },
        {
          name: 'metadados',
          type: 'json',
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
        'CREATE INDEX idx_pagamentos_user_id ON pagamentos (user_id)',
        'CREATE INDEX idx_pagamentos_status ON pagamentos (status)',
        'CREATE INDEX idx_pagamentos_forma ON pagamentos (forma_pagamento)',
        'CREATE INDEX idx_pagamentos_data_compra ON pagamentos (data_compra DESC)',
        'CREATE INDEX idx_pagamentos_created ON pagamentos (created DESC)',
      ],
    })
    app.save(pagamentos)

    // Seed inicial: se existir o usuário jaocarloss@gmail.com, registra uma primeira venda de homologação
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'jaocarloss@gmail.com')
      if (user) {
        const agora = new Date()
        const renovacao = new Date(agora)
        renovacao.setDate(renovacao.getDate() + 30)

        const col = app.findCollectionByNameOrId('pagamentos')
        const rec = new Record(col)
        rec.set('user_id', user.id)
        rec.set('valor', 49.9)
        rec.set('forma_pagamento', 'pix')
        rec.set('status', 'pago')
        rec.set('data_compra', agora.toISOString())
        rec.set('data_vencimento', renovacao.toISOString())
        rec.set('referencia_transacao', 'OF-PIX-HOMOLOG-001')
        rec.set('plano_nome', 'Starter')
        rec.set('metadados', {
          modo: 'simulado',
          gateway: 'simulado',
          descricao: 'Assinatura Plano Starter — OrçaFácil',
        })
        app.save(rec)
      }
    } catch (e) {
      console.log('Seed de pagamento para admin ignorado ou já presente:', e)
    }
  },
  (app) => {
    try {
      const pagamentos = app.findCollectionByNameOrId('pagamentos')
      app.delete(pagamentos)
    } catch (_) {}
  },
)
