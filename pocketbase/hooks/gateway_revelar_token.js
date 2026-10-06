// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/admin/gateway/revelar-webhook-token',
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

      // 1. Buscar o token na collection configuracoes_sistema
      let webhookToken = ''
      let tokenOrigem = 'nenhuma'

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
          tokenOrigem = 'banco'
        }
      } catch (_) {}

      if (!webhookToken) {
        const envToken = ($os.getenv('ASAAS_WEBHOOK_TOKEN') || '').trim()
        if (envToken) {
          webhookToken = envToken
          tokenOrigem = 'ambiente'
        }
      }

      // Lazy bootstrap se ainda não existir
      if (!webhookToken) {
        try {
          const novoTokenGerado = 'whsec_' + $security.randomString(48)
          const agora = new Date().toISOString()
          const colConfig = $app.findCollectionByNameOrId('configuracoes_sistema')
          const novoRec = new Record(colConfig)
          novoRec.set('chave', 'asaas_webhook_token')
          novoRec.set('valor', novoTokenGerado)
          novoRec.set(
            'descricao',
            'Token de autenticação do Webhook Asaas para validação do cabeçalho asaas-access-token',
          )
          novoRec.set('tipo', 'secret')
          novoRec.set('ultima_verificacao', agora)
          novoRec.set('status_verificacao', 'ativo')
          novoRec.set('metadados', {
            gerado_por: 'lazy_bootstrap_revelar_token',
            gerado_em: agora,
            admin: email,
          })
          $app.save(novoRec)

          webhookToken = novoTokenGerado
          tokenOrigem = 'banco'
        } catch (bootErr) {
          console.warn('[revelar_webhook_token] Erro no lazy bootstrap:', bootErr)
        }
      }

      if (!webhookToken) {
        return e.json(404, {
          sucesso: false,
          error: 'Token de webhook não encontrado',
        })
      }

      const mascarar = (str) => {
        if (!str) return ''
        if (str.length <= 6) return '••••' + str.slice(-2)
        return '••••••••' + str.slice(-4)
      }

      return e.json(200, {
        sucesso: true,
        token: webhookToken,
        token_mascarado: mascarar(webhookToken),
        origem: tokenOrigem,
      })
    } catch (err) {
      console.error('[revelar_webhook_token] Erro:', err)
      return e.json(500, {
        error: err.message || 'Erro ao revelar token do webhook',
      })
    }
  },
  $apis.requireAuth(),
)
