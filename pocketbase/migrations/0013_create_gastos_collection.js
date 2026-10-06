/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualiza acoes_voz para incluir 'registro_gasto' nos valores do select tipo_acao se necessário
    try {
      const acoesCol = app.findCollectionByNameOrId('acoes_voz')
      const tipoAcaoField = acoesCol.fields.getByName('tipo_acao')
      if (tipoAcaoField && tipoAcaoField.values) {
        if (tipoAcaoField.values.indexOf('registro_gasto') === -1) {
          tipoAcaoField.values.push('registro_gasto')
          app.save(acoesCol)
        }
      }
    } catch (_) {}

    // 2. Atualiza audios para incluir 'gasto' no select contexto se necessário
    try {
      const audiosCol = app.findCollectionByNameOrId('audios')
      const contextoField = audiosCol.fields.getByName('contexto')
      if (contextoField && contextoField.values) {
        if (contextoField.values.indexOf('gasto') === -1) {
          contextoField.values.push('gasto')
          app.save(audiosCol)
        }
      }
    } catch (_) {}

    // 3. Cria a coleção 'gastos'
    const orcamentosColId = app.findCollectionByNameOrId('orcamentos').id

    const gastos = new Collection({
      name: 'gastos',
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
          name: 'descricao',
          type: 'text',
          required: true,
        },
        {
          name: 'valor',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          values: [
            'Material',
            'Transporte',
            'Alimentação',
            'Moradia/Aluguel',
            'Ferramentas',
            'Serviços terceirizados',
            'Impostos/Taxas',
            'Outros',
          ],
          maxSelect: 1,
        },
        {
          name: 'data',
          type: 'date',
          required: true,
        },
        {
          name: 'origem',
          type: 'select',
          required: true,
          values: ['voz', 'manual', 'documento'],
          maxSelect: 1,
        },
        {
          name: 'orcamento_vinculado',
          type: 'relation',
          required: false,
          collectionId: orcamentosColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'observacoes',
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
        'CREATE INDEX idx_gastos_user_id ON gastos (user_id)',
        'CREATE INDEX idx_gastos_data ON gastos (data DESC)',
        'CREATE INDEX idx_gastos_categoria ON gastos (categoria)',
        'CREATE INDEX idx_gastos_orcamento ON gastos (orcamento_vinculado)',
        'CREATE INDEX idx_gastos_created ON gastos (created DESC)',
      ],
    })

    app.save(gastos)
  },
  (app) => {
    try {
      const gastos = app.findCollectionByNameOrId('gastos')
      app.delete(gastos)
    } catch (_) {}
  },
)
