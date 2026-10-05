// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/resumo-semanal',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const userId = e.auth?.id || body.userId
      if (!userId) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const agora = new Date()
      // Últimos 7 dias
      const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
      // Limite para orçamentos sem resposta há 5+ dias
      const cincoDiasAtras = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000)

      // 1. Carrega preferências de IA do usuário
      let prefNome = ''
      let prefTom = 'amigavel' // 'formal', 'amigavel', 'direto'
      let prefEmojis = true

      try {
        const prefRec = $app.findFirstRecordByData('preferencias_ia', 'user_id', userId)
        if (prefRec) {
          prefNome = prefRec.getString('nome_preferido') || ''
          prefTom = prefRec.getString('tom_resposta') || 'amigavel'
          prefEmojis = prefRec.getBool('usar_emojis')
        }
      } catch (_) {
        try {
          const u = $app.findRecordById('_pb_users_auth_', userId)
          if (u) {
            prefNome = (u.getString('name') || '').split(' ')[0]
          }
        } catch (_) {}
      }

      if (body.preferencias) {
        if (body.preferencias.nome_preferido !== undefined) {
          prefNome = body.preferencias.nome_preferido
        }
        if (body.preferencias.tom_resposta) {
          prefTom = body.preferencias.tom_resposta
        }
        if (body.preferencias.usar_emojis !== undefined) {
          prefEmojis = !!body.preferencias.usar_emojis
        }
      }

      // 2. Busca orçamentos do usuário
      let orcamentosTodos = []
      try {
        orcamentosTodos = $app.findRecordsByFilter(
          'orcamentos',
          "user_id = '" + userId + "'",
          '-created',
          200,
          0,
        )
      } catch (err) {}

      // Agregação dos orçamentos
      let orcamentosCriadosSemana = 0
      let orcamentosAprovadosSemana = 0
      let valorAprovadoSemana = 0
      let orcamentosSemResposta5Dias = 0
      let orcamentosEnviadosSemana = 0

      for (let i = 0; i < orcamentosTodos.length; i++) {
        const o = orcamentosTodos[i]
        const createdStr = o.getString('created') || ''
        const createdDate = new Date(createdStr)
        const valor = o.getFloat('valor_total') || 0
        const status = o.getString('status') || ''

        // Criados nos últimos 7 dias
        if (createdDate >= seteDiasAtras) {
          orcamentosCriadosSemana++
          if (status === 'enviado') {
            orcamentosEnviadosSemana++
          }
        }

        // Aprovados com atualização ou criação nos últimos 7 dias
        const updatedStr = o.getString('updated') || createdStr
        const updatedDate = new Date(updatedStr)
        if (
          status === 'aprovado' &&
          (updatedDate >= seteDiasAtras || createdDate >= seteDiasAtras)
        ) {
          orcamentosAprovadosSemana++
          valorAprovadoSemana += valor
        }

        // Sem resposta há 5+ dias: status 'enviado' ou 'rascunho' criados há 5 dias ou mais
        if ((status === 'enviado' || status === 'rascunho') && createdDate <= cincoDiasAtras) {
          orcamentosSemResposta5Dias++
        }
      }

      // 3. Busca cobranças do usuário
      let cobrancasTodas = []
      try {
        cobrancasTodas = $app.findRecordsByFilter(
          'cobrancas',
          "user_id = '" + userId + "'",
          '-created',
          200,
          0,
        )
      } catch (err) {}

      let cobrancasPagasSemana = 0
      let valorCobradoPagoSemana = 0
      let cobrancasPendentes = 0
      let valorPendenteReceber = 0

      for (let i = 0; i < cobrancasTodas.length; i++) {
        const c = cobrancasTodas[i]
        const status = c.getString('status')
        const valor = c.getFloat('valor') || 0
        const pagoEmStr = c.getString('pago_em') || c.getString('updated')
        const pagoEm = pagoEmStr ? new Date(pagoEmStr) : null

        if (status === 'pago') {
          if (pagoEm && pagoEm >= seteDiasAtras) {
            cobrancasPagasSemana++
            valorCobradoPagoSemana += valor
          }
        } else if (status === 'pendente') {
          cobrancasPendentes++
          valorPendenteReceber += valor
        }
      }

      // Se não há cobranças pendentes cadastradas explicitamente, calcula o saldo a receber dos orçamentos aprovados
      if (valorPendenteReceber === 0) {
        for (let i = 0; i < orcamentosTodos.length; i++) {
          const o = orcamentosTodos[i]
          if (o.getString('status') === 'aprovado') {
            let pago = false
            for (let k = 0; k < cobrancasTodas.length; k++) {
              if (
                cobrancasTodas[k].getString('orcamento_id') === o.id &&
                cobrancasTodas[k].getString('status') === 'pago'
              ) {
                pago = true
                break
              }
            }
            if (!pago) {
              valorPendenteReceber += o.getFloat('valor_total') || 0
            }
          }
        }
      }

      // 4. Busca novos clientes nos últimos 7 dias
      let novosClientesSemana = 0
      try {
        const clientes = $app.findRecordsByFilter(
          'clientes',
          "user_id = '" + userId + "'",
          '-created',
          100,
          0,
        )
        for (let i = 0; i < clientes.length; i++) {
          const createdStr = clientes[i].getString('created') || ''
          if (new Date(createdStr) >= seteDiasAtras) {
            novosClientesSemana++
          }
        }
      } catch (err) {}

      const metricas = {
        orcamentos_criados: orcamentosCriadosSemana,
        orcamentos_enviados: orcamentosEnviadosSemana,
        orcamentos_aprovados: orcamentosAprovadosSemana,
        valor_aprovado: valorAprovadoSemana,
        cobrancas_pagas: cobrancasPagasSemana,
        valor_pago: valorCobradoPagoSemana,
        cobrancas_pendentes: cobrancasPendentes,
        valor_pendente: valorPendenteReceber,
        novos_clientes: novosClientesSemana,
        orcamentos_sem_resposta_5_dias: orcamentosSemResposta5Dias,
      }

      // 5. Monta texto fallback inteligente caso o LLM esteja sem resposta
      const formatarMoeda = function (num) {
        return 'R$ ' + (num || 0).toFixed(2).replace('.', ',')
      }

      const saudacaoNome = prefNome ? prefNome : 'parceiro(a)'
      let fallbackTexto = ''
      const emojiIcon = prefEmojis ? '🎙️ ' : ''
      const emojiCheck = prefEmojis ? '✅ ' : ''
      const emojiMoney = prefEmojis ? '💰 ' : ''
      const emojiSparkle = prefEmojis ? '✨ ' : ''

      if (prefTom === 'formal') {
        const trat = prefNome ? 'Prezado(a) ' + prefNome : 'Prezado(a) gestor(a)'
        fallbackTexto =
          trat +
          ', aqui está o seu balanço semanal de atividades. ' +
          'Nos últimos 7 dias, foram formalizados ' +
          orcamentosCriadosSemana +
          ' novo(s) orçamento(s) ' +
          'e aprovado(s) ' +
          orcamentosAprovadosSemana +
          ' (' +
          formatarMoeda(valorAprovadoSemana) +
          '). ' +
          (orcamentosSemResposta5Dias > 0
            ? 'Atualmente, há ' +
              orcamentosSemResposta5Dias +
              ' proposta(s) aguardando retorno há mais de 5 dias. '
            : 'Não constam propostas pendentes há mais de 5 dias. ') +
          (valorPendenteReceber > 0
            ? 'O saldo total pendente a receber é de ' + formatarMoeda(valorPendenteReceber) + '. '
            : 'Não há pendências de recebimento. ') +
          (novosClientesSemana > 0
            ? 'Houve ' + novosClientesSemana + ' novo(s) cliente(s) cadastrado(s). '
            : '') +
          'Desejamos uma excelente semana de trabalho.'
      } else if (prefTom === 'direto') {
        fallbackTexto =
          'Resumo da semana: ' +
          orcamentosAprovadosSemana +
          ' orçamentos fechados (' +
          formatarMoeda(valorAprovadoSemana) +
          '), ' +
          orcamentosCriadosSemana +
          ' criados e ' +
          orcamentosSemResposta5Dias +
          ' aguardando retorno há mais de 5 dias. ' +
          'Saldo a receber: ' +
          formatarMoeda(valorPendenteReceber) +
          '. ' +
          (novosClientesSemana > 0 ? novosClientesSemana + ' novos clientes. ' : '') +
          'Boa semana.'
      } else {
        // amigável padrão estilo "podcast de 1 minuto" do Meu Assessor
        fallbackTexto =
          emojiIcon +
          'Olá, ' +
          saudacaoNome +
          '! Aqui é seu resumo semanal em áudio de 1 minuto. ' +
          emojiCheck +
          'Esta semana você fechou ' +
          orcamentosAprovadosSemana +
          ' orçamento(s) totalizando ' +
          formatarMoeda(valorAprovadoSemana) +
          ', ' +
          'criou ' +
          orcamentosCriadosSemana +
          ' nova(s) proposta(s) ' +
          (orcamentosSemResposta5Dias > 0
            ? 'e tem ' + orcamentosSemResposta5Dias + ' aguardando resposta há mais de 5 dias. '
            : 'e todos os contatos estão em dia! ') +
          (valorPendenteReceber > 0
            ? emojiMoney + 'Você tem ' + formatarMoeda(valorPendenteReceber) + ' a receber. '
            : 'Suas contas estão 100% em dia. ') +
          (novosClientesSemana > 0
            ? emojiSparkle +
              'Além disso, conquistou ' +
              novosClientesSemana +
              ' novo(s) cliente(s)! '
            : '') +
          'Continue com esse ritmo e tenha uma excelente semana!'
      }

      // 6. Chamada ao $ai.chat (alias "fast") para gerar podcast falado personalizado
      let textoGerado = fallbackTexto
      try {
        const promptSistema =
          'Você é o assistente virtual executivo da plataforma OrçaFácil (estilo o app Meu Assessor).\n' +
          'Sua missão é produzir um "podcast de 1 minuto" em texto corrido em português do Brasil (pt-BR) ' +
          'para ser LIDO EM VOZ ALTA por um sintetizador de voz (Web Speech API).\n\n' +
          'REGRAS DO TEXTO:\n' +
          '1. Escreva um texto fluido, natural de falar, com pontuação adequada para pausas de respiração.\n' +
          '2. Duração ideal de fala: entre 40 a 60 segundos (cerca de 70 a 110 palavras).\n' +
          '3. Persona do usuário:\n' +
          '   - Nome preferido: ' +
          (prefNome || 'Gestor(a)') +
          '\n' +
          '   - Tom: ' +
          prefTom +
          ' (formal: polido e profissional; amigavel: motivador, caloroso e parceiro; direto: objetivo, sem rodeios)\n' +
          '   - Usar emojis no texto: ' +
          (prefEmojis ? 'sim (poucos e bem colocados)' : 'não') +
          '\n' +
          '4. Fale explicitamente dos números consolidados da semana:\n' +
          '   - Orçamentos fechados/aprovados e valor em reais\n' +
          '   - Orçamentos criados/enviados\n' +
          '   - Orçamentos pendentes sem resposta há mais de 5 dias (se houver, alerte com cuidado)\n' +
          '   - Saldo pendente a receber (se houver)\n' +
          '   - Novos clientes adicionados (se houver)\n' +
          '5. Termine com uma mensagem de encorajamento positiva para a semana.\n' +
          '6. NÃO use tags markdown como títulos (#), negrito (**), marcadores (-) ou tabelas: o texto será lido por síntese de voz, então retorne apenas parágrafos falados contínuos.'

        const promptUsuario =
          'Consolidação dos últimos 7 dias do usuário:\n' +
          '- Orçamentos criados: ' +
          metricas.orcamentos_criados +
          '\n' +
          '- Orçamentos enviados: ' +
          metricas.orcamentos_enviados +
          '\n' +
          '- Orçamentos aprovados: ' +
          metricas.orcamentos_aprovados +
          ' (Total: ' +
          formatarMoeda(metricas.valor_aprovado) +
          ')\n' +
          '- Cobranças pagas na semana: ' +
          metricas.cobrancas_pagas +
          ' (' +
          formatarMoeda(metricas.valor_pago) +
          ')\n' +
          '- Cobranças / valores a receber pendentes: ' +
          formatarMoeda(metricas.valor_pendente) +
          '\n' +
          '- Orçamentos sem resposta há 5+ dias: ' +
          metricas.orcamentos_sem_resposta_5_dias +
          '\n' +
          '- Novos clientes cadastrados na semana: ' +
          metricas.novos_clientes +
          '\n\n' +
          'Gere o roteiro do resumo semanal de voz agora:'

        const aiRes = $ai.chat({
          model: 'fast',
          messages: [
            { role: 'system', content: promptSistema },
            { role: 'user', content: promptUsuario },
          ],
        })

        const respostaAi = aiRes?.choices?.[0]?.message?.content
        if (respostaAi && typeof respostaAi === 'string' && respostaAi.trim().length > 30) {
          // Remove asteriscos e hashtags que atrapalham síntese de voz
          textoGerado = respostaAi
            .replace(/[#*_`]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        }
      } catch (aiErr) {
        // Mantém fallback inteligente
      }

      // Se solicitado disparo de e-mail de teste/manual através do mesmo endpoint
      let envioEmailInfo = null
      if (body.enviar_email === true || body.disparar_email === true) {
        try {
          // Identifica e-mail do destinatário
          let emailDest = ''
          let nomeDest = prefNome || 'Parceiro(a)'
          try {
            const uRec = $app.findRecordById('_pb_users_auth_', userId)
            if (uRec) {
              emailDest = uRec.getString('email') || ''
              nomeDest = uRec.getString('name') || prefNome || 'Parceiro(a)'
            }
          } catch (_) {}

          if (emailDest) {
            // Calcula chave ISO da semana atual
            const targetData = new Date(agora.valueOf())
            const dayNr = (agora.getDay() + 6) % 7
            targetData.setDate(targetData.getDate() - dayNr + 3)
            const firstThursday = targetData.valueOf()
            targetData.setMonth(0, 1)
            if (targetData.getDay() !== 4) {
              targetData.setMonth(0, 1 + ((4 - targetData.getDay() + 7) % 7))
            }
            const weekNumber = 1 + Math.ceil((firstThursday - targetData.valueOf()) / 604800000)
            const weekStr = weekNumber < 10 ? '0' + weekNumber : '' + weekNumber
            const chaveSemanaAtual = targetData.getFullYear() + '-W' + weekStr

            const assuntoEmail = 'Seu resumo da semana — OrçaFácil'
            const emojiDestaque = prefEmojis ? '📊 ' : ''
            const saudacao =
              prefTom === 'formal'
                ? 'Prezado(a) ' + prefNome
                : prefTom === 'direto'
                  ? 'Olá, ' + prefNome
                  : 'Olá, ' + prefNome + '!'

            const semMovimentacao =
              metricas.orcamentos_criados === 0 &&
              metricas.orcamentos_aprovados === 0 &&
              metricas.cobrancas_pagas === 0 &&
              metricas.novos_clientes === 0

            const textoEditorialEmail = (textoGerado || fallbackTexto).replace(
              /\n\s*\n/g,
              '<br/><br/>',
            )

            const corpoHtml = `
              <!DOCTYPE html>
              <html lang="pt-BR">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>${assuntoEmail}</title>
              </head>
              <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
                <div style="max-width: 620px; margin: 30px auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
                  
                  <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb, #7c3aed); padding: 32px 28px; text-align: left; color: #ffffff;">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
                      OrçaFácil • Inteligência Comercial
                    </div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; line-height: 1.3; color: #ffffff;">
                      ${emojiDestaque}Resumo da Semana
                    </h1>
                    <p style="margin: 6px 0 0 0; font-size: 14px; color: #dbeafe; opacity: 0.95;">
                      Semana ${chaveSemanaAtual} • Balanço dos últimos 7 dias
                    </p>
                  </div>

                  <div style="padding: 28px;">
                    <h2 style="font-size: 18px; color: #0f172a; margin: 0 0 16px 0; font-weight: 600;">
                      ${saudacao}
                    </h2>

                    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 18px; border-radius: 8px; margin-bottom: 24px; font-size: 15px; color: #166534; line-height: 1.6;">
                      ${textoEditorialEmail}
                    </div>

                    <h3 style="font-size: 14px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 14px 0;">
                      Destaques da Operação
                    </h3>

                    <div style="margin-bottom: 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout: fixed;">
                        <tr>
                          <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">
                              ${prefEmojis ? '✅ ' : ''}Orçamentos Aprovados
                            </div>
                            <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
                              ${metricas.orcamentos_aprovados}
                            </div>
                            <div style="font-size: 13px; font-weight: 600; color: #16a34a;">
                              ${formatarMoeda(metricas.valor_aprovado)}
                            </div>
                          </td>

                          <td width="4%"></td>

                          <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">
                              ${prefEmojis ? '📝 ' : ''}Novos Orçamentos
                            </div>
                            <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
                              ${metricas.orcamentos_criados}
                            </div>
                            <div style="font-size: 13px; color: #64748b;">
                              ${metricas.orcamentos_enviados} enviado(s)
                            </div>
                          </td>
                        </tr>

                        <tr><td colspan="3" height="12"></td></tr>

                        <tr>
                          <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">
                              ${prefEmojis ? '💰 ' : ''}Saldo a Receber
                            </div>
                            <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
                              ${formatarMoeda(metricas.valor_pendente)}
                            </div>
                            <div style="font-size: 12px; color: #64748b;">
                              ${metricas.cobrancas_pagas} recebimento(s) pago(s)
                            </div>
                          </td>

                          <td width="4%"></td>

                          <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">
                              ${prefEmojis ? '👥 ' : ''}Novos Clientes
                            </div>
                            <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
                              ${metricas.novos_clientes}
                            </div>
                            <div style="font-size: 12px; color: ${metricas.orcamentos_sem_resposta_5_dias > 0 ? '#d97706' : '#64748b'};">
                              ${metricas.orcamentos_sem_resposta_5_dias > 0 ? '⚠️ ' + metricas.orcamentos_sem_resposta_5_dias + ' sem resposta (5d+)' : 'Contatos atualizados'}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </div>

                    ${
                      semMovimentacao
                        ? `
                      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; text-align: center;">
                        <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 500;">
                          💡 <strong>Dica da Semana:</strong> Cadastre novos orçamentos ou use o <em>Assistente de Voz</em> no celular para ditar serviços em poucos segundos!
                        </p>
                      </div>
                    `
                        : ''
                    }

                    <div style="text-align: center; margin: 32px 0 16px 0;">
                      <a href="https://finalizacao-do-sistema-913b5.shrd00.internal.goskip.dev/orcamentos" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                        Acessar Painel de Orçamentos
                      </a>
                    </div>
                  </div>

                  <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                      OrçaFácil — Plataforma de Gestão Inteligente com IA
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                      Este e-mail semanal é enviado automaticamente para usuários ativos às segundas-feiras.
                    </p>
                  </div>
                </div>
              </body>
              </html>
            `

            // Envio via MailerMessage
            try {
              const remetente = $app.settings().meta.senderAddress || 'suporte@orcafacil.com.br'
              const emailMessage = new MailerMessage({
                from: {
                  address: remetente,
                  name: 'OrçaFácil',
                },
                to: [{ address: emailDest, name: nomeDest }],
                subject: assuntoEmail,
                html: corpoHtml,
              })

              $app.newMailClient().send(emailMessage)
              console.log(`[resumo-semanal:disparo-via-post] E-mail enviado para ${emailDest}`)
              envioEmailInfo = {
                destinatario: emailDest,
                enviado: true,
                assunto: assuntoEmail,
              }
            } catch (mailErr) {
              console.warn(`[resumo-semanal:disparo-via-post] Aviso SMTP: ${mailErr}`)
              envioEmailInfo = {
                destinatario: emailDest,
                enviado: false,
                simulado: true,
                aviso: mailErr.message || String(mailErr),
              }
            }

            // Grava registro de controle
            try {
              const colRegistro = $app.findCollectionByNameOrId('resumos_semanais_enviados')
              let reg = null
              try {
                const ex = $app.findRecordsByFilter(
                  'resumos_semanais_enviados',
                  "user_id = '" + userId + "' && chave_semana = '" + chaveSemanaAtual + "'",
                  '-created',
                  1,
                  0,
                )
                if (ex.length > 0) reg = ex[0]
              } catch (_) {}

              if (!reg) {
                reg = new Record(colRegistro)
                reg.set('user_id', userId)
                reg.set('chave_semana', chaveSemanaAtual)
              }

              reg.set('email_destinatario', emailDest)
              reg.set('enviado_em', agora.toISOString())
              reg.set('status_envio', 'sucesso')
              reg.set('usou_ia', true)
              reg.set('metricas', metricas)
              reg.set('assunto', assuntoEmail)
              $app.save(reg)
              if (envioEmailInfo) {
                envioEmailInfo.registro_id = reg.id
              }
            } catch (regErr) {
              console.warn(
                '[resumo-semanal:disparo-via-post] Erro ao gravar registro de envio:',
                regErr,
              )
            }
          }
        } catch (emailBlockErr) {
          console.warn('[resumo-semanal:disparo-via-post] Falha no bloco de envio:', emailBlockErr)
        }
      }

      return e.json(200, {
        sucesso: true,
        resumo_texto: textoGerado,
        metricas: metricas,
        preferencias_aplicadas: {
          nome_preferido: prefNome,
          tom_resposta: prefTom,
          usar_emojis: prefEmojis,
        },
        gerado_em: agora.toISOString(),
        envio_email: envioEmailInfo,
      })
    } catch (err) {
      return e.json(500, {
        error: err.message || 'Erro ao gerar resumo semanal',
      })
    }
  },
  $apis.requireAuth(),
)
