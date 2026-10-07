// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/admin/gateway/teste-cobranca-pix',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const email = (authUser.getString('email') || '').toLowerCase().trim()
      const isAdmin = authUser.getBool('admin') || email === 'jaocarloss@gmail.com'
      if (!isAdmin) {
        return e.json(403, {
          error: 'Acesso restrito exclusivamente ao administrador (jaocarloss@gmail.com)',
        })
      }

      // 1. Rate-limit simples: verificar se já existe uma cobrança de teste pendente recente criada há menos de 10 minutos
      try {
        const dezMinAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        const testesPendentes = $app.findRecordsByFilter(
          'pagamentos',
          "user_id = '" +
            authUser.id +
            "' && status = 'pendente' && created >= '" +
            dezMinAtras +
            "' && plano_nome = 'Teste de Validação'",
          '-created',
          1,
          0,
        )

        if (testesPendentes.length > 0) {
          const pendenteRec = testesPendentes[0]
          let pixCopia = pendenteRec.getString('pix_copia_cola') || ''
          if (pixCopia) {
            pixCopia = String(pixCopia)
              .replace(/[\r\n\t]+/g, '')
              .trim()
              .replace(/[\s.]+$/, '')
              .trim()
            const idx6304 = pixCopia.lastIndexOf('6304')
            if (idx6304 !== -1) {
              const trechoApos = pixCopia.slice(idx6304 + 4)
              const matchHex = trechoApos.match(/^[0-9A-Fa-f]{4}/)
              if (matchHex) {
                pixCopia = pixCopia.slice(0, idx6304 + 8)
              } else {
                pixCopia = pixCopia.replace(/[\s.]+$/, '').trim()
              }
            }
          }

          // Retorna a cobrança existente para evitar duplicidade de cobrança pendente
          const meta = pendenteRec.get('metadados') || {}
          return e.json(200, {
            sucesso: true,
            reaproveitado: true,
            pagamento_id: pendenteRec.id,
            asaas_id: pendenteRec.getString('asaas_id'),
            referencia: pendenteRec.getString('referencia_transacao'),
            valor: 5.0,
            status: pendenteRec.getString('status'),
            pix_copia_cola: pixCopia,
            pix_qr_code_base64: pendenteRec.getString('pix_qr_code_url'),
            invoice_url: pendenteRec.getString('invoice_url'),
            vencimento_pix: meta.due_date || '',
            expiracao_qr: meta.pix_expiration || '',
            mensagem:
              'Já existe uma cobrança de teste de R$ 5,00 em andamento. Você pode pagar ou aguardar a confirmação.',
          })
        }
      } catch (rateErr) {
        console.warn('[gateway_teste_pix] Aviso ao verificar rate-limit:', rateErr)
      }

      // 2. Chave de API da Asaas
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
        return e.json(500, { error: 'Chave de API da Asaas não configurada no servidor' })
      }

      const asaasBaseUrl = 'https://api.asaas.com/v3'
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'OrcaFacil/1.0',
        access_token: apiKey,
      }

      const userId = authUser.id
      const userEmail = authUser.getString('email') || 'jaocarloss@gmail.com'
      const userName = authUser.getString('name') || 'Administrador OrçaFácil'

      // 3. Localizar ou criar cliente na Asaas para o admin
      let asaasCustomerId = ''
      try {
        const findCustRes = $http.send({
          url: asaasBaseUrl + '/customers?email=' + encodeURIComponent(userEmail),
          method: 'GET',
          headers: headers,
          timeout: 15,
        })

        if (findCustRes.statusCode === 200 && findCustRes.json?.data?.length > 0) {
          asaasCustomerId = findCustRes.json.data[0].id
        }
      } catch (findErr) {
        console.warn('[gateway_teste_pix] Aviso ao consultar cliente Asaas existente:', findErr)
      }

      if (!asaasCustomerId) {
        const customerPayload = {
          name: userName,
          email: userEmail,
          externalReference: userId,
        }

        const createCustRes = $http.send({
          url: asaasBaseUrl + '/customers',
          method: 'POST',
          headers: headers,
          body: JSON.stringify(customerPayload),
          timeout: 20,
        })

        if (createCustRes.statusCode !== 200) {
          const errMsg =
            createCustRes.json?.errors?.[0]?.description ||
            createCustRes.raw ||
            'Falha ao registrar cliente no gateway Asaas'
          console.error('[gateway_teste_pix] Erro ao criar cliente Asaas:', errMsg)
          return e.json(createCustRes.statusCode || 400, {
            error: errMsg,
            detalhes: createCustRes.json,
          })
        }

        asaasCustomerId = createCustRes.json.id
      }

      // 4. Data de vencimento da cobrança de teste (hoje + 1 dia)
      const dataVenc = new Date()
      dataVenc.setDate(dataVenc.getDate() + 1)
      const yyyy = dataVenc.getFullYear()
      const mm = String(dataVenc.getMonth() + 1).padStart(2, '0')
      const dd = String(dataVenc.getDate()).padStart(2, '0')
      const dueDateStr = `${yyyy}-${mm}-${dd}`

      const refTransacao =
        'OF-TESTE-PIX-' +
        Date.now().toString().slice(-6) +
        '-' +
        Math.random().toString(36).substring(2, 6).toUpperCase()

      const valorTeste = 5.0

      // 5. Criar cobrança PIX de R$ 5,00 no Asaas
      const paymentPayload = {
        customer: asaasCustomerId,
        billingType: 'PIX',
        value: valorTeste,
        dueDate: dueDateStr,
        description: 'TESTE DE VALIDAÇÃO — OrçaFácil (não é venda)',
        externalReference: refTransacao,
        postalService: false,
      }

      const createPayRes = $http.send({
        url: asaasBaseUrl + '/payments',
        method: 'POST',
        headers: headers,
        body: JSON.stringify(paymentPayload),
        timeout: 20,
      })

      if (createPayRes.statusCode !== 200) {
        const errMsg =
          createPayRes.json?.errors?.[0]?.description ||
          createPayRes.raw ||
          'Falha ao gerar cobrança de teste no Asaas'
        console.error('[gateway_teste_pix] Erro ao criar cobrança Asaas:', errMsg)
        return e.json(createPayRes.statusCode || 400, {
          error: errMsg,
          detalhes: createPayRes.json,
        })
      }

      const paymentData = createPayRes.json
      const paymentId = paymentData.id
      const invoiceUrl = paymentData.invoiceUrl || paymentData.bankSlipUrl || ''

      // 6. Buscar o QR Code dinâmico do Pix
      let encodedImage = ''
      let payloadPix = ''
      let expirationDate = ''

      const qrRes = $http.send({
        url: asaasBaseUrl + '/payments/' + paymentId + '/pixQrCode',
        method: 'GET',
        headers: headers,
        timeout: 15,
      })

      if (qrRes.statusCode === 200 && qrRes.json) {
        encodedImage = qrRes.json.encodedImage || ''
        payloadPix = qrRes.json.payload || ''
        expirationDate = qrRes.json.expirationDate || ''

        // Sanitização e validação estrita do payload PIX BR Code
        if (payloadPix) {
          payloadPix = String(payloadPix)
            .replace(/[\r\n\t]+/g, '')
            .trim()
          payloadPix = payloadPix.replace(/[\s.]+$/, '').trim()

          // Se tiver "6304" seguido de 4 hex chars, garante que corte exatamente após o CRC
          const idx6304 = payloadPix.lastIndexOf('6304')
          if (idx6304 !== -1) {
            const trechoApos = payloadPix.slice(idx6304 + 4)
            const matchHex = trechoApos.match(/^[0-9A-Fa-f]{4}/)
            if (matchHex) {
              payloadPix = payloadPix.slice(0, idx6304 + 8)
            } else {
              payloadPix = payloadPix.replace(/[\s.]+$/, '').trim()
            }
          }
        }
      } else {
        console.warn('[gateway_teste_pix] Aviso ao obter QR Code do Pix:', qrRes.raw)
      }

      // 7. Gravar na coleção 'pagamentos' com marcação explícita de teste
      const agora = new Date()
      const colPag = $app.findCollectionByNameOrId('pagamentos')
      const rec = new Record(colPag)
      rec.set('user_id', userId)
      rec.set('valor', valorTeste)
      rec.set('forma_pagamento', 'pix')
      rec.set('status', 'pendente')
      rec.set('data_compra', agora.toISOString())
      rec.set('data_vencimento', agora.toISOString())
      rec.set('referencia_transacao', refTransacao)
      rec.set('plano_nome', 'Teste de Validação')
      rec.set('asaas_id', paymentId)
      rec.set('asaas_customer_id', asaasCustomerId)
      rec.set('pix_qr_code_url', encodedImage ? 'data:image/png;base64,' + encodedImage : '')
      rec.set('pix_copia_cola', payloadPix)
      rec.set('invoice_url', invoiceUrl)
      rec.set('metadados', {
        is_teste: true,
        tipo_teste: 'validacao_webhook_pix',
        modo: 'real',
        gateway: 'Asaas',
        plano_id: 'teste_validacao',
        plano_nome: 'Teste de Validação',
        valor: valorTeste,
        asaas_payment_id: paymentId,
        asaas_customer_id: asaasCustomerId,
        asaas_status: paymentData.status,
        due_date: dueDateStr,
        pix_expiration: expirationDate,
        criado_por: email,
        criado_em: agora.toISOString(),
      })

      $app.save(rec)

      console.log(
        `[gateway_teste_pix] Cobrança de TESTE de R$ 5,00 criada: ${paymentId} para admin ${userId} (${email})`,
      )

      return e.json(200, {
        sucesso: true,
        pagamento_id: rec.id,
        plano_nome: 'Teste de Validação',
        asaas_id: paymentId,
        asaas_customer_id: asaasCustomerId,
        referencia: refTransacao,
        valor: valorTeste,
        status: 'pendente',
        pix_copia_cola: payloadPix,
        pix_qr_code_base64: encodedImage ? 'data:image/png;base64,' + encodedImage : '',
        invoice_url: invoiceUrl,
        vencimento_pix: dueDateStr,
        expiracao_qr: expirationDate,
        mensagem:
          'Cobrança de teste PIX de R$ 5,00 gerada com sucesso na Asaas. Pague com outro aparelho/conta para testar o webhook.',
      })
    } catch (err) {
      console.error('[gateway_teste_pix] Erro inesperado:', err)
      return e.json(500, {
        error: err.message || 'Erro interno ao gerar cobrança de teste no Asaas',
      })
    }
  },
  $apis.requireAuth(),
)
