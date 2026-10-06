// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/admin/gateway/regenerar-webhook-token',
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

      // Gera um novo token seguro alfanumérico com prefixo 'whsec_'
      const randomPart = $security.randomString(32)
      const novoToken = 'whsec_' + randomPart
      const agora = new Date().toISOString()

      let tokenRec = null
      try {
        const recs = $app.findRecordsByFilter(
          'configuracoes_sistema',
          "chave = 'asaas_webhook_token'",
          '-created',
          1,
          0,
        )
        if (recs.length > 0) {
          tokenRec = recs[0]
        }
      } catch (_) {}

      const col = $app.findCollectionByNameOrId('configuracoes_sistema')
      if (!tokenRec) {
        tokenRec = new Record(col)
        tokenRec.set('chave', 'asaas_webhook_token')
      }

      tokenRec.set('valor', novoToken)
      tokenRec.set('descricao', 'Token de autenticação do Webhook Asaas')
      tokenRec.set('tipo', 'secret')
      tokenRec.set('ultima_verificacao', agora)
      tokenRec.set('status_verificacao', 'ativo')
      tokenRec.set('metadados', {
        gerado_por: email,
        gerado_em: agora,
      })

      $app.save(tokenRec)

      const webhookUrlOficial =
        'https://finalizacao-do-sistema-913b5.shrd00.internal.goskip.dev/backend/v1/asaas/webhook'

      console.log(`[regenerar_webhook_token] Novo token do webhook gerado pelo admin ${email}.`)

      // Retorna o token completo UMA ÚNICA VEZ para que o admin copie e cole no painel Asaas
      return e.json(200, {
        sucesso: true,
        novo_token: novoToken,
        token_mascarado: '••••••••' + novoToken.slice(-4),
        webhook_url: webhookUrlOficial,
        gerado_em: agora,
        mensagem:
          'Novo token do webhook gerado com sucesso! Copie agora e configure no painel da Asaas.',
      })
    } catch (err) {
      console.error('[regenerar_webhook_token] Erro:', err)
      return e.json(500, {
        error: err.message || 'Erro interno ao regenerar token do webhook',
      })
    }
  },
  $apis.requireAuth(),
)
