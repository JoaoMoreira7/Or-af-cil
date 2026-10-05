// @ts-nocheck
cronAdd('resumo_semanal_email', '0 12 * * 1', () => {
  console.log(
    '[cron:resumo_semanal_email] Iniciando envio semanal do resumo da semana (segunda-feira 09:00 BRT / 12:00 UTC)...',
  )

  // Helper inline para calcular chave da semana ISO (YYYY-Www)
  const dataAtual = new Date()
  const targetData = new Date(dataAtual.valueOf())
  const dayNr = (dataAtual.getDay() + 6) % 7
  targetData.setDate(targetData.getDate() - dayNr + 3)
  const firstThursday = targetData.valueOf()
  targetData.setMonth(0, 1)
  if (targetData.getDay() !== 4) {
    targetData.setMonth(0, 1 + ((4 - targetData.getDay() + 7) % 7))
  }
  const weekNumber = 1 + Math.ceil((firstThursday - targetData.valueOf()) / 604800000)
  const weekStr = weekNumber < 10 ? '0' + weekNumber : '' + weekNumber
  const chaveSemanaAtual = targetData.getFullYear() + '-W' + weekStr

  console.log(`[cron:resumo_semanal_email] Chave da semana atual: ${chaveSemanaAtual}`)

  let totalContasElegiveis = 0
  let totalEmailsDisparados = 0
  let totalPulosJaEnviado = 0
  let totalErros = 0

  try {
    const todosUsuarios = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 2000, 0)

    console.log(`[cron:resumo_semanal_email] Total de usuários analisados: ${todosUsuarios.length}`)

    const agora = new Date()
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
    const cincoDiasAtras = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000)

    for (let uIdx = 0; uIdx < todosUsuarios.length; uIdx++) {
      const usuario = todosUsuarios[uIdx]
      const userId = usuario.id
      const userEmail = usuario.getString('email') || ''
      const userName = usuario.getString('name') || 'Parceiro(a)'

      if (!userEmail) {
        continue
      }

      // 1. Elegibilidade (assinante ativo OU em período de teste válido)
      let elegivel = false
      let motivoElegivel = ''

      try {
        const planoRec = $app.findFirstRecordByData('planos', 'user_id', userId)
        if (planoRec) {
          const status = planoRec.getString('status')
          if (status === 'ativo') {
            elegivel = true
            motivoElegivel = 'assinante_ativo'
          } else if (status === 'trial') {
            const trialAteStr = planoRec.getString('trial_ate')
            if (trialAteStr) {
              const trialAteDate = new Date(trialAteStr)
              if (trialAteDate.getTime() > agora.getTime()) {
                elegivel = true
                motivoElegivel = 'trial_valido'
              }
            }
          }
        }
      } catch (_) {}

      if (!elegivel) {
        continue
      }

      totalContasElegiveis++

      // 2. Controle de duplicidade: só 1x por semana por usuário
      let jaEnviadoEssaSemana = false
      try {
        const enviosExistentes = $app.findRecordsByFilter(
          'resumos_semanais_enviados',
          "user_id = '" + userId + "' && chave_semana = '" + chaveSemanaAtual + "'",
          '-created',
          1,
          0,
        )
        if (enviosExistentes.length > 0) {
          jaEnviadoEssaSemana = true
        }
      } catch (_) {}

      if (jaEnviadoEssaSemana) {
        totalPulosJaEnviado++
        continue
      }

      // Processa usuário individualmente
      try {
        // 3. Preferências de IA
        let prefNome = userName.split(' ')[0]
        let prefTom = 'amigavel'
        let prefEmojis = true

        try {
          const prefRec = $app.findFirstRecordByData('preferencias_ia', 'user_id', userId)
          if (prefRec) {
            const pNome = prefRec.getString('nome_preferido')
            if (pNome) prefNome = pNome
            const pTom = prefRec.getString('tom_resposta')
            if (pTom) prefTom = pTom
            prefEmojis = prefRec.getBool('usar_emojis')
          }
        } catch (_) {}

        // 4. Agregação dos dados da semana
        let orcamentosTodos = []
        try {
          orcamentosTodos = $app.findRecordsByFilter(
            'orcamentos',
            "user_id = '" + userId + "'",
            '-created',
            300,
            0,
          )
        } catch (_) {}

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

          if (createdDate >= seteDiasAtras) {
            orcamentosCriadosSemana++
            if (status === 'enviado') {
              orcamentosEnviadosSemana++
            }
          }

          const updatedStr = o.getString('updated') || createdStr
          const updatedDate = new Date(updatedStr)
          if (
            status === 'aprovado' &&
            (updatedDate >= seteDiasAtras || createdDate >= seteDiasAtras)
          ) {
            orcamentosAprovadosSemana++
            valorAprovadoSemana += valor
          }

          if ((status === 'enviado' || status === 'rascunho') && createdDate <= cincoDiasAtras) {
            orcamentosSemResposta5Dias++
          }
        }

        let cobrancasTodas = []
        try {
          cobrancasTodas = $app.findRecordsByFilter(
            'cobrancas',
            "user_id = '" + userId + "'",
            '-created',
            300,
            0,
          )
        } catch (_) {}

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

        let novosClientesSemana = 0
        try {
          const clientes = $app.findRecordsByFilter(
            'clientes',
            "user_id = '" + userId + "'",
            '-created',
            150,
            0,
          )
          for (let i = 0; i < clientes.length; i++) {
            const createdStr = clientes[i].getString('created') || ''
            if (new Date(createdStr) >= seteDiasAtras) {
              novosClientesSemana++
            }
          }
        } catch (_) {}

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

        const semMovimentacao =
          metricas.orcamentos_criados === 0 &&
          metricas.orcamentos_aprovados === 0 &&
          metricas.cobrancas_pagas === 0 &&
          metricas.novos_clientes === 0

        const formatarMoeda = function (num) {
          return 'R$ ' + (num || 0).toFixed(2).replace('.', ',')
        }

        // 5. Fallback editorial inteligente
        let fallbackEditorial = ''
        if (semMovimentacao) {
          if (prefTom === 'formal') {
            fallbackEditorial =
              'Prezado(a) ' +
              prefNome +
              ', identificamos que não houve novos orçamentos ou recebimentos registrados nos últimos 7 dias. ' +
              'O início da semana é um momento propício para prospectar novas oportunidades e formalizar propostas pendentes no sistema.'
          } else if (prefTom === 'direto') {
            fallbackEditorial =
              'Sem movimentações registradas na última semana. Cadastre novos orçamentos hoje mesmo para acelerar seus fechamentos comerciais.'
          } else {
            fallbackEditorial =
              (prefEmojis ? '🚀 ' : '') +
              'Olá, ' +
              prefNome +
              '! A última semana foi tranquila por aqui, sem novos orçamentos registrados. Que tal começar esta segunda-feira com o pé direito cadastrando sua primeira proposta da semana?'
          }
        } else {
          if (prefTom === 'formal') {
            fallbackEditorial =
              'Prezado(a) ' +
              prefNome +
              ', apresentamos o balanço executivo da sua operação nos últimos 7 dias. ' +
              'Foram fechados ' +
              orcamentosAprovadosSemana +
              ' orçamento(s) (' +
              formatarMoeda(valorAprovadoSemana) +
              ') e formalizados ' +
              orcamentosCriadosSemana +
              ' nova(s) proposta(s). ' +
              (valorPendenteReceber > 0
                ? 'O saldo total pendente a receber é de ' +
                  formatarMoeda(valorPendenteReceber) +
                  '.'
                : 'Todas as propostas aprovadas estão devidamente quitadas.')
          } else if (prefTom === 'direto') {
            fallbackEditorial =
              'Desempenho da semana: ' +
              orcamentosAprovadosSemana +
              ' orçamentos fechados (' +
              formatarMoeda(valorAprovadoSemana) +
              '), ' +
              orcamentosCriadosSemana +
              ' novos orçamentos e ' +
              formatarMoeda(valorPendenteReceber) +
              ' a receber.'
          } else {
            fallbackEditorial =
              (prefEmojis ? '✨ ' : '') +
              'Olá, ' +
              prefNome +
              '! Excelente ritmo nos últimos 7 dias! Você fechou ' +
              orcamentosAprovadosSemana +
              ' proposta(s) somando ' +
              formatarMoeda(valorAprovadoSemana) +
              ' e gerou ' +
              orcamentosCriadosSemana +
              ' novo(s) orçamento(s). Continue assim para alcançar resultados ainda melhores esta semana!'
          }
        }

        // 6. Chamada com Skip AI Gateway ($ai.chat alias "fast")
        let textoEditorial = fallbackEditorial
        let usouIaComSucesso = false

        try {
          const promptSistema =
            'Você é o assistente executivo e de negócios da plataforma OrçaFácil (gestão de orçamentos e serviços com IA).\n' +
            'Sua missão é redigir um resumo executivo de alta clareza em português do Brasil (pt-BR) para ser enviado no e-mail de segunda-feira.\n\n' +
            'DIRETRIZES DA PERSONA:\n' +
            '- Nome do usuário: ' +
            prefNome +
            '\n' +
            '- Tom de resposta: ' +
            prefTom +
            ' (formal: polido, profissional e respeitoso; amigavel: acolhedor, motivador e parceiro; direto: cirúrgico, sem rodeios e focado em fatos)\n' +
            '- Uso de emojis: ' +
            (prefEmojis ? 'sim, moderado e profissional' : 'não use emojis') +
            '\n\n' +
            'DIRETRIZES DE CONTEÚDO:\n' +
            '1. Redija de 2 a 3 parágrafos curtos e objetivos (80 a 140 palavras no total).\n' +
            '2. Destaque os números relevantes da semana e contextualize a importância deles para o negócio.\n' +
            (semMovimentacao
              ? '3. ATENÇÃO: Os números desta semana estão ZERADOS. Seja motivador e convide o usuário cordialmente a registrar o primeiro orçamento ou cliente da semana no sistema.\n'
              : '3. Enfatize orçamentos aprovados, faturamento realizado, propostas que ainda aguardam retorno há mais de 5 dias (se houver, alerte com prudência) e saldo a receber.\n') +
            '4. NÃO use formatações markdown brutas tipo cabeçalhos (#), tabelas ou listas bullet (-); escreva parágrafos contínuos que serão inseridos no corpo do e-mail HTML.'

          const promptUsuario =
            'Dados consolidados dos últimos 7 dias de ' +
            prefNome +
            ':\n' +
            '- Orçamentos criados: ' +
            metricas.orcamentos_criados +
            '\n' +
            '- Orçamentos enviados: ' +
            metricas.orcamentos_enviados +
            '\n' +
            '- Orçamentos fechados/aprovados: ' +
            metricas.orcamentos_aprovados +
            ' (Valor: ' +
            formatarMoeda(metricas.valor_aprovado) +
            ')\n' +
            '- Cobranças pagas na semana: ' +
            metricas.cobrancas_pagas +
            ' (' +
            formatarMoeda(metricas.valor_pago) +
            ')\n' +
            '- Cobranças / valores pendentes a receber: ' +
            formatarMoeda(metricas.valor_pendente) +
            '\n' +
            '- Orçamentos aguardando resposta há 5+ dias: ' +
            metricas.orcamentos_sem_resposta_5_dias +
            '\n' +
            '- Novos clientes conquistados na semana: ' +
            metricas.novos_clientes +
            '\n\n' +
            'Redija o resumo executivo de e-mail agora:'

          const aiRes = $ai.chat({
            model: 'fast',
            messages: [
              { role: 'system', content: promptSistema },
              { role: 'user', content: promptUsuario },
            ],
          })

          const respostaAi = aiRes?.choices?.[0]?.message?.content
          if (respostaAi && typeof respostaAi === 'string' && respostaAi.trim().length > 30) {
            textoEditorial = respostaAi
              .replace(/[#*_`]/g, '')
              .replace(/\n\s*\n/g, '<br/><br/>')
              .trim()
            usouIaComSucesso = true
          }
        } catch (aiErr) {
          console.warn(
            `[cron:resumo_semanal_email] Falha IA para ${userId}: ${aiErr.message || aiErr}`,
          )
        }

        // 7. Monta e-mail HTML
        const saudacao =
          prefTom === 'formal'
            ? 'Prezado(a) ' + prefNome
            : prefTom === 'direto'
              ? 'Olá, ' + prefNome
              : 'Olá, ' + prefNome + '!'

        const emojiDestaque = prefEmojis ? '📊 ' : ''
        const assuntoEmail = 'Seu resumo da semana — OrçaFácil'

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
                    ${textoEditorial}
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

        // 8. Envio com MailerMessage
        try {
          const remetente = $app.settings().meta.senderAddress || 'suporte@orcafacil.com.br'
          const emailMessage = new MailerMessage({
            from: {
              address: remetente,
              name: 'OrçaFácil',
            },
            to: [{ address: userEmail, name: userName }],
            subject: assuntoEmail,
            html: corpoHtml,
          })

          $app.newMailClient().send(emailMessage)
          console.log(
            `[cron:resumo_semanal_email] E-mail enviado com sucesso para ${userEmail} (${motivoElegivel})`,
          )
        } catch (sendErr) {
          console.warn(
            `[cron:resumo_semanal_email] Aviso no envio SMTP (modo simulado/no-op para ${userEmail}): ${sendErr.message || sendErr}`,
          )
        }

        // 9. Persistência do controle de duplicidade
        try {
          const colRegistro = $app.findCollectionByNameOrId('resumos_semanais_enviados')
          const registro = new Record(colRegistro)
          registro.set('user_id', userId)
          registro.set('chave_semana', chaveSemanaAtual)
          registro.set('email_destinatario', userEmail)
          registro.set('enviado_em', agora.toISOString())
          registro.set('status_envio', usouIaComSucesso ? 'sucesso' : 'fallback')
          registro.set('usou_ia', usouIaComSucesso)
          registro.set('metricas', metricas)
          registro.set('assunto', assuntoEmail)
          $app.save(registro)
        } catch (regErr) {
          console.warn(
            `[cron:resumo_semanal_email] Erro ao gravar registro para ${userId}: ${regErr.message || regErr}`,
          )
        }

        totalEmailsDisparados++
      } catch (userErr) {
        totalErros++
        console.error(
          `[cron:resumo_semanal_email] Erro ao processar usuário ${userId}: ${userErr.message || userErr}`,
        )
      }
    }

    console.log(
      `[cron:resumo_semanal_email] Concluído. Elegíveis: ${totalContasElegiveis}, Disparados: ${totalEmailsDisparados}, Já enviados anteriormente: ${totalPulosJaEnviado}, Erros: ${totalErros}`,
    )
  } catch (globalErr) {
    console.error(
      `[cron:resumo_semanal_email] Erro crítico no cron: ${globalErr.message || globalErr}`,
    )
  }
})
