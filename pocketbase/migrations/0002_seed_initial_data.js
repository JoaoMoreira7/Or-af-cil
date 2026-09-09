/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const clientesCol = app.findCollectionByNameOrId('clientes')
    const orcamentosCol = app.findCollectionByNameOrId('orcamentos')
    const planosCol = app.findCollectionByNameOrId('planos')

    // 1. Seed or retrieve user
    let userRecord
    try {
      userRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'jaocarloss@gmail.com')
    } catch (_) {
      userRecord = new Record(users)
      userRecord.setEmail('jaocarloss@gmail.com')
      userRecord.setPassword('Skip@Pass')
      userRecord.setVerified(true)
      userRecord.set('name', 'João Carlos')
      app.save(userRecord)
    }

    const userId = userRecord.id

    // 2. Seed Clientes idempotently
    const seedClientsData = [
      {
        nome: 'Maria Oliveira',
        email: 'maria.oliveira@construtorahorizonte.com.br',
        telefone: '(11) 98765-4321',
        empresa: 'Construtora Horizonte Ltda',
        endereco: 'Av. Paulista, 1000 - Sala 402, São Paulo - SP',
      },
      {
        nome: 'Carlos Pereira',
        email: 'carlos@mercadobompreco.com.br',
        telefone: '(11) 97654-3210',
        empresa: 'Mercado Bom Preço',
        endereco: 'Rua do Comércio, 250, Campinas - SP',
      },
      {
        nome: 'Ana Souza',
        email: 'ana.souza@salaobelezapura.com.br',
        telefone: '(21) 99876-5432',
        empresa: 'Salão Beleza Pura',
        endereco: 'Rua das Flores, 88, Rio de Janeiro - RJ',
      },
    ]

    const clientIds = []
    for (const cData of seedClientsData) {
      let clientRecord
      try {
        clientRecord = app.findFirstRecordByData('clientes', 'email', cData.email)
      } catch (_) {
        clientRecord = new Record(clientesCol)
        clientRecord.set('nome', cData.nome)
        clientRecord.set('email', cData.email)
        clientRecord.set('telefone', cData.telefone)
        clientRecord.set('empresa', cData.empresa)
        clientRecord.set('endereco', cData.endereco)
        clientRecord.set('user_id', userId)
        app.save(clientRecord)
      }
      clientIds.push(clientRecord.id)
    }

    // 3. Seed Planos record
    try {
      app.findFirstRecordByData('planos', 'user_id', userId)
    } catch (_) {
      const planoRecord = new Record(planosCol)
      planoRecord.set('user_id', userId)
      planoRecord.set('plano', 'starter')
      planoRecord.set('status', 'ativo')
      // renovação em 30 dias
      const nextMonth = new Date()
      nextMonth.setDate(nextMonth.getDate() + 30)
      planoRecord.set('renovacao_em', nextMonth.toISOString())
      app.save(planoRecord)
    }

    // 4. Seed Orçamentos idempotently
    const seedOrcamentos = [
      {
        numero: '#001',
        cliente_id: clientIds[0], // Construtora Horizonte
        descricao: 'Implantação de rede cabeada estruturada e firewall corporativo',
        itens: [
          {
            descricao: 'Mapeamento e certificação de pontos de rede Cat6',
            quantidade: 24,
            valor_unitario: 85.0,
          },
          {
            descricao: 'Configuração de Firewall UTM e VPN segura',
            quantidade: 1,
            valor_unitario: 1450.0,
          },
          {
            descricao: 'Roteador corporativo Gigabit e Switch gerenciável 24p',
            quantidade: 1,
            valor_unitario: 2200.0,
          },
        ],
        subtotal: 5690.0,
        impostos: 8,
        valor_total: 6145.2,
        status: 'aprovado',
      },
      {
        numero: '#002',
        cliente_id: clientIds[1], // Mercado Bom Preço
        descricao: 'Sistema de monitoramento com câmeras IP e servidor de backup em nuvem',
        itens: [
          {
            descricao: 'Instalação de Câmeras IP Full HD Intelbras',
            quantidade: 8,
            valor_unitario: 320.0,
          },
          {
            descricao: 'Configuração de NVR com redundância de gravação local',
            quantidade: 1,
            valor_unitario: 1100.0,
          },
          {
            descricao: 'Licença anual de backup externo automático em nuvem',
            quantidade: 1,
            valor_unitario: 650.0,
          },
        ],
        subtotal: 4310.0,
        impostos: 5,
        valor_total: 4525.5,
        status: 'enviado',
      },
      {
        numero: '#003',
        cliente_id: clientIds[2], // Salão Beleza Pura
        descricao: 'Desenvolvimento de cardápio digital interativo e agendamento online',
        itens: [
          {
            descricao: 'Design responsivo de portal de serviços e agendamentos',
            quantidade: 1,
            valor_unitario: 1800.0,
          },
          {
            descricao: 'Integração com WhatsApp para avisos automáticos',
            quantidade: 1,
            valor_unitario: 450.0,
          },
        ],
        subtotal: 2250.0,
        impostos: 0,
        valor_total: 2250.0,
        status: 'rascunho',
      },
      {
        numero: '#004',
        cliente_id: clientIds[0], // Construtora Horizonte
        descricao: 'Upgrade do parque de estações de trabalho e migração de servidores legado',
        itens: [
          {
            descricao: 'Auditoria de desempenho e compatibilidade de hardware',
            quantidade: 1,
            valor_unitario: 800.0,
          },
          {
            descricao: 'Migração física e virtualização de 2 servidores Windows',
            quantidade: 2,
            valor_unitario: 1600.0,
          },
          {
            descricao: 'Suporte assistido pós-migração (pacote de 10 horas)',
            quantidade: 1,
            valor_unitario: 1200.0,
          },
        ],
        subtotal: 5200.0,
        impostos: 10,
        valor_total: 5720.0,
        status: 'rejeitado',
      },
    ]

    for (const orc of seedOrcamentos) {
      try {
        app.findFirstRecordByData('orcamentos', 'numero', orc.numero)
      } catch (_) {
        const rec = new Record(orcamentosCol)
        rec.set('numero', orc.numero)
        rec.set('cliente_id', orc.cliente_id)
        rec.set('descricao', orc.descricao)
        rec.set('itens', orc.itens)
        rec.set('subtotal', orc.subtotal)
        rec.set('impostos', orc.impostos)
        rec.set('valor_total', orc.valor_total)
        rec.set('status', orc.status)
        rec.set('user_id', userId)
        app.save(rec)
      }
    }
  },
  (app) => {
    // down logic is optional for seed data
  },
)
