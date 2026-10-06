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

    let webhookToken = ''
    try {
      const recT = app.findFirstRecordByData(
        'configuracoes_sistema',
        'chave',
        'asaas_webhook_token',
      )
      if (recT) {
        webhookToken = (recT.getString('valor') || '').trim()
      }
    } catch (_) {}

    const asaasBaseUrl = 'https://api.asaas.com/v3'
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'OrcaFacil/1.0',
      access_token: apiKey,
    }

    // 1. Obter detalhes do webhook edce8954-28d3-4439-ad9d-758b7c18473a
    let webhookId = 'edce8954-28d3-4439-ad9d-758b7c18473a'

    // 2. Executar PUT para reativar
    let putResult = ''
    try {
      const putRes = $http.send({
        url: asaasBaseUrl + '/webhooks/' + webhookId,
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({
          enabled: true,
          interrupted: false,
          authToken: webhookToken || undefined,
        }),
        timeout: 25,
      })
      putResult = JSON.stringify(putRes.json || putRes.raw)
    } catch (err) {
      putResult = 'Erro PUT: ' + (err.message || String(err))
    }

    // 3. Obter status final com GET
    let getResult = ''
    try {
      const getRes = $http.send({
        url: asaasBaseUrl + '/webhooks/' + webhookId,
        method: 'GET',
        headers: headers,
        timeout: 25,
      })
      getResult = JSON.stringify(getRes.json || getRes.raw)
    } catch (err) {
      getResult = 'Erro GET: ' + (err.message || String(err))
    }

    try {
      const logRec = app.findFirstRecordByData(
        'configuracoes_sistema',
        'chave',
        'debug_asaas_status',
      )
      logRec.set('valor', ('PUT: ' + putResult + ' | GET: ' + getResult).slice(0, 2000))
      app.save(logRec)
    } catch (_) {}
  },
  (app) => {},
)
