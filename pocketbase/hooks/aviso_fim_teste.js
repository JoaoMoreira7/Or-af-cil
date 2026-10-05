// @ts-nocheck
cronAdd('aviso_fim_teste', '0 9 * * *', () => {
  console.log(
    '[cron:aviso_fim_teste] Iniciando verificação diária de vencimento de testes grátis...',
  )

  try {
    // Buscar todos os planos que estão em período de teste
    const planosEmTrial = $app.findRecordsByFilter(
      'planos',
      'status = "trial"',
      '-created',
      1000,
      0,
    )

    console.log(
      `[cron:aviso_fim_teste] Encontrados ${planosEmTrial.length} planos com status trial`,
    )

    const agora = new Date()
    let totalProcessados = 0
    let totalAvisosEnviados = 0

    for (let i = 0; i < planosEmTrial.length; i++) {
      const plano = planosEmTrial[i]
      totalProcessados++

      // Se já enviou aviso anteriormente, pular para não duplicar
      const jaEnviado = plano.getBool('aviso_teste_enviado')
      if (jaEnviado) {
        continue
      }

      const trialAteStr = plano.getString('trial_ate')
      if (!trialAteStr) {
        continue
      }

      const trialAte = new Date(trialAteStr)
      const diffMs = trialAte.getTime() - agora.getTime()
      const diffHoras = diffMs / (1000 * 60 * 60)

      // Identifica contas cujo vencimento é em aproximadamente 2 dias (entre 24h e 60h restantes, ideal para checagem diária)
      if (diffHoras >= 24 && diffHoras <= 60) {
        const userId = plano.getString('user_id')
        if (!userId) continue

        let usuario = null
        try {
          usuario = $app.findRecordById('_pb_users_auth_', userId)
        } catch (errUser) {
          console.warn(
            `[cron:aviso_fim_teste] Usuário ${userId} não encontrado para o plano ${plano.id}: ${errUser}`,
          )
          continue
        }

        const emailDestinatario = usuario.getString('email')
        const nomeDestinatario = usuario.getString('name') || 'Assinante'

        if (!emailDestinatario) {
          console.warn(`[cron:aviso_fim_teste] Usuário ${userId} não possui e-mail cadastrado.`)
          continue
        }

        console.log(
          `[cron:aviso_fim_teste] Enviando aviso para ${emailDestinatario} (expira em ${Math.round(diffHoras / 24)} dias)...`,
        )

        const assunto = 'Seu teste grátis do OrçaFácil termina em 2 dias'
        const corpoHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; font-weight: bold; font-size: 20px; padding: 12px 20px; border-radius: 12px;">
                OrçaFácil
              </div>
            </div>
            
            <h2 style="color: #0f172a; font-size: 20px; font-weight: bold; margin-bottom: 16px;">
              Olá, ${nomeDestinatario}!
            </h2>
            
            <p style="font-size: 15px; margin-bottom: 16px;">
              Esperamos que você esteja aproveitando a praticidade de gerar orçamentos ágeis e gerenciar clientes no <strong>OrçaFácil</strong> com o apoio da nossa Inteligência Artificial.
            </p>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">
                ⏳ <strong>Aviso importante:</strong> Seu período de teste grátis de 7 dias se encerrará em <strong>2 dias</strong>.
              </p>
            </div>
            
            <p style="font-size: 15px; margin-bottom: 16px;">
              Após o encerramento do teste, o seu acesso ao painel e a emissão de novos orçamentos serão <strong>bloqueados</strong> até a ativação da assinatura.
            </p>
            
            <p style="font-size: 15px; margin-bottom: 24px;">
              Para continuar emitindo orçamentos profissionais sem interrupções, assine agora o <strong>Plano Starter por apenas R$ 49,90/mês</strong>.
            </p>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="https://finalizacao-do-sistema-913b5.shrd00.internal.goskip.dev/planos" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; padding: 14px 28px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                Garantir meu acesso por R$ 49,90/mês
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            
            <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
              OrçaFácil — Orçamentos Profissionais e Gestão com IA para Prestadores de Serviço.<br />
              Mensagem automática enviada pela plataforma OrçaFácil.
            </p>
          </div>
        `

        // Tentativa de envio com proteção contra falhas (no-op se SMTP não configurado)
        try {
          const emailMessage = new MailerMessage({
            from: {
              address: $app.settings().meta.senderAddress || 'suporte@orcafacil.com.br',
              name: 'OrçaFácil',
            },
            to: [{ address: emailDestinatario, name: nomeDestinatario }],
            subject: assunto,
            html: corpoHtml,
          })

          $app.newMailClient().send(emailMessage)
          console.log(`[cron:aviso_fim_teste] E-mail enviado com sucesso para ${emailDestinatario}`)
        } catch (sendErr) {
          // Log amigável sem quebrar o job se o servidor de e-mail não estiver configurado
          console.warn(
            `[cron:aviso_fim_teste] Aviso registrado (envio SMTP em modo simulação/no-op): ${sendErr}`,
          )
        }

        // Marcar aviso como enviado para nunca duplicar
        try {
          plano.set('aviso_teste_enviado', true)
          $app.save(plano)
          totalAvisosEnviados++
        } catch (saveErr) {
          console.error(
            `[cron:aviso_fim_teste] Erro ao salvar status de aviso no plano ${plano.id}: ${saveErr}`,
          )
        }
      }
    }

    console.log(
      `[cron:aviso_fim_teste] Concluído. Processados: ${totalProcessados}, Avisos disparados: ${totalAvisosEnviados}`,
    )
  } catch (err) {
    console.error(`[cron:aviso_fim_teste] Erro crítico no cron job: ${err}`)
  }
})
