// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/admin/gateway/salvar-chave',
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

      const body = e.requestInfo().body || {}
      const novaChave = (body.api_key || '').trim()

      if (!novaChave) {
        return e.json(400, { error: 'Nova chave de API da Asaas não informada' })
      }

      if (novaChave.length < 10) {
        return e.json(400, {
          error: 'Chave de API inválida (muito curta para um token Asaas)',
        })
      }

      // Validação opcional prévia na Asaas (se testar_antes for true ou default true)
      const testarAntes = body.testar !== false
      let contaInfo = null

      if (testarAntes) {
        const asaasBaseUrl = 'https://api.asaas.com/v3'
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'OrcaFacil/1.0',
          access_token: novaChave,
        }

        let resTeste = null
        try {
          resTeste = $http.send({
            url: asaasBaseUrl + '/myAccount',
            method: 'GET',
            headers: headers,
            timeout: 15,
          })
        } catch (_) {
          try {
            resTeste = $http.send({
              url: asaasBaseUrl + '/finance/balance',
              method: 'GET',
              headers: headers,
              timeout: 15,
            })
          } catch (netErr) {
            return e.json(502, {
              error: 'Não foi possível validar a nova chave contra a Asaas: ' + netErr.message,
            })
          }
        }

        if (resTeste.statusCode !== 200) {
          const errMsg =
            resTeste?.json?.errors?.[0]?.description ||
            resTeste?.json?.message ||
            'Chave inválida ou recusada pelos servidores da Asaas'
          return e.json(400, {
            error: `A Asaas não aceitou esta chave (HTTP ${resTeste.statusCode}): ${errMsg}. A chave NÃO foi gravada.`,
          })
        }

        contaInfo = resTeste.json || {}
      }

      const agora = new Date().toISOString()

      // Gravar na coleção 'configuracoes_sistema' com chave 'asaas_api_key'
      let configRec = null
      try {
        const recs = $app.findRecordsByFilter(
          'configuracoes_sistema',
          "chave = 'asaas_api_key'",
          '-created',
          1,
          0,
        )
        if (recs.length > 0) {
          configRec = recs[0]
        }
      } catch (_) {}

      const col = $app.findCollectionByNameOrId('configuracoes_sistema')
      if (!configRec) {
        configRec = new Record(col)
        configRec.set('chave', 'asaas_api_key')
      }

      configRec.set('valor', novaChave)
      configRec.set('descricao', 'Chave de API do Gateway Asaas (acesso apenas do backend)')
      configRec.set('tipo', 'secret')
      configRec.set('ultima_verificacao', agora)
      configRec.set('status_verificacao', 'conectado')

      if (contaInfo) {
        configRec.set('metadados', {
          nome_empresa: contaInfo.companyName || contaInfo.name || 'Asaas',
          email: contaInfo.email || '',
          cpf_cnpj: contaInfo.cpfCnpj || '',
          atualizado_por: email,
          atualizado_em: agora,
        })
      }

      $app.save(configRec)

      const chaveMascarada =
        novaChave.length > 6 ? '••••••••' + novaChave.slice(-4) : '••••' + novaChave.slice(-2)

      console.log(
        `[salvar_chave] Chave Asaas atualizada com sucesso pelo admin ${email}. Final: ${novaChave.slice(-4)}`,
      )

      return e.json(200, {
        sucesso: true,
        mensagem: 'Chave de API da Asaas atualizada com sucesso no cofre seguro do sistema!',
        chave_mascarada: chaveMascarada,
        atualizado_em: agora,
        conta: contaInfo
          ? {
              nome: contaInfo.companyName || contaInfo.name,
              email: contaInfo.email,
            }
          : null,
      })
    } catch (err) {
      console.error('[salvar_chave] Erro:', err)
      return e.json(500, {
        error: err.message || 'Erro interno ao salvar chave Asaas',
      })
    }
  },
  $apis.requireAuth(),
)
