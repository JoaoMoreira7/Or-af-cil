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

    // Teste 1: GET /backend/v1/asaas/webhook
    const baseUrl = 'http://127.0.0.1:8090'
    let resGet = null
    let getError = null
    try {
      resGet = $http.send({
        url: baseUrl + '/backend/v1/asaas/webhook',
        method: 'GET',
        timeout: 10,
      })
    } catch (err) {
      getError = err.message || String(err)
    }

    // Teste 2: POST /backend/v1/asaas/webhook assinado com token
    let resPost = null
    let postError = null
    try {
      resPost = $http.send({
        url: baseUrl + '/backend/v1/asaas/webhook',
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
        timeout: 10,
      })
    } catch (err) {
      postError = err.message || String(err)
    }

    // Teste 3: POST /backend/v1/planos/garantir (idempotência)
    // Cria/Garante plano para um usuário de teste
    let userTeste = null
    try {
      userTeste = app.findFirstRecordByData('users', 'email', 'jaocarloss@gmail.com')
    } catch (_) {}

    let testeGarantir = null
    if (userTeste) {
      try {
        const planoAntes = app.findFirstRecordByData('planos', 'user_id', userTeste.id)
        testeGarantir = {
          user_id: userTeste.id,
          plano_antes_id: planoAntes ? planoAntes.id : null,
        }
      } catch (err) {
        testeGarantir = { erro: err.message || String(err) }
      }
    }

    const logResult = {
      teste_get: {
        status: resGet ? resGet.statusCode : null,
        body: resGet ? resGet.json || resGet.raw : null,
        error: getError,
      },
      teste_post: {
        status: resPost ? resPost.statusCode : null,
        body: resPost ? resPost.json || resPost.raw : null,
        error: postError,
      },
      teste_garantir: testeGarantir,
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
