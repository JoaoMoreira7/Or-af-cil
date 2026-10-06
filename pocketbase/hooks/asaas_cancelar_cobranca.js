// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/asaas/cancelar-cobranca/{id}',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const isDono =
        authUser.getBool('admin') ||
        (authUser.getString('email') || '').toLowerCase().trim() === 'jaocarloss@gmail.com'

      if (!isDono) {
        return e.json(403, {
          error: 'Apenas o administrador do sistema pode cancelar cobranças na Asaas',
        })
      }

      const asaasPaymentId = e.requestInfo().pathParams.id
      if (!asaasPaymentId) {
        return e.json(400, { error: 'ID da cobrança Asaas não fornecido' })
      }

      let apiKey = ''
      try {
        const configRecs = $app.findRecordsByFilter(
          'configuracoes_sistema',
          "chave = 'asaas_api_key'",
          '-created',
          1,
          0,
        )
        if (configRecs.length > 0 && configRecs[0].getString('valor')) {
          apiKey = configRecs[0].getString('valor').trim()
        }
      } catch (_) {}

      if (!apiKey) {
        apiKey = ($os.getenv('ASAAS_API_KEY') || '').trim()
      }

      if (!apiKey) {
        return e.json(500, { error: 'Chave Asaas não configurada' })
      }

      const asaasBaseUrl = 'https://api.asaas.com/v3'
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'OrcaFacil/1.0',
        access_token: apiKey,
      }

      // Chama a remoção/cancelamento na API Asaas: DELETE /v3/payments/{id}
      const delRes = $http.send({
        url: asaasBaseUrl + '/payments/' + asaasPaymentId,
        method: 'DELETE',
        headers: headers,
        timeout: 15,
      })

      const statusCode = delRes.statusCode
      if (statusCode !== 200 && statusCode !== 204) {
        const errMsg =
          delRes.json?.errors?.[0]?.description || delRes.raw || 'Falha ao cancelar na Asaas'
        console.warn(
          `[asaas_cancelar_cobranca] Asaas recusou cancelamento (${statusCode}):`,
          errMsg,
        )
        // Se a cobrança já estava cancelada/inexistente, ainda sincroniza o banco local
      }

      // Atualiza o registro no banco local
      try {
        const pagamentos = $app.findRecordsByFilter(
          'pagamentos',
          "asaas_id = '" + asaasPaymentId + "'",
          '-created',
          1,
          0,
        )
        if (pagamentos.length > 0) {
          const rec = pagamentos[0]
          rec.set('status', 'cancelado')
          $app.save(rec)

          const userId = rec.getString('user_id')
          if (userId) {
            const planos = $app.findRecordsByFilter(
              'planos',
              "user_id = '" + userId + "'",
              '-created',
              1,
              0,
            )
            if (planos.length > 0) {
              const p = planos[0]
              p.set('status', 'expirado')
              $app.save(p)
            }
          }
        }
      } catch (dbErr) {
        console.error('[asaas_cancelar_cobranca] Erro ao sincronizar banco local:', dbErr)
      }

      return e.json(200, {
        sucesso: true,
        asaas_id: asaasPaymentId,
        mensagem: 'Cobrança cancelada com sucesso na Asaas e no sistema',
      })
    } catch (err) {
      console.error('[asaas_cancelar_cobranca] Erro:', err)
      return e.json(500, { error: err.message || 'Erro ao cancelar cobrança' })
    }
  },
  $apis.requireAuth(),
)
