// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/admin/gateway/testar',
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

      // 1. Obter chave a ser testada (se enviada no body testa ela, senão pega a chave salva)
      const body = e.requestInfo().body || {}
      let chaveParaTestar = (body.api_key || '').trim()

      if (!chaveParaTestar) {
        try {
          const configRecs = $app.findRecordsByFilter(
            'configuracoes_sistema',
            "chave = 'asaas_api_key'",
            '-created',
            1,
            0,
          )
          if (configRecs.length > 0 && configRecs[0].getString('valor')) {
            chaveParaTestar = configRecs[0].getString('valor').trim()
          }
        } catch (_) {}
      }

      if (!chaveParaTestar) {
        chaveParaTestar = ($os.getenv('ASAAS_API_KEY') || '').trim()
      }

      if (!chaveParaTestar) {
        return e.json(400, {
          sucesso: false,
          conectado: false,
          mensagem: 'Nenhuma chave de API da Asaas foi configurada ou enviada para teste.',
        })
      }

      // 2. Chamar endpoint real da Asaas (GET /v3/myAccount ou GET /v3/finance/balance)
      const asaasBaseUrl = 'https://api.asaas.com/v3'
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'OrcaFacil/1.0',
        access_token: chaveParaTestar,
      }

      let resTeste = null
      let endpointTestado = '/myAccount'
      try {
        resTeste = $http.send({
          url: asaasBaseUrl + '/myAccount',
          method: 'GET',
          headers: headers,
          timeout: 15,
        })
      } catch (httpErr) {
        console.warn(
          '[gateway_testar] Falha ao chamar /myAccount, tentando /finance/balance:',
          httpErr,
        )
        try {
          endpointTestado = '/finance/balance'
          resTeste = $http.send({
            url: asaasBaseUrl + '/finance/balance',
            method: 'GET',
            headers: headers,
            timeout: 15,
          })
        } catch (httpErr2) {
          return e.json(502, {
            sucesso: false,
            conectado: false,
            mensagem: 'Falha de rede ao conectar com os servidores da Asaas: ' + httpErr2.message,
          })
        }
      }

      const agora = new Date().toISOString()
      const statusCode = resTeste ? resTeste.statusCode : 0

      // Mascarar a chave testada
      const chaveMascarada =
        chaveParaTestar.length > 6
          ? '••••••••' + chaveParaTestar.slice(-4)
          : '••••' + chaveParaTestar.slice(-2)

      if (statusCode === 200) {
        const dadosConta = resTeste.json || {}
        const nomeEmpresa = dadosConta.companyName || dadosConta.name || 'Conta Asaas Homologada'
        const emailConta = dadosConta.email || ''
        const cpfCnpjConta = dadosConta.cpfCnpj || ''

        // Atualizar registro no banco com status de sucesso e data da verificação
        try {
          const configRecs = $app.findRecordsByFilter(
            'configuracoes_sistema',
            "chave = 'asaas_api_key'",
            '-created',
            1,
            0,
          )
          if (configRecs.length > 0) {
            const rec = configRecs[0]
            rec.set('ultima_verificacao', agora)
            rec.set('status_verificacao', 'conectado')
            rec.set('metadados', {
              nome_empresa: nomeEmpresa,
              email: emailConta,
              cpf_cnpj: cpfCnpjConta,
              ultima_checagem: agora,
              endpoint: endpointTestado,
            })
            $app.save(rec)
          }
        } catch (saveErr) {
          console.warn('[gateway_testar] Aviso ao salvar status:', saveErr)
        }

        return e.json(200, {
          sucesso: true,
          conectado: true,
          status_code: 200,
          chave_mascarada: chaveMascarada,
          mensagem: `Conexão validada com sucesso na Asaas! Conta: "${nomeEmpresa}".`,
          conta: {
            nome: nomeEmpresa,
            email: emailConta,
            cpf_cnpj: cpfCnpjConta,
            verificado_em: agora,
          },
        })
      } else {
        const descErro =
          resTeste?.json?.errors?.[0]?.description ||
          resTeste?.json?.message ||
          resTeste?.raw ||
          'Chave de API recusada pela Asaas (HTTP ' + statusCode + ')'

        // Atualizar status no banco
        try {
          const configRecs = $app.findRecordsByFilter(
            'configuracoes_sistema',
            "chave = 'asaas_api_key'",
            '-created',
            1,
            0,
          )
          if (configRecs.length > 0) {
            const rec = configRecs[0]
            rec.set('ultima_verificacao', agora)
            rec.set('status_verificacao', 'erro')
            $app.save(rec)
          }
        } catch (_) {}

        return e.json(200, {
          sucesso: false,
          conectado: false,
          status_code: statusCode,
          chave_mascarada: chaveMascarada,
          mensagem: `A Asaas recusou a chave de API: ${descErro}`,
          detalhes: resTeste?.json || null,
        })
      }
    } catch (err) {
      console.error('[gateway_testar] Erro geral:', err)
      return e.json(500, {
        sucesso: false,
        conectado: false,
        mensagem: err.message || 'Erro interno ao testar conexão Asaas',
      })
    }
  },
  $apis.requireAuth(),
)
