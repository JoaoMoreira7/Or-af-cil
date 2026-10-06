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

    const asaasBaseUrl = 'https://api.asaas.com/v3'
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'OrcaFacil/1.0',
      access_token: apiKey,
    }

    let infoRes = ''
    try {
      const res = $http.send({
        url: asaasBaseUrl + '/webhooks?limit=100',
        method: 'GET',
        headers: headers,
        timeout: 25,
      })
      infoRes = JSON.stringify(res.json || res.raw || {})
    } catch (err) {
      infoRes = 'Erro: ' + (err.message || String(err))
    }

    // Grava em uma chave nova texto simples
    try {
      let logRec = null
      try {
        logRec = app.findFirstRecordByData('configuracoes_sistema', 'chave', 'debug_asaas_status')
      } catch (_) {
        const col = app.findCollectionByNameOrId('configuracoes_sistema')
        logRec = new Record(col)
        logRec.set('chave', 'debug_asaas_status')
      }
      logRec.set('valor', infoRes.slice(0, 1500))
      logRec.set('descricao', 'Debug resposta Asaas webhooks')
      logRec.set('tipo', 'debug')
      app.save(logRec)
    } catch (saveErr) {
      console.error('saveErr:', saveErr)
    }
  },
  (app) => {},
)
