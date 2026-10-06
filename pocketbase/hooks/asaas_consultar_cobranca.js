// @ts-nocheck
routerAdd(
  'GET',
  '/backend/v1/asaas/cobranca/{id}',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const asaasPaymentId = e.requestInfo().pathParams.id
      if (!asaasPaymentId) {
        return e.json(400, { error: 'ID da cobrança Asaas não informado' })
      }

      // Verifica se o pagamento pertence ao usuário ou se é admin/dono
      const userId = authUser.id
      const isDono =
        authUser.getBool('admin') ||
        (authUser.getString('email') || '').toLowerCase().trim() === 'jaocarloss@gmail.com'

      let pagamentoRecord = null
      try {
        const pagamentos = $app.findRecordsByFilter(
          'pagamentos',
          "asaas_id = '" + asaasPaymentId + "'",
          '-created',
          1,
          0,
        )
        if (pagamentos.length > 0) {
          pagamentoRecord = pagamentos[0]
        }
      } catch (_) {}

      if (pagamentoRecord && !isDono && pagamentoRecord.getString('user_id') !== userId) {
        return e.json(403, { error: 'Acesso negado a este pagamento' })
      }

      const apiKey = $os.getenv('ASAAS_API_KEY')
      if (!apiKey) {
        return e.json(500, { error: 'Chave Asaas não configurada' })
      }

      const asaasBaseUrl = 'https://api.asaas.com/v3'
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'OrcaFacil/1.0',
        access_token: apiKey,
      }

      const getRes = $http.send({
        url: asaasBaseUrl + '/payments/' + asaasPaymentId,
        method: 'GET',
        headers: headers,
        timeout: 15,
      })

      if (getRes.statusCode !== 200) {
        return e.json(getRes.statusCode || 404, {
          error: 'Cobrança não encontrada na Asaas',
          detalhes: getRes.json,
        })
      }

      const paymentData = getRes.json

      // Se a Asaas já diz que está recebido/confirmado e no banco ainda estava pendente, sincroniza
      if (
        pagamentoRecord &&
        pagamentoRecord.getString('status') === 'pendente' &&
        (paymentData.status === 'RECEIVED' || paymentData.status === 'CONFIRMED')
      ) {
        const agora = new Date()
        const pagoEmData =
          paymentData.paymentDate || paymentData.clientPaymentDate || agora.toISOString()
        const renovacao = new Date(pagoEmData)
        renovacao.setDate(renovacao.getDate() + 30)

        pagamentoRecord.set('status', 'pago')
        pagamentoRecord.set('pago_em', new Date(pagoEmData).toISOString())
        pagamentoRecord.set('data_vencimento', renovacao.toISOString())
        $app.save(pagamentoRecord)

        try {
          const planos = $app.findRecordsByFilter(
            'planos',
            "user_id = '" + pagamentoRecord.getString('user_id') + "'",
            '-created',
            1,
            0,
          )
          if (planos.length > 0) {
            const p = planos[0]
            p.set('status', 'ativo')
            p.set('renovacao_em', renovacao.toISOString())
            $app.save(p)
          }
        } catch (_) {}
      }

      return e.json(200, {
        sucesso: true,
        cobranca: paymentData,
        status_local: pagamentoRecord ? pagamentoRecord.getString('status') : null,
      })
    } catch (err) {
      console.error('[asaas_consultar_cobranca] Erro:', err)
      return e.json(500, { error: err.message || 'Erro ao consultar cobrança na Asaas' })
    }
  },
  $apis.requireAuth(),
)
