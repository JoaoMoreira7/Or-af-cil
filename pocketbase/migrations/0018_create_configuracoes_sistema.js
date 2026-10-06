migrate(
  (app) => {
    // Cria a coleção 'configuracoes_sistema' com todas as regras bloqueadas para usuários normais (RLS null).
    // Apenas superusuários ou hooks server-side ($app) acessam essa coleção.
    const collection = new Collection({
      name: 'configuracoes_sistema',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'chave', type: 'text', required: true },
        { name: 'valor', type: 'text', required: false },
        { name: 'descricao', type: 'text', required: false },
        { name: 'tipo', type: 'text', required: false },
        { name: 'ultima_verificacao', type: 'date', required: false },
        { name: 'status_verificacao', type: 'text', required: false },
        { name: 'metadados', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_configuracoes_sistema_chave ON configuracoes_sistema (chave)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('configuracoes_sistema')
      app.delete(collection)
    } catch (_) {}
  },
)
