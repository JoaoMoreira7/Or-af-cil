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
      meta.execucao_reativacao_0022 = {
        erro: 'Chave não encontrada',
        data: new Date().toISOString(),
      }
      if (confRec) {
        confRec.set('metadados', meta)
        app.save(confRec)
      }
      return
    }

    const asaasBaseUrl = 'https://api.asaas.com/v3'
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'OrcaFacil/1.0',
      access_token: apiKey,
    }

    try {
      // 1. Listar webhooks
      const res = $http.send({
        url: asaasBaseUrl + '/webhooks?limit=100',
        method: 'GET',
        headers: headers,
        timeout: 25,
      })

      meta.execucao_reativacao_0022 = {
        timestamp: new Date().toISOString(),
        list_status: res.statusCode,
      }

      if (res.statusCode === 200) {
        const data = (res.json && res.json.data) || []
        meta.execucao_reativacao_0022.total_webhooks = data.length
        meta.execucao_reativacao_0022.webhooks_resumo = data.map(function (w) {
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
          meta.execucao_reativacao_0022.target_encontrado = {
            id: target.id,
            url: target.url,
            name: target.name,
            enabled_antes: target.enabled,
            interrupted_antes: target.interrupted,
          }

          // Executa PUT para reativar
          const putRes = $http.send({
            url: asaasBaseUrl + '/webhooks/' + target.id,
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
              enabled: true,
              interrupted: false,
            }),
            timeout: 25,
          })

          meta.execucao_reativacao_0022.put_status = putRes.statusCode
          meta.execucao_reativacao_0022.put_response = putRes.json || putRes.raw
        } else {
          meta.execucao_reativacao_0022.target_encontrado = false
        }
      } else {
        meta.execucao_reativacao_0022.list_error = res.raw
      }
    } catch (err) {
      meta.execucao_reativacao_0022 = {
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
