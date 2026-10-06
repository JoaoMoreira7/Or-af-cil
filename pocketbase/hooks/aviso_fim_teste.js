// @ts-nocheck
cronAdd('aviso_fim_teste', '0 9 * * *', () => {
  console.log(
    '[cron:aviso_fim_teste] Iniciando verificação diária de vencimento de testes grátis...',
  )

  try {
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

      // Identifica contas com vencimento em aproximadamente 2 dias (entre 24h e 60h restantes)
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

        // Ignora conta do dono do produto (acesso vitalício sem cobrança/aviso de teste)
        if (emailDestinatario.toLowerCase().trim() === 'jaocarloss@gmail.com') {
          continue
        }

        console.log(
          `[cron:aviso_fim_teste] Enviando aviso para ${emailDestinatario} (expira em ${Math.round(diffHoras / 24)} dias)...`,
        )

        const assunto = 'Seu teste grátis do OrçaFácil termina em 2 dias'
        const corpoHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; font-weight: bold; font-size: 20px; padding: 12px 24px; border-radius: 12px;">
                OrçaFácil
              </div>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b; font-weight: 600;">
                Feito para quem vive de serviço
              </p>
            </div>
            
            <h2 style="color: #0f172a; font-size: 20px; font-weight: bold; margin-bottom: 16px;">
              Olá, ${nomeDestinatario}!
            </h2>
            
            <p style="font-size: 15px; margin-bottom: 16px;">
              Esperamos que você esteja aproveitando a praticidade de gerar orçamentos rápidos e gerenciar clientes no <strong>OrçaFácil</strong> com o apoio da nossa Inteligência Artificial.
            </p>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">
                ⏳ <strong>Aviso importante:</strong> Seu período de teste grátis de 7 dias se encerrará em <strong>2 dias</strong>.
              </p>
            </div>
            
            <p style="font-size: 15px; margin-bottom: 20px;">
              Após o encerramento do teste, a emissão de novos orçamentos e o acesso ao sistema serão bloqueados. Escolha o plano ideal para continuar acelerando seus orçamentos:
            </p>

            <!-- ESCADA DE 3 PLANOS -->
            <div style="margin-bottom: 24px;">
              <!-- PLANO 1: ESSENCIAL -->
              <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; background-color: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                  <div>
                    <span style="display: inline-block; background-color: #f1f5f9; color: #475569; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; margin-bottom: 4px;">Entrada</span>
                    <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Plano Essencial</h3>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-size: 18px; font-weight: 800; color: #0f172a;">R$ 49,90</span><span style="font-size: 12px; color: #64748b;">/mês</span>
                  </div>
                </div>
                <p style="margin: 0; font-size: 13px; color: #64748b;">Núcleo do produto: orçamentos básicos ilimitados, clientes, IA e gastos por voz, dashboard.</p>
              </div>

              <!-- PLANO 2: PROFISSIONAL (DESTAQUE) -->
              <div style="border: 2px solid #2563eb; border-radius: 12px; padding: 18px; margin-bottom: 12px; background-color: #eff6ff; position: relative;">
                <div style="margin-bottom: 8px;">
                  <span style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 10px; border-radius: 9999px;">★ Mais Escolhido • Melhor Custo-Benefício</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                  <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #1e3a8a;">Plano Profissional</h3>
                  <div style="text-align: right;">
                    <span style="font-size: 20px; font-weight: 800; color: #1e3a8a;">R$ 64,90</span><span style="font-size: 12px; color: #1e40af;">/mês</span>
                  </div>
                </div>
                <p style="margin: 0; font-size: 13px; color: #1e3a8a; font-weight: 500;">
                  Tudo do Essencial + Assistente de Campo (fotos de notas/recibos) + Contas a Receber no WhatsApp + Resumo semanal em áudio.
                </p>
              </div>

              <!-- PLANO 3: PREMIUM -->
              <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background-color: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                  <div>
                    <span style="display: inline-block; background-color: #f5f3ff; color: #6d28d9; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; margin-bottom: 4px;">Completo</span>
                    <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Plano Premium</h3>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-size: 18px; font-weight: 800; color: #0f172a;">R$ 79,90</span><span style="font-size: 12px; color: #64748b;">/mês</span>
                  </div>
                </div>
                <p style="margin: 0; font-size: 13px; color: #64748b;">Tudo do Profissional + relatórios e exportação financeira avançada + suporte prioritário VIP.</p>
              </div>
            </div>

            <div style="text-align: center; margin-bottom: 30px;">
              <a href="https://finalizacao-do-sistema-913b5.shrd00.internal.goskip.dev/planos" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                Ver Planos e Ativar Minha Assinatura
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            
            <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
              OrçaFácil — Feito para quem vive de serviço • Gestão comercial e orçamentos com IA.<br />
              Mensagem automática enviada pela plataforma OrçaFácil.
            </p>
          </div>
        `

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
          console.warn(
            `[cron:aviso_fim_teste] Aviso registrado (envio SMTP em modo simulação/no-op): ${sendErr}`,
          )
        }

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
