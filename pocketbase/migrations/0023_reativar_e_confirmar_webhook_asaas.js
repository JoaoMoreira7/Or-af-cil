// @ts-nocheck
migrate(
  (app) => {
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

    const confRec = app.findFirstRecordByData(
      'configuracoes_sistema',
      'chave',
      'asaas_webhook_token',
    )
    const meta = confRec ? confRec.get('metadados') || {} : {}

    if (!apiKey) {
      meta.execucao_reativacao_0023 = {
        erro: 'Chave não encontrada',
        data: new Date().toISOString(),
      }
      if (confRec) {
        confRec.set('metadados', meta)
        app.save(confRec)
      }
      return
    }

    // Obter token do webhook para garantir sincronização
    let webhookToken = ''
    if (confRec) {
      webhookToken = (confRec.getString('valor') || '').trim()
    }
    if (!webhookToken) {
      webhookToken = ($os.getenv('ASAAS_WEBHOOK_TOKEN') || '').trim()
    }

    const asaasBaseUrl = 'https://api.asaas.com/v3'
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'OrcaFacil/1.0',
      access_token: apiKey,
    }

    try {
      // 1. Listar webhooks cadastrados na conta Asaas
      const res = $http.send({
        url: asaasBaseUrl + '/webhooks?limit=100',
        method: 'GET',
        headers: headers,
        timeout: 25,
      })

      const info = {
        timestamp: new Date().toISOString(),
        list_status: res.statusCode,
        token_usado: webhookToken ? 'configurado' : 'vazio',
      }

      if (res.statusCode === 200) {
        const data = (res.json && res.json.data) || []
        info.total_webhooks = data.length
        info.webhooks_resumo = data.map(function (w) {
          return {
            id: w.id,
            name: w.name,
            url: w.url,
            enabled: w.enabled,
            interrupted: w.interrupted,
            status: w.status,
          }
        })

        // Localiza o webhook do OrçaFácil
        let target = null
        for (let i = 0; i < data.length; i++) {
          const u = (data[i].url || '').toLowerCase()
          if (u.indexOf('/backend/v1/asaas/webhook') !== -1 || u.indexOf('asaas/webhook') !== -1) {
            target = data[i]
            break
          }
        }

        if (target) {
          info.target_antes = {
            id: target.id,
            url: target.url,
            name: target.name,
            enabled: target.enabled,
            interrupted: target.interrupted,
            status: target.status,
          }

          // Executa PUT para reativar e atualizar authToken se disponível
          const putPayload = {
            enabled: true,
            interrupted: false,
          }
          if (webhookToken) {
            putPayload.authToken = webhookToken
          }

          const putRes = $http.send({
            url: asaasBaseUrl + '/webhooks/' + target.id,
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(putPayload),
            timeout: 25,
          })

          info.put_status = putRes.statusCode
          info.put_response = putRes.json || putRes.raw

          // 3. Consulta de confirmação direta do webhook após o PUT
          const verifyRes = $http.send({
            url: asaasBaseUrl + '/webhooks/' + target.id,
            method: 'GET',
            headers: headers,
            timeout: 25,
          })
          info.verify_status = verifyRes.statusCode
          info.target_depois = verifyRes.json || verifyRes.raw
        } else {
          info.target_encontrado = false
        }
      } else {
        info.list_error = res.raw
      }

      meta.execucao_reativacao_0023 = info
    } catch (err) {
      meta.execucao_reativacao_0023 = {
        erro: err.message || String(err),
        data: new Date().toISOString(),
      }
    }

    if (confRec) {
      confRec.set('metadados', meta)
      app.save(confRec)
    }
  },
  (app) => {},
)
