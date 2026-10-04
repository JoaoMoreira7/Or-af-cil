migrate(
  (app) => {
    // Disparo de teste para jaocarloss@gmail.com
    const emailDest = 'jaocarloss@gmail.com'
    const user = app.findAuthRecordByEmail('_pb_users_auth_', emailDest)
    const userId = user.id
    const userName = user.getString('name') || 'João Carlos'
    const agora = new Date()

    // Chave da semana
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

    const formatarMoeda = function (num) {
      return 'R$ ' + (num || 0).toFixed(2).replace('.', ',')
    }

    // Métricas
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
    const cincoDiasAtras = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000)

    let orcamentosTodos = []
    try {
      orcamentosTodos = app.findRecordsByFilter(
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
      if (status === 'aprovado' && (updatedDate >= seteDiasAtras || createdDate >= seteDiasAtras)) {
        orcamentosAprovadosSemana++
        valorAprovadoSemana += valor
      }

      if ((status === 'enviado' || status === 'rascunho') && createdDate <= cincoDiasAtras) {
        orcamentosSemResposta5Dias++
      }
    }

    const metricas = {
      orcamentos_criados: orcamentosCriadosSemana,
      orcamentos_enviados: orcamentosEnviadosSemana,
      orcamentos_aprovados: orcamentosAprovadosSemana,
      valor_aprovado: valorAprovadoSemana,
      cobrancas_pagas: 0,
      valor_pago: 0,
      cobrancas_pendentes: 0,
      valor_pendente: 0,
      novos_clientes: 0,
      orcamentos_sem_resposta_5_dias: orcamentosSemResposta5Dias,
    }

    const assuntoEmail = '[TESTE] Seu resumo da semana — JM Sistemas'
    const prefNome = userName.split(' ')[0]
    const textoEditorial =
      'Olá, ' +
      prefNome +
      '! Aqui está uma prévia do seu resumo da semana gerado pela plataforma JM Sistemas. O acompanhamento dos seus orçamentos e clientes está ativo e operante. Excelente semana de trabalho!'

    const corpoHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>${assuntoEmail}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
      <div style="max-width: 620px; margin: 30px auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb, #7c3aed); padding: 32px 28px; text-align: left; color: #ffffff;">
          <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
            JM Sistemas • Disparo de Teste (Admin)
          </div>
          <h1 style="margin: 12px 0 0 0; font-size: 24px; font-weight: 700; color: #ffffff;">
            📊 Resumo da Semana
          </h1>
          <p style="margin: 6px 0 0 0; font-size: 14px; color: #dbeafe;">
            Semana ${chaveSemanaAtual} • Balanço dos últimos 7 dias (Teste de Entrega)
          </p>
        </div>
        <div style="padding: 28px;">
          <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #92400e;">
            ⚙️ <strong>Disparo de Teste Realizado:</strong> Validando o envio de e-mails do sistema para a conta administradora (${emailDest}).
          </div>
          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 18px; border-radius: 8px; margin-bottom: 24px; font-size: 15px; color: #166534;">
            ${textoEditorial}
          </div>
          <div style="text-align: center; margin: 24px 0 12px 0;">
            <a href="https://finalizacao-do-sistema-913b5.shrd00.internal.goskip.dev/admin" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 8px;">
              Acessar Painel Admin
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

    try {
      const remetente = app.settings().meta.senderAddress || 'suporte@jmsistemas.com.br'
      const emailMessage = new MailerMessage({
        from: {
          address: remetente,
          name: 'JM Sistemas',
        },
        to: [{ address: emailDest, name: userName }],
        subject: assuntoEmail,
        html: corpoHtml,
      })

      app.newMailClient().send(emailMessage)
      console.log(`[migration:0011_teste_disparo_resumo] E-mail de teste enviado para ${emailDest}`)
    } catch (err) {
      console.warn(`[migration:0011_teste_disparo_resumo] Erro/Aviso no envio: ${err}`)
    }
  },
  () => {},
)
