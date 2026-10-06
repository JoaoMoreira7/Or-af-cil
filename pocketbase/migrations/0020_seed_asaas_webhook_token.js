migrate(
  (app) => {
    // 1. Verificar se o token de webhook já existe na collection 'configuracoes_sistema'
    try {
      const existente = app.findFirstRecordByData(
        'configuracoes_sistema',
        'chave',
        'asaas_webhook_token',
      )
      if (existente && existente.getString('valor')) {
        return // Já configurado
      }
    } catch (_) {}

    // 2. Gerar token seguro (prefixo 'whsec_' + 48 caracteres aleatórios criptograficamente seguros)
    const tokenAleatorio = 'whsec_' + $security.randomString(48)
    const agora = new Date().toISOString()

    const col = app.findCollectionByNameOrId('configuracoes_sistema')
    const record = new Record(col)
    record.set('chave', 'asaas_webhook_token')
    record.set('valor', tokenAleatorio)
    record.set(
      'descricao',
      'Token de autenticação do Webhook Asaas para validação do cabeçalho asaas-access-token',
    )
    record.set('tipo', 'secret')
    record.set('ultima_verificacao', agora)
    record.set('status_verificacao', 'ativo')
    record.set('metadados', {
      gerado_por: 'migracao_0020_bootstrap',
      gerado_em: agora,
    })

    app.save(record)
  },
  (app) => {
    try {
      const rec = app.findFirstRecordByData('configuracoes_sistema', 'chave', 'asaas_webhook_token')
      app.delete(rec)
    } catch (_) {}
  },
)
