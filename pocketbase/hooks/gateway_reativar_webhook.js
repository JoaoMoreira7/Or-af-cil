// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/admin/gateway/reativar-webhook',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const email = (authUser.getString('email') || '').toLowerCase().trim()
      const isDono = email === 'jaocarloss@gmail.com' || authUser.getBool('admin')
      if (!isDono) {
        return e.json(403, {
          error: 'Acesso restrito exclusivamente ao administrador (jaocarloss@gmail.com)',
        })
      }

      // 1. Obter a chave Asaas armazenada
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
        return e.json(400, {
          sucesso: false,
          mensagem:
            'Nenhuma chave de API da Asaas foi configurada. Acesse o card de Chave de API e salve sua chave antes de reativar a fila.',
        })
      }

      const asaasBaseUrl = 'https://api.asaas.com/v3'
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'OrcaFacil/1.0',
        access_token: apiKey,
      }

      // 2. Chamar GET /v3/webhooks com paginação para localizar o webhook do OrçaFácil
      let offset = 0
      const limit = 100
      let webhookEncontrado = null
      let totalVerificados = 0
      const maxPaginas = 10

      for (let p = 0; p < maxPaginas; p++) {
        let resList = null
        try {
          resList = $http.send({
            url: `${asaasBaseUrl}/webhooks?offset=${offset}&limit=${limit}`,
            method: 'GET',
            headers: headers,
            timeout: 15,
          })
        } catch (httpErr) {
          console.error('[gateway_reativar_webhook] Falha ao listar webhooks:', httpErr)
          return e.json(502, {
            sucesso: false,
            mensagem:
              'Falha de rede ao conectar com os servidores da Asaas para listar webhooks: ' +
              httpErr.message +
              '. Tente novamente em instantes ou reative manualmente no painel da Asaas.',
          })
        }

        if (resList.statusCode !== 200) {
          const descErro =
            resList?.json?.errors?.[0]?.description ||
            resList?.json?.message ||
            'HTTP ' + resList.statusCode
          return e.json(400, {
            sucesso: false,
            mensagem:
              'A Asaas recusou a consulta de webhooks: ' +
              descErro +
              '. Verifique se a sua chave de API Asaas possui permissão para ler e editar Webhooks.',
          })
        }

        const dados = resList.json || {}
        const lista = dados.data || []
        totalVerificados += lista.length

        // Busca webhook cuja url contenha "/backend/v1/asaas/webhook"
        for (let i = 0; i < lista.length; i++) {
          const item = lista[i]
          const itemUrl = (item.url || '').toLowerCase()
          if (itemUrl.includes('/backend/v1/asaas/webhook')) {
            webhookEncontrado = item
            break
          }
        }

        if (webhookEncontrado) {
          break
        }

        const hasMore = Boolean(dados.hasMore)
        if (!hasMore || lista.length === 0) {
          break
        }
        offset += limit
      }

      if (!webhookEncontrado) {
        return e.json(404, {
          sucesso: false,
          total_consultados: totalVerificados,
          mensagem:
            'Nenhum webhook apontando para o endpoint "/backend/v1/asaas/webhook" foi encontrado na sua conta Asaas (' +
            totalVerificados +
            ' analisados). Verifique no painel Asaas (Menu → Integrações → Webhooks) se o webhook do OrçaFácil foi cadastrado com a URL oficial informada acima.',
        })
      }

      const webhookId = webhookEncontrado.id
      const statusAnterior = {
        id: webhookId,
        name: webhookEncontrado.name || '',
        url: webhookEncontrado.url || '',
        enabled: webhookEncontrado.enabled,
        interrupted: webhookEncontrado.interrupted,
        status:
          webhookEncontrado.status || (webhookEncontrado.interrupted ? 'INTERRUPTED' : 'ACTIVE'),
      }

      // 3. Reativar a fila com PUT /v3/webhooks/{id}
      // Segundo documentação Asaas (https://docs.asaas.com/reference/atualizar-webhook-existente):
      // - interrupted: false (reativa fila de sincronização)
      // - enabled: true (garante webhook ativo)
      let resPut = null
      try {
        resPut = $http.send({
          url: `${asaasBaseUrl}/webhooks/${webhookId}`,
          method: 'PUT',
          headers: headers,
          body: JSON.stringify({
            enabled: true,
            interrupted: false,
          }),
          timeout: 15,
        })
      } catch (putErr) {
        console.error('[gateway_reativar_webhook] Falha ao reativar webhook:', putErr)
        return e.json(502, {
          sucesso: false,
          webhook_id: webhookId,
          mensagem:
            'Falha de rede ao enviar solicitação de reativação para a Asaas: ' +
            putErr.message +
            '. Você também pode reativar manualmente no painel da Asaas.',
        })
      }

      if (resPut.statusCode !== 200) {
        const descErro =
          resPut?.json?.errors?.[0]?.description ||
          resPut?.json?.message ||
          'HTTP ' + resPut.statusCode
        return e.json(400, {
          sucesso: false,
          webhook_id: webhookId,
          status_anterior: statusAnterior,
          mensagem:
            'A Asaas recusou a reativação do webhook: ' +
            descErro +
            '. Acesse o painel da Asaas (Menu → Integrações → Webhooks) e clique no ícone de reativar manualmente.',
        })
      }

      const dadosAtualizados = resPut.json || {}
      const statusNovo = {
        id: dadosAtualizados.id || webhookId,
        name: dadosAtualizados.name || statusAnterior.name,
        url: dadosAtualizados.url || statusAnterior.url,
        enabled: dadosAtualizados.enabled !== undefined ? dadosAtualizados.enabled : true,
        interrupted:
          dadosAtualizados.interrupted !== undefined ? dadosAtualizados.interrupted : false,
        status: dadosAtualizados.status || 'ACTIVE',
      }

      console.log(
        `[gateway_reativar_webhook] Webhook ${webhookId} reativado com sucesso pelo admin ${email}. Fila retomada na Asaas.`,
      )

      return e.json(200, {
        sucesso: true,
        webhook_id: webhookId,
        nome: statusNovo.name,
        url: statusNovo.url,
        status_anterior: statusAnterior,
        status_novo: statusNovo,
        mensagem:
          'Fila do Webhook reativada com sucesso na Asaas! O status foi alterado para Ativado e os eventos pendentes voltarão a ser transmitidos normalmente.',
      })
    } catch (err) {
      console.error('[gateway_reativar_webhook] Erro inesperado:', err)
      return e.json(500, {
        sucesso: false,
        error: err.message || 'Erro interno ao reativar fila do webhook',
        mensagem:
          'Ocorreu um erro interno ao processar a reativação. Tente novamente ou reative diretamente no painel da Asaas.',
      })
    }
  },
  $apis.requireAuth(),
)
