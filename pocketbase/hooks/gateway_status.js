// @ts-nocheck
routerAdd(
  'GET',
  '/backend/v1/admin/gateway/status',
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

      // 1. Resolver Chave Asaas Atual (banco configuracoes_sistema tem prioridade, fallback env)
      let apiKey = ''
      let apiKeyOrigem = 'nenhuma'
      let configRec = null

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
          apiKeyOrigem = 'banco'
          configRec = configRecs[0]
        }
      } catch (_) {}

      if (!apiKey) {
        const envKey = ($os.getenv('ASAAS_API_KEY') || '').trim()
        if (envKey) {
          apiKey = envKey
          apiKeyOrigem = 'ambiente'
        }
      }

      // 2. Resolver Token do Webhook (com lazy bootstrap automático caso não exista)
      let webhookToken = ''
      let webhookTokenOrigem = 'nenhuma'
      let tokenRec = null

      try {
        const tokenRecs = $app.findRecordsByFilter(
          'configuracoes_sistema',
          "chave = 'asaas_webhook_token'",
          '-created',
          1,
          0,
        )
        if (tokenRecs.length > 0 && tokenRecs[0].getString('valor')) {
          webhookToken = tokenRecs[0].getString('valor').trim()
          webhookTokenOrigem = 'banco'
          tokenRec = tokenRecs[0]
        }
      } catch (_) {}

      // Fallback em variável de ambiente (se já configurado via env)
      if (!webhookToken) {
        const envToken = ($os.getenv('ASAAS_WEBHOOK_TOKEN') || '').trim()
        if (envToken) {
          webhookToken = envToken
          webhookTokenOrigem = 'ambiente'
        }
      }

      // Lazy bootstrap: se ainda não houver token, gera e persiste imediatamente na coleção configuracoes_sistema
      if (!webhookToken) {
        try {
          const novoTokenGerado = 'whsec_' + $security.randomString(48)
          const agora = new Date().toISOString()
          const colConfig = $app.findCollectionByNameOrId('configuracoes_sistema')
          const novoRec = new Record(colConfig)
          novoRec.set('chave', 'asaas_webhook_token')
          novoRec.set('valor', novoTokenGerado)
          novoRec.set(
            'descricao',
            'Token de autenticação do Webhook Asaas para validação do cabeçalho asaas-access-token',
          )
          novoRec.set('tipo', 'secret')
          novoRec.set('ultima_verificacao', agora)
          novoRec.set('status_verificacao', 'ativo')
          novoRec.set('metadados', {
            gerado_por: 'lazy_bootstrap_gateway_status',
            gerado_em: agora,
            admin: email,
          })
          $app.save(novoRec)

          webhookToken = novoTokenGerado
          webhookTokenOrigem = 'banco'
          console.log(
            `[gateway_status] Token de webhook gerado automaticamente via lazy bootstrap.`,
          )
        } catch (bootstrapErr) {
          console.warn('[gateway_status] Erro no lazy bootstrap do token de webhook:', bootstrapErr)
        }
      }

      // 3. Mascarar Chave e Token (NUNCA ecoar completos)
      const mascarar = (str) => {
        if (!str) return ''
        if (str.length <= 6) return '••••' + str.slice(-2)
        return '••••••••' + str.slice(-4)
      }

      const chaveConfigurada = Boolean(apiKey)
      const chaveMascarada = mascarar(apiKey)
      const tokenConfigurado = Boolean(webhookToken)
      const tokenMascarado = mascarar(webhookToken)

      // Identifica se é sandbox ou produção pelo padrão da chave ou URL
      // Chaves Asaas de sandbox tipicamente começam com $aact_hml_ ou similar
      let ambienteDetectado = 'producao'
      if (
        apiKey.toLowerCase().includes('sandbox') ||
        apiKey.toLowerCase().includes('hml') ||
        apiKey.startsWith('$aact_hml_')
      ) {
        ambienteDetectado = 'sandbox'
      }

      const webhookUrlOficial =
        'https://finalizacao-do-sistema-913b5.shrd00.internal.goskip.dev/backend/v1/asaas/webhook'

      // 3.1 Consultar status real do Webhook na Asaas (GET /v3/webhooks)
      let webhookStatusReal = {
        consultado: false,
        status: 'Desconhecido',
        interrupted: false,
        enabled: true,
        webhook_id: '',
        nome: '',
        url: webhookUrlOficial,
        mensagem: 'Não verificado',
      }

      let autoReativado = false
      let reativacaoResultado = null

      if (apiKey) {
        try {
          const asaasBaseUrl = 'https://api.asaas.com/v3'
          const headersAsaas = {
            'Content-Type': 'application/json',
            'User-Agent': 'OrcaFacil/1.0',
            access_token: apiKey,
          }

          const resList = $http.send({
            url: asaasBaseUrl + '/webhooks?limit=100',
            method: 'GET',
            headers: headersAsaas,
            timeout: 15,
          })

          if (resList.statusCode === 200) {
            const dataWebhooks = (resList.json && resList.json.data) || []
            let targetWebhook = null
            for (let i = 0; i < dataWebhooks.length; i++) {
              const u = (dataWebhooks[i].url || '').toLowerCase()
              if (
                u.indexOf('/backend/v1/asaas/webhook') !== -1 ||
                u.indexOf('asaas/webhook') !== -1
              ) {
                targetWebhook = dataWebhooks[i]
                break
              }
            }

            if (targetWebhook) {
              const isInterrupted = Boolean(targetWebhook.interrupted)
              const isEnabled = targetWebhook.enabled !== false
              const statusTexto = isInterrupted
                ? 'Interrompido'
                : isEnabled
                  ? 'Ativado'
                  : 'Desativado'

              webhookStatusReal = {
                consultado: true,
                status: statusTexto,
                interrupted: isInterrupted,
                enabled: isEnabled,
                webhook_id: targetWebhook.id || '',
                nome: targetWebhook.name || '',
                url: targetWebhook.url || webhookUrlOficial,
                email: targetWebhook.email || '',
                sendType: targetWebhook.sendType || '',
                mensagem: isInterrupted
                  ? 'Fila de eventos interrompida na Asaas (reativação necessária).'
                  : 'Webhook ativo e recebendo notificações da Asaas normalmente.',
              }

              // SE ESTIVER INTERROMPIDO, AUTO-REATIVA IMEDIATAMENTE NA PRÓPRIA REQUISIÇÃO!
              if (isInterrupted) {
                try {
                  console.log(
                    `[gateway_status] Webhook ${targetWebhook.id} detectado como Interrompido. Executando auto-reativação imediata via PUT /v3/webhooks/${targetWebhook.id}...`,
                  )
                  const resPut = $http.send({
                    url: `${asaasBaseUrl}/webhooks/${targetWebhook.id}`,
                    method: 'PUT',
                    headers: headersAsaas,
                    body: JSON.stringify({
                      enabled: true,
                      interrupted: false,
                    }),
                    timeout: 15,
                  })

                  if (resPut.statusCode === 200) {
                    const putData = resPut.json || {}
                    autoReativado = true
                    webhookStatusReal.status = 'Ativado'
                    webhookStatusReal.interrupted = false
                    webhookStatusReal.enabled = true
                    webhookStatusReal.mensagem =
                      'Webhook foi auto-reativado com sucesso na Asaas e a fila de sincronização foi retomada!'
                    reativacaoResultado = putData
                    console.log(
                      `[gateway_status] [reativar_webhook] SUCESSO: Webhook ${targetWebhook.id} reativado na Asaas: Status=${putData.status || 'ACTIVE'}, Interrupted=false`,
                    )
                  } else {
                    console.error(
                      `[gateway_status] Falha na auto-reativação: HTTP ${resPut.statusCode} - ${resPut.raw}`,
                    )
                  }
                } catch (autoErr) {
                  console.error('[gateway_status] Erro ao auto-reativar webhook:', autoErr)
                }
              }
            } else {
              webhookStatusReal = {
                consultado: true,
                status: 'Não cadastrado na Asaas',
                interrupted: false,
                enabled: false,
                webhook_id: '',
                nome: '',
                url: webhookUrlOficial,
                mensagem:
                  'Nenhum webhook com a URL do OrçaFácil foi encontrado na conta Asaas. Cadastre-o no painel da Asaas.',
              }
            }
          } else {
            console.warn(
              `[gateway_status] Falha ao consultar webhooks na Asaas: HTTP ${resList.statusCode}`,
            )
            webhookStatusReal.mensagem =
              'Falha ao consultar Asaas (HTTP ' + resList.statusCode + ')'
          }
        } catch (asaasErr) {
          console.warn('[gateway_status] Erro na requisição à Asaas:', asaasErr)
          webhookStatusReal.mensagem =
            'Erro de conexão com Asaas: ' + (asaasErr.message || String(asaasErr))
        }
      }

      const ultVerificacao = configRec ? configRec.getString('ultima_verificacao') : ''
      const statusVerif = configRec ? configRec.getString('status_verificacao') : ''
      const metadados = configRec ? configRec.get('metadados') : null

      return e.json(200, {
        sucesso: true,
        gateway: 'Asaas',
        chave_configurada: chaveConfigurada,
        chave_mascarada: chaveMascarada,
        chave_origem: apiKeyOrigem,
        ambiente: ambienteDetectado,
        ultima_verificacao: ultVerificacao,
        status_verificacao: statusVerif,
        detalhes_conta: metadados,
        auto_reativado: autoReativado,
        reativacao_resultado: reativacaoResultado,
        webhook: {
          url: webhookUrlOficial,
          token_configurado: tokenConfigurado,
          token_mascarado: tokenMascarado,
          token_origem: webhookTokenOrigem,
          status_real: webhookStatusReal,
          eventos_obrigatorios: [
            'PAYMENT_RECEIVED',
            'PAYMENT_CONFIRMED',
            'PAYMENT_OVERDUE',
            'PAYMENT_REFUNDED',
            'PAYMENT_DELETED',
          ],
        },
      })
    } catch (err) {
      console.error('[gateway_status] Erro:', err)
      return e.json(500, {
        error: err.message || 'Erro ao carregar status do gateway',
      })
    }
  },
  $apis.requireAuth(),
)
