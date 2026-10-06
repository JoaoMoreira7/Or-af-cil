// @ts-nocheck
routerAdd(
  'GET',
  '/backend/v1/admin/gateway/status',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const email = (authUser.getString('email') || '').toLowerCase().trim()
      const isDono = email === 'jaocarloss@gmail.com' || authUser.getBool('admin')
      if (!isDono) {
        return e.json(403, {
          error: 'Acesso restrito exclusivamente ao administrador (jaocarloss@gmail.com)',
        })
      }

      // 1. Resolver Chave Asaas Atual (banco configuracoes_sistema tem prioridade, fallback env)
      let apiKey = ''
      let apiKeyOrigem = 'nenhuma'
      let configRec = null

      try {
        const configRecs = $app.findRecordsByFilter(
          'configuracoes_sistema',
          "chave = 'asaas_api_key'",
          '-created',
          1,
          0,
        )
        if (configRecs.length > 0 && configRecs[0].getString('valor')) {
          apiKey = configRecs[0].getString('valor').trim()
          apiKeyOrigem = 'banco'
          configRec = configRecs[0]
        }
      } catch (_) {}

      if (!apiKey) {
        const envKey = ($os.getenv('ASAAS_API_KEY') || '').trim()
        if (envKey) {
          apiKey = envKey
          apiKeyOrigem = 'ambiente'
        }
      }

      // 2. Resolver Token do Webhook
      let webhookToken = ''
      let webhookTokenOrigem = 'nenhuma'
      try {
        const tokenRecs = $app.findRecordsByFilter(
          'configuracoes_sistema',
          "chave = 'asaas_webhook_token'",
          '-created',
          1,
          0,
        )
        if (tokenRecs.length > 0 && tokenRecs[0].getString('valor')) {
          webhookToken = tokenRecs[0].getString('valor').trim()
          webhookTokenOrigem = 'banco'
        }
      } catch (_) {}

      if (!webhookToken) {
        const envToken = ($os.getenv('ASAAS_WEBHOOK_TOKEN') || '').trim()
        if (envToken) {
          webhookToken = envToken
          webhookTokenOrigem = 'ambiente'
        }
      }

      // 3. Mascarar Chave e Token (NUNCA ecoar completos)
      const mascarar = (str) => {
        if (!str) return ''
        if (str.length <= 6) return '••••' + str.slice(-2)
        return '••••••••' + str.slice(-4)
      }

      const chaveConfigurada = Boolean(apiKey)
      const chaveMascarada = mascarar(apiKey)
      const tokenConfigurado = Boolean(webhookToken)
      const tokenMascarado = mascarar(webhookToken)

      // Identifica se é sandbox ou produção pelo padrão da chave ou URL
      // Chaves Asaas de sandbox tipicamente começam com $aact_hml_ ou similar
      let ambienteDetectado = 'producao'
      if (
        apiKey.toLowerCase().includes('sandbox') ||
        apiKey.toLowerCase().includes('hml') ||
        apiKey.startsWith('$aact_hml_')
      ) {
        ambienteDetectado = 'sandbox'
      }

      const webhookUrlOficial =
        'https://finalizacao-do-sistema-913b5.shrd00.internal.goskip.dev/backend/v1/asaas/webhook'

      const ultVerificacao = configRec ? configRec.getString('ultima_verificacao') : ''
      const statusVerif = configRec ? configRec.getString('status_verificacao') : ''
      const metadados = configRec ? configRec.get('metadados') : null

      return e.json(200, {
        sucesso: true,
        gateway: 'Asaas',
        chave_configurada: chaveConfigurada,
        chave_mascarada: chaveMascarada,
        chave_origem: apiKeyOrigem,
        ambiente: ambienteDetectado,
        ultima_verificacao: ultVerificacao,
        status_verificacao: statusVerif,
        detalhes_conta: metadados,
        webhook: {
          url: webhookUrlOficial,
          token_configurado: tokenConfigurado,
          token_mascarado: tokenMascarado,
          token_origem: webhookTokenOrigem,
          eventos_obrigatorios: [
            'PAYMENT_RECEIVED',
            'PAYMENT_CONFIRMED',
            'PAYMENT_OVERDUE',
            'PAYMENT_REFUNDED',
            'PAYMENT_DELETED',
          ],
        },
      })
    } catch (err) {
      console.error('[gateway_status] Erro:', err)
      return e.json(500, {
        error: err.message || 'Erro ao carregar status do gateway',
      })
    }
  },
  $apis.requireAuth(),
)
