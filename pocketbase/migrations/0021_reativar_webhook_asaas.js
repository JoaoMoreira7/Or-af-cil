// @ts-nocheck
migrate(
  (app) => {
    // 1. Obter a chave Asaas da tabela configuracoes_sistema
    let apiKey = ''
    try {
      const rec = app.findFirstRecordByData('configuracoes_sistema', 'chave', 'asaas_api_key')
      if (rec) {
        apiKey = (rec.getString('valor') || '').trim()
      }
    } catch (_) {}

    if (!apiKey) {
      apiKey = ($os.getenv('ASAAS_API_KEY') || '').trim()
    }

    if (!apiKey) {
      console.log('[reativar_webhook] Nenhuma chave Asaas encontrada para reativação do webhook.')
      return
    }

    const asaasBaseUrl = 'https://api.asaas.com/v3'
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'OrcaFacil/1.0',
      access_token: apiKey,
    }

    // 2. Chamar GET /v3/webhooks
    try {
      const resList = $http.send({
        url: `${asaasBaseUrl}/webhooks?limit=100`,
        method: 'GET',
        headers: headers,
        timeout: 20,
      })

      if (resList.statusCode !== 200) {
        console.error(
          `[reativar_webhook] Erro ao listar webhooks na Asaas: HTTP ${resList.statusCode} - ${resList.raw}`,
        )
        return
      }

      const lista = (resList.json && resList.json.data) || []
      let webhookEncontrado = null
      for (let i = 0; i < lista.length; i++) {
        const item = lista[i]
        const url = (item.url || '').toLowerCase()
        if (url.includes('/backend/v1/asaas/webhook')) {
          webhookEncontrado = item
          break
        }
      }

      if (!webhookEncontrado) {
        console.warn(
          `[reativar_webhook] Webhook do OrçaFácil (/backend/v1/asaas/webhook) não encontrado na lista de ${lista.length} webhooks da Asaas.`,
        )
        return
      }

      console.log(
        `[reativar_webhook] Webhook encontrado: ID=${webhookEncontrado.id}, Nome=${webhookEncontrado.name}, URL=${webhookEncontrado.url}, Enabled=${webhookEncontrado.enabled}, Interrupted=${webhookEncontrado.interrupted}`,
      )

      // 3. Executar PUT /v3/webhooks/{id} com {"enabled": true, "interrupted": false}
      const resPut = $http.send({
        url: `${asaasBaseUrl}/webhooks/${webhookEncontrado.id}`,
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({
          enabled: true,
          interrupted: false,
        }),
        timeout: 20,
      })

      if (resPut.statusCode === 200) {
        const updated = resPut.json || {}
        console.log(
          `[reativar_webhook] SUCESSO! Webhook reativado na Asaas: ID=${updated.id}, Status=${updated.status || 'ACTIVE'}, Enabled=${updated.enabled}, Interrupted=${updated.interrupted}`,
        )

        // Registrar na configuracoes_sistema para histórico/metadados
        try {
          const confRec = app.findFirstRecordByData(
            'configuracoes_sistema',
            'chave',
            'asaas_webhook_token',
          )
          if (confRec) {
            const meta = confRec.get('metadados') || {}
            meta.ultimo_status_asaas = {
              webhook_id: updated.id,
              status: updated.status,
              enabled: updated.enabled,
              interrupted: updated.interrupted,
              reativado_em: new Date().toISOString(),
            }
            confRec.set('metadados', meta)
            app.save(confRec)
          }
        } catch (_) {}
      } else {
        console.error(
          `[reativar_webhook] Falha no PUT de reativação: HTTP ${resPut.statusCode} - ${resPut.raw}`,
        )
      }
    } catch (err) {
      console.error('[reativar_webhook] Exceção ao reativar webhook na Asaas:', err)
    }
  },
  (app) => {
    // Reversão no-op
  },
)
