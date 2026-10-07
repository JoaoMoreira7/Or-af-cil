// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/asaas/criar-pix',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
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
        return e.json(500, { error: 'Chave de API da Asaas não configurada no servidor' })
      }

      const body = e.requestInfo().body || {}
      const userId = authUser.id
      const userEmail = authUser.getString('email') || body.email || ''
      const userName = authUser.getString('name') || body.nome || 'Cliente OrçaFácil'
      const cpfCnpj = (body.cpfCnpj || '').replace(/\D/g, '')
      const telefone = (body.telefone || '').replace(/\D/g, '')

      // Mapeamento dos 3 planos com preços oficiais definidos pelo usuário
      // Essencial: R$ 49,90 | Profissional: R$ 64,90 | Premium: R$ 79,90
      const planosPrecos = {
        essencial: { id: 'essencial', nome: 'Essencial', valor: 49.9 },
        profissional: { id: 'profissional', nome: 'Profissional', valor: 64.9 },
        premium: { id: 'premium', nome: 'Premium', valor: 79.9 },
        // Compatibilidade legada
        starter: { id: 'essencial', nome: 'Essencial', valor: 49.9 },
        pro: { id: 'profissional', nome: 'Profissional', valor: 64.9 },
      }

      const planoSolicitado = String(body.plano || body.plano_id || 'essencial')
        .toLowerCase()
        .trim()
      const planoEscolhido = planosPrecos[planoSolicitado] || planosPrecos.essencial
      const valorPlano = planoEscolhido.valor
      const nomePlano = planoEscolhido.nome
      const idPlano = planoEscolhido.id

      const asaasBaseUrl = 'https://api.asaas.com/v3'
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'OrcaFacil/1.0',
        access_token: apiKey,
      }

      // 1. Localizar ou criar cliente na Asaas
      let asaasCustomerId = ''

      if (userEmail) {
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
          console.warn('[asaas_criar_pix] Aviso ao consultar cliente existente:', findErr)
        }
      }

      if (!asaasCustomerId) {
        const customerPayload = {
          name: userName,
          email: userEmail,
          externalReference: userId,
        }
        if (cpfCnpj && (cpfCnpj.length === 11 || cpfCnpj.length === 14)) {
          customerPayload.cpfCnpj = cpfCnpj
        }
        if (telefone) {
          customerPayload.mobilePhone = telefone
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
            'Falha ao criar cliente no gateway Asaas'
          console.error('[asaas_criar_pix] Erro ao criar cliente Asaas:', errMsg)
          return e.json(createCustRes.statusCode || 400, {
            error: errMsg,
            detalhes: createCustRes.json,
          })
        }

        asaasCustomerId = createCustRes.json.id
      }

      // 2. Data de vencimento da cobrança PIX (hoje + 3 dias)
      const dataVenc = new Date()
      dataVenc.setDate(dataVenc.getDate() + 3)
      const yyyy = dataVenc.getFullYear()
      const mm = String(dataVenc.getMonth() + 1).padStart(2, '0')
      const dd = String(dataVenc.getDate()).padStart(2, '0')
      const dueDateStr = `${yyyy}-${mm}-${dd}`

      const refTransacao =
        'OF-PIX-' +
        Date.now().toString().slice(-6) +
        '-' +
        Math.random().toString(36).substring(2, 6).toUpperCase()

      const valorFormatadoBr = 'R$ ' + valorPlano.toFixed(2).replace('.', ',')

      // 3. Criar cobrança PIX no Asaas com valor e descrição do plano escolhido
      const paymentPayload = {
        customer: asaasCustomerId,
        billingType: 'PIX',
        value: valorPlano,
        dueDate: dueDateStr,
        description: `OrçaFácil — Plano ${nomePlano} (${valorFormatadoBr}/mês) - Feito para quem vive de serviço`,
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
          'Falha ao gerar cobrança no Asaas'
        console.error('[asaas_criar_pix] Erro ao criar pagamento Asaas:', errMsg)
        return e.json(createPayRes.statusCode || 400, {
          error: errMsg,
          detalhes: createPayRes.json,
        })
      }

      const paymentData = createPayRes.json
      const paymentId = paymentData.id
      const invoiceUrl = paymentData.invoiceUrl || paymentData.bankSlipUrl || ''

      // 4. Buscar o QR Code dinâmico do Pix
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
        console.warn('[asaas_criar_pix] Aviso ao obter QR Code do Pix:', qrRes.raw)
      }

      // 5. Gravar na coleção 'pagamentos' com o plano correto e status pendente
      const agora = new Date()
      const dataVencAssinatura = new Date(agora)
      dataVencAssinatura.setDate(dataVencAssinatura.getDate() + 30)

      const colPag = $app.findCollectionByNameOrId('pagamentos')
      const rec = new Record(colPag)
      rec.set('user_id', userId)
      rec.set('valor', valorPlano)
      rec.set('forma_pagamento', 'pix')
      rec.set('status', 'pendente')
      rec.set('data_compra', agora.toISOString())
      rec.set('data_vencimento', dataVencAssinatura.toISOString())
      rec.set('referencia_transacao', refTransacao)
      rec.set('plano_nome', nomePlano)
      rec.set('asaas_id', paymentId)
      rec.set('asaas_customer_id', asaasCustomerId)
      rec.set('pix_qr_code_url', encodedImage ? 'data:image/png;base64,' + encodedImage : '')
      rec.set('pix_copia_cola', payloadPix)
      rec.set('invoice_url', invoiceUrl)
      rec.set('metadados', {
        modo: 'real',
        gateway: 'Asaas',
        plano_id: idPlano,
        plano_nome: nomePlano,
        asaas_payment_id: paymentId,
        asaas_customer_id: asaasCustomerId,
        asaas_status: paymentData.status,
        due_date: dueDateStr,
        pix_expiration: expirationDate,
        empresa_beneficiaria: 'QUEVRON TECNOLOGIA INOVA SIMPLES (I.S.)',
        cnpj_beneficiaria: '69.482.315/0001-19',
      })

      $app.save(rec)

      console.log(
        `[asaas_criar_pix] Cobrança PIX criada com sucesso: ${paymentId} para plano ${nomePlano} (R$ ${valorPlano}) usuário ${userId}`,
      )

      return e.json(200, {
        sucesso: true,
        pagamento_id: rec.id,
        plano_id: idPlano,
        plano_nome: nomePlano,
        asaas_id: paymentId,
        asaas_customer_id: asaasCustomerId,
        referencia: refTransacao,
        valor: valorPlano,
        status: 'pendente',
        pix_copia_cola: payloadPix,
        pix_qr_code_base64: encodedImage ? 'data:image/png;base64,' + encodedImage : '',
        invoice_url: invoiceUrl,
        vencimento_pix: dueDateStr,
        expiracao_qr: expirationDate,
        mensagem: `Cobrança PIX do plano ${nomePlano} (${valorFormatadoBr}) gerada com sucesso via Asaas. Aguardando pagamento.`,
      })
    } catch (err) {
      console.error('[asaas_criar_pix] Erro inesperado:', err)
      return e.json(500, {
        error: err.message || 'Erro interno ao gerar cobrança PIX no Asaas',
      })
    }
  },
  $apis.requireAuth(),
)
