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

    let webhookId = 'edce8954-28d3-4439-ad9d-758b7c18473a'
    const getRes = $http.send({
      url: asaasBaseUrl + '/webhooks/' + webhookId,
      method: 'GET',
      headers: headers,
      timeout: 25,
    })

    const d = getRes.json || {}
    const resumo =
      'id=' +
      d.id +
      ' enabled=' +
      d.enabled +
      ' interrupted=' +
      d.interrupted +
      ' status=' +
      d.status +
      ' url=' +
      d.url

    try {
      const logRec = app.findFirstRecordByData(
        'configuracoes_sistema',
        'chave',
        'debug_asaas_status',
      )
      logRec.set('valor', resumo)
      app.save(logRec)
    } catch (_) {}
  },
  (app) => {},
)
