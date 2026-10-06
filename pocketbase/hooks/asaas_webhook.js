// @ts-nocheck
routerAdd('POST', '/backend/v1/asaas/webhook', (e) => {
  try {
    const headers = e.requestInfo().headers || {}
    // Token enviado pela Asaas no header asaas-access-token
    const receivedToken =
      headers['asaas-access-token'] ||
      headers['Asaas-Access-Token'] ||
      headers['ASAAS-ACCESS-TOKEN'] ||
      ''

    let expectedToken = ''
    try {
      const configRecs = $app.findRecordsByFilter(
        'configuracoes_sistema',
        "chave = 'asaas_webhook_token'",
        '-created',
        1,
        0,
      )
      if (configRecs.length > 0 && configRecs[0].getString('valor')) {
        expectedToken = configRecs[0].getString('valor').trim()
      }
    } catch (_) {}

    if (!expectedToken) {
      expectedToken = ($os.getenv('ASAAS_WEBHOOK_TOKEN') || '').trim()
    }

    if (expectedToken && receivedToken && receivedToken !== expectedToken) {
      console.warn(`[asaas_webhook] Token do webhook inválido recebido: "${receivedToken}"`)
      return e.json(401, { error: 'Webhook token de segurança inválido' })
    }

    const body = e.requestInfo().body || {}
    const eventName = body.event || ''
    const payment = body.payment || {}
    const asaasPaymentId = payment.id || ''

    console.log(
      `[asaas_webhook] Evento recebido: "${eventName}" para cobrança Asaas: "${asaasPaymentId}"`,
    )

    if (!asaasPaymentId) {
      return e.json(200, { recebido: true, ignorado: true, motivo: 'Sem ID de cobrança' })
    }

    // 1. Localizar registro correspondente na coleção 'pagamentos'
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
    } catch (findErr) {
      console.warn(`[asaas_webhook] Aviso na busca da cobrança ${asaasPaymentId}:`, findErr)
    }

    // Se não encontrou por asaas_id, tenta por externalReference
    if (!pagamentoRecord && payment.externalReference) {
      try {
        const pagamentosPorRef = $app.findRecordsByFilter(
          'pagamentos',
          "referencia_transacao = '" + payment.externalReference + "'",
          '-created',
          1,
          0,
        )
        if (pagamentosPorRef.length > 0) {
          pagamentoRecord = pagamentosPorRef[0]
        }
      } catch (_) {}
    }

    if (!pagamentoRecord) {
      console.warn(
        `[asaas_webhook] Registro de pagamento não encontrado para Asaas ID: ${asaasPaymentId}.`,
      )
      return e.json(200, {
        recebido: true,
        aviso: 'Pagamento não encontrado na base do OrçaFácil',
        asaas_id: asaasPaymentId,
      })
    }

    const userId = pagamentoRecord.getString('user_id')
    const statusAtual = pagamentoRecord.getString('status')
    const agora = new Date()

    // Descobrir qual o plano contratado registrado na venda
    const metaPag = pagamentoRecord.get('metadados') || {}
    let planoIdContratado = metaPag.plano_id || 'essencial'
    let planoNomeContratado = pagamentoRecord.getString('plano_nome') || metaPag.plano_nome || ''

    // Se não estiver preenchido no metadados, infere pelo valor do pagamento ou descrição
    const valorPagoNum = Number(payment.value) || Number(pagamentoRecord.get('valor')) || 49.9
    if (!planoNomeContratado) {
      if (valorPagoNum >= 75) {
        planoIdContratado = 'premium'
        planoNomeContratado = 'Premium'
      } else if (valorPagoNum >= 60) {
        planoIdContratado = 'profissional'
        planoNomeContratado = 'Profissional'
      } else {
        planoIdContratado = 'essencial'
        planoNomeContratado = 'Essencial'
      }
    } else {
      const lower = planoNomeContratado.toLowerCase()
      if (lower.includes('premium')) {
        planoIdContratado = 'premium'
        planoNomeContratado = 'Premium'
      } else if (lower.includes('pro')) {
        planoIdContratado = 'profissional'
        planoNomeContratado = 'Profissional'
      } else {
        planoIdContratado = 'essencial'
        planoNomeContratado = 'Essencial'
      }
    }

    // Tratar eventos de confirmação / recebimento de pagamento
    const isPagoEvent = eventName === 'PAYMENT_RECEIVED' || eventName === 'PAYMENT_CONFIRMED'

    const isCanceladoEvent =
      eventName === 'PAYMENT_DELETED' ||
      eventName === 'PAYMENT_REFUNDED' ||
      eventName === 'PAYMENT_CHARGEBACK_REQUESTED' ||
      eventName === 'PAYMENT_CHARGEBACK_DISPUTE'

    const isExpiradoEvent = eventName === 'PAYMENT_OVERDUE'

    // =======================================================================
    // CASO 1: PAGAMENTO CONFIRMADO / RECEBIDO
    // =======================================================================
    if (isPagoEvent) {
      const jaEstavaPago = statusAtual === 'pago'
      const pagoEmData = payment.paymentDate || payment.clientPaymentDate || agora.toISOString()

      // Renovação para +30 dias a partir do pagamento
      const dataRenovacao = new Date(pagoEmData)
      dataRenovacao.setDate(dataRenovacao.getDate() + 30)

      pagamentoRecord.set('status', 'pago')
      pagamentoRecord.set('pago_em', new Date(pagoEmData).toISOString())
      pagamentoRecord.set('data_vencimento', dataRenovacao.toISOString())
      pagamentoRecord.set('plano_nome', planoNomeContratado)

      const metaAtual = pagamentoRecord.get('metadados') || {}
      metaAtual.webhook_evento_pago = eventName
      metaAtual.webhook_processado_em = agora.toISOString()
      metaAtual.plano_id = planoIdContratado
      metaAtual.plano_nome = planoNomeContratado
      metaAtual.asaas_payment_data = {
        status: payment.status,
        netValue: payment.netValue,
        value: payment.value,
        billingType: payment.billingType,
        paymentDate: payment.paymentDate,
        confirmedDate: payment.confirmedDate,
        transactionReceiptUrl: payment.transactionReceiptUrl,
      }
      pagamentoRecord.set('metadados', metaAtual)
      $app.save(pagamentoRecord)

      // Atualizar assinatura do usuário na coleção 'planos' com o plano exato
      try {
        const planos = $app.findRecordsByFilter(
          'planos',
          "user_id = '" + userId + "'",
          '-created',
          1,
          0,
        )

        if (planos.length > 0) {
          const p = planos[0]
          p.set('plano', planoIdContratado)
          p.set('status', 'ativo')
          p.set('renovacao_em', dataRenovacao.toISOString())
          $app.save(p)
        } else {
          try {
            const colPlanos = $app.findCollectionByNameOrId('planos')
            const p = new Record(colPlanos)
            p.set('user_id', userId)
            p.set('plano', planoIdContratado)
            p.set('status', 'ativo')
            p.set('renovacao_em', dataRenovacao.toISOString())
            $app.save(p)
          } catch (createPlanErr) {
            const retryPlanos = $app.findRecordsByFilter(
              'planos',
              "user_id = '" + userId + "'",
              '-created',
              1,
              0,
            )
            if (retryPlanos.length > 0) {
              const rp = retryPlanos[0]
              rp.set('plano', planoIdContratado)
              rp.set('status', 'ativo')
              rp.set('renovacao_em', dataRenovacao.toISOString())
              $app.save(rp)
            } else {
              throw createPlanErr
            }
          }
        }
        console.log(
          `[asaas_webhook] Assinatura do usuário ${userId} ATIVADA no plano ${planoNomeContratado} (${planoIdContratado}) até ${dataRenovacao.toISOString()}`,
        )
      } catch (planErr) {
        console.error(`[asaas_webhook] Erro ao atualizar coleção planos para ${userId}:`, planErr)
      }

      // Enviar e-mails transacionais (comprovante com plano contratado e valor correto)
      if (!jaEstavaPago) {
        try {
          let usuario = null
          try {
            usuario = $app.findRecordById('_pb_users_auth_', userId)
          } catch (_) {}

          const clienteEmail = usuario ? usuario.getString('email') : ''
          const clienteNome = usuario ? usuario.getString('name') || 'Assinante' : 'Assinante'
          const valorFormatado = 'R$ ' + valorPagoNum.toFixed(2).replace('.', ',')
          const refTransacao = pagamentoRecord.getString('referencia_transacao')
          const dataPagamentoFormatada = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(pagoEmData))

          const remetente = $app.settings().meta.senderAddress || 'suporte@orcafacil.com.br'

          const corpoComprovanteHtml = `
              <!DOCTYPE html>
              <html lang="pt-BR">
              <head>
                <meta charset="utf-8" />
                <title>Comprovante de Pagamento — OrçaFácil</title>
              </head>
              <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
                <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                  
                  <div style="background: linear-gradient(135deg, #059669, #10b981, #047857); padding: 32px 28px; text-align: left; color: #ffffff;">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
                      OrçaFácil • Pagamento Confirmado
                    </div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">
                      ✅ Pagamento Aprovado com Sucesso!
                    </h1>
                    <p style="margin: 6px 0 0 0; font-size: 14px; color: #d1fae5;">
                      Feito para quem vive de serviço • Seu acesso está 100% liberado
                    </p>
                  </div>

                  <div style="padding: 28px;">
                    <p style="font-size: 15px; margin: 0 0 16px 0;">
                      Olá, <strong>${clienteNome}</strong>!
                    </p>
                    <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0;">
                      Confirmamos o recebimento do seu pagamento via <strong>PIX</strong> através do nosso gateway oficial Asaas. Seu <strong>Plano ${planoNomeContratado}</strong> foi ativado com sucesso por mais 30 dias de acesso com todos os recursos contratados.
                    </p>

                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                      <h3 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.05em;">
                        Recibo Oficial de Assinatura
                      </h3>

                      <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; color: #334155;">
                        <tr>
                          <td style="color: #64748b; width: 45%;">Plano Contratado:</td>
                          <td style="font-weight: 700; color: #0f172a;">Plano ${planoNomeContratado} Mensal</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b;">Valor Pago:</td>
                          <td style="font-weight: 800; color: #059669; font-size: 15px;">${valorFormatado}</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b;">Forma de Pagamento:</td>
                          <td style="font-weight: 600;">PIX Instantâneo (Asaas)</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b;">Data do Pagamento:</td>
                          <td style="font-weight: 600;">${dataPagamentoFormatada}</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b;">Próxima Renovação:</td>
                          <td style="font-weight: 700; color: #2563eb;">${new Intl.DateTimeFormat('pt-BR').format(dataRenovacao)}</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b;">Código da Transação:</td>
                          <td style="font-mono; font-size: 12px; color: #64748b;">${refTransacao}</td>
                        </tr>
                        <tr>
                          <td style="color: #64748b;">Identificador Asaas:</td>
                          <td style="font-mono; font-size: 12px; color: #64748b;">${asaasPaymentId}</td>
                        </tr>
                      </table>
                    </div>

                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 24px; font-size: 12px; color: #64748b;">
                      <strong>Dados do Vendedor / Beneficiário:</strong><br />
                      <strong>Razão Social:</strong> QUEVRON TECNOLOGIA INOVA SIMPLES (I.S.)<br />
                      <strong>CNPJ:</strong> 69.482.315/0001-19<br />
                      <strong>Endereço:</strong> R. Mogi Mirim, SN — CH São José, Bela Vista — Águas de Lindoia/SP, CEP 13.942-190<br />
                      <strong>Contato:</strong> jaocarloss@gmail.com
                    </div>

                    <div style="text-align: center; margin: 28px 0 10px 0;">
                      <a href="https://orcafacil.jmsistemas.app.br/orcamentos" style="display: inline-block; background: linear-gradient(135deg, #059669, #047857); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3);">
                        Entrar no OrçaFácil e Usar Meu Plano
                      </a>
                    </div>
                  </div>

                  <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 11px; color: #94a3b8;">
                    OrçaFácil — Feito para quem vive de serviço • Gestão comercial e orçamentos com inteligência artificial.<br />
                    Comprovante gerado automaticamente após confirmação bancária via gateway Asaas.
                  </div>
                </div>
              </body>
              </html>
            `

          if (clienteEmail) {
            try {
              const msgCliente = new MailerMessage({
                from: {
                  address: remetente,
                  name: 'OrçaFácil',
                },
                to: [{ address: clienteEmail, name: clienteNome }],
                subject: `Comprovante de Pagamento — Plano ${planoNomeContratado} OrçaFácil (${valorFormatado})`,
                html: corpoComprovanteHtml,
              })
              $app.newMailClient().send(msgCliente)
              console.log(
                `[asaas_webhook] E-mail de comprovante enviado com sucesso para ${clienteEmail}`,
              )
            } catch (sendErr) {
              console.warn(`[asaas_webhook] Aviso no envio de e-mail ao cliente:`, sendErr)
            }
          }

          // Notificação ao dono jaocarloss@gmail.com com indicação do plano
          const emailDono = 'jaocarloss@gmail.com'
          try {
            const msgDono = new MailerMessage({
              from: {
                address: remetente,
                name: 'OrçaFácil Notificações',
              },
              to: [{ address: emailDono, name: 'João Carlos' }],
              subject: `💰 Nova Venda: Plano ${planoNomeContratado} (${valorFormatado}) - ${clienteNome}`,
              html: `
                  <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
                    <h2 style="color: #059669;">🎉 Nova venda de assinatura confirmada via Asaas!</h2>
                    <p>O cliente <strong>${clienteNome}</strong> (<a href="mailto:${clienteEmail}">${clienteEmail}</a>) contratou o <strong>Plano ${planoNomeContratado}</strong> no valor de <strong>${valorFormatado}</strong> via PIX.</p>
                    <ul>
                      <li><strong>Plano:</strong> ${planoNomeContratado}</li>
                      <li><strong>Valor:</strong> ${valorFormatado}</li>
                      <li><strong>Transação:</strong> ${refTransacao}</li>
                      <li><strong>Asaas ID:</strong> ${asaasPaymentId}</li>
                      <li><strong>Data:</strong> ${dataPagamentoFormatada}</li>
                      <li><strong>Acesso renovado até:</strong> ${new Intl.DateTimeFormat('pt-BR').format(dataRenovacao)}</li>
                    </ul>
                    <p><a href="https://orcafacil.jmsistemas.app.br/admin/vendas" style="display:inline-block; padding:10px 18px; background:#2563eb; color:#fff; text-decoration:none; border-radius:6px;">Acessar Painel de Vendas</a></p>
                  </div>
                `,
            })
            $app.newMailClient().send(msgDono)
            console.log(`[asaas_webhook] Notificação de venda enviada ao dono: ${emailDono}`)
          } catch (donoErr) {
            console.warn(`[asaas_webhook] Aviso no envio de notificação ao dono:`, donoErr)
          }
        } catch (notifErr) {
          console.error('[asaas_webhook] Erro no bloco de envio de comprovantes:', notifErr)
        }
      }

      return e.json(200, {
        sucesso: true,
        evento: eventName,
        status: 'pago',
        plano: planoNomeContratado,
        mensagem: 'Cobrança quitada e assinatura do usuário liberada com sucesso!',
      })
    }

    // =======================================================================
    // CASO 2: CANCELAMENTO OU ESTORNO
    // =======================================================================
    if (isCanceladoEvent) {
      pagamentoRecord.set('status', 'cancelado')
      const metaAtual = pagamentoRecord.get('metadados') || {}
      metaAtual.webhook_evento_cancelado = eventName
      metaAtual.cancelado_em = agora.toISOString()
      pagamentoRecord.set('metadados', metaAtual)
      $app.save(pagamentoRecord)

      try {
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
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        evento: eventName,
        status: 'cancelado',
      })
    }

    // =======================================================================
    // CASO 3: VENCIDO / OVERDUE
    // =======================================================================
    if (isExpiradoEvent) {
      if (statusAtual === 'pendente') {
        pagamentoRecord.set('status', 'cancelado')
        $app.save(pagamentoRecord)
      }
      return e.json(200, {
        sucesso: true,
        evento: eventName,
        status: 'vencido',
      })
    }

    return e.json(200, {
      sucesso: true,
      evento: eventName,
      mensagem: 'Evento recebido e arquivado',
    })
  } catch (err) {
    console.error('[asaas_webhook] Erro inesperado ao processar webhook:', err)
    return e.json(500, { error: err.message || 'Erro interno no processamento do webhook Asaas' })
  }
})
