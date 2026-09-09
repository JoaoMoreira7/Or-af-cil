/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. clientes collection
    const clientes = new Collection({
      name: 'clientes',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user_id = @request.auth.id",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'telefone', type: 'text' },
        { name: 'empresa', type: 'text' },
        { name: 'endereco', type: 'text' },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_clientes_user_id ON clientes (user_id)',
        'CREATE INDEX idx_clientes_created ON clientes (created DESC)',
      ],
    })
    app.save(clientes)

    const clientesId = app.findCollectionByNameOrId('clientes').id

    // 2. orcamentos collection
    const orcamentos = new Collection({
      name: 'orcamentos',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user_id = @request.auth.id",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        {
          name: 'cliente_id',
          type: 'relation',
          required: true,
          collectionId: clientesId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        { name: 'itens', type: 'json' },
        { name: 'impostos', type: 'number' },
        { name: 'subtotal', type: 'number', required: true },
        { name: 'valor_total', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'enviado', 'aprovado', 'rejeitado', 'cancelado'],
          maxSelect: 1,
        },
        { name: 'numero', type: 'text', required: true },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_orcamentos_user_id ON orcamentos (user_id)',
        'CREATE INDEX idx_orcamentos_status ON orcamentos (status)',
        'CREATE INDEX idx_orcamentos_created ON orcamentos (created DESC)',
      ],
    })
    app.save(orcamentos)

    // 3. planos collection
    const planos = new Collection({
      name: 'planos',
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
        { name: 'plano', type: 'select', required: true, values: ['starter', 'pro'], maxSelect: 1 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'inativo'],
          maxSelect: 1,
        },
        { name: 'renovacao_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_planos_user_id ON planos (user_id)'],
    })
    app.save(planos)

    // 4. Skip Cloud Native AI Agent
    $ai.agents.define(app, {
      slug: 'orcamento-assistente',
      name: 'Assistente de Orçamentos',
      description: 'Gera itens de orçamentos e sugere clientes com base em serviços.',
      systemPrompt:
        'Você é o assistente de orçamentos da JM Sistemas. Com base na descrição do serviço fornecida pelo usuário, gere itens de orçamento realistas e detalhados (descrição, quantidade, valor unitário em reais). Sugira um cliente existente se a descrição do serviço corresponder a serviços anteriores desse cliente. Seja conciso e prático. Sempre cite as fontes quando usar dados do cadastro de clientes.',
      tier: 'fast',
      tools: [{ collection: 'clientes', perms: { read: true, list: true } }],
      memory: [
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Como um orçamento padrão é estruturado?',
                answer:
                  'Um orçamento típico inclui mão de obra, materiais, suprimentos técnicos, transporte ou custos operacionais e taxa de impostos/margem.',
              },
              {
                question: 'Qual o valor médio de serviços de TI e consultoria?',
                answer:
                  'Serviços de manutenção de TI geralmente cobram R$ 80-150 por hora. Consultorias de software e infraestrutura cobram entre R$ 120 e R$ 250 por hora.',
              },
              {
                question: 'Qual o valor médio para desenvolvimento web e automação?',
                answer:
                  'Desenvolvimento de páginas e portais institucionais varia de R$ 1.500 a R$ 5.000. Configuração de banco de dados e servidores varia de R$ 600 a R$ 2.000.',
              },
              {
                question: 'Qual a taxa típica de impostos em orçamentos?',
                answer:
                  'Empresas enquadradas no Simples Nacional ou com ISS/ICMS geralmente aplicam entre 5% a 15% de encargos sobre serviços.',
              },
            ],
          },
        },
      ],
    })
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'orcamento-assistente')
    } catch (_) {}
    try {
      const planos = app.findCollectionByNameOrId('planos')
      app.delete(planos)
    } catch (_) {}
    try {
      const orcamentos = app.findCollectionByNameOrId('orcamentos')
      app.delete(orcamentos)
    } catch (_) {}
    try {
      const clientes = app.findCollectionByNameOrId('clientes')
      app.delete(clientes)
    } catch (_) {}
  },
)
