// @ts-nocheck
migrate(
  (app) => {
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

    const publicUrl = 'https://finalizacao-do-sistema-913b5.shrd00.internal.goskip.dev'

    // Teste 1: GET /backend/v1/asaas/webhook
    let resGet = null
    let getError = null
    try {
      resGet = $http.send({
        url: publicUrl + '/backend/v1/asaas/webhook',
        method: 'GET',
        timeout: 15,
      })
    } catch (err) {
      getError = err.message || String(err)
    }

    // Teste 2: POST /backend/v1/asaas/webhook assinado com token
    let resPost = null
    let postError = null
    try {
      resPost = $http.send({
        url: publicUrl + '/backend/v1/asaas/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': webhookToken,
        },
        body: JSON.stringify({
          event: 'TEST_PROBE',
          payment: {
            id: 'pay_test_probe_123',
          },
        }),
        timeout: 15,
      })
    } catch (err) {
      postError = err.message || String(err)
    }

    // Teste 2b: POST com token INVÁLIDO deve retornar 401
    let resPostInvalido = null
    try {
      resPostInvalido = $http.send({
        url: publicUrl + '/backend/v1/asaas/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': 'token_errado_123',
        },
        body: JSON.stringify({
          event: 'TEST_PROBE',
          payment: { id: 'pay_test' },
        }),
        timeout: 15,
      })
    } catch (_) {}

    const logResult = {
      teste_get: {
        status: resGet ? resGet.statusCode : null,
        body: resGet ? resGet.json || resGet.raw : null,
        error: getError,
      },
      teste_post_valido: {
        status: resPost ? resPost.statusCode : null,
        body: resPost ? resPost.json || resPost.raw : null,
        error: postError,
      },
      teste_post_invalido: {
        status: resPostInvalido ? resPostInvalido.statusCode : null,
        body: resPostInvalido ? resPostInvalido.json || resPostInvalido.raw : null,
      },
    }

    try {
      const logRec = app.findFirstRecordByData(
        'configuracoes_sistema',
        'chave',
        'debug_asaas_status',
      )
      logRec.set('valor', JSON.stringify(logResult).slice(0, 3000))
      app.save(logRec)
    } catch (_) {}
  },
  (app) => {},
)
