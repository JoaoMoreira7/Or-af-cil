// @ts-nocheck
routerAdd('POST', '/backend/v1/auth/solicitar-recuperacao', (e) => {
  try {
    const body = e.requestInfo().body || {}
    const emailRaw = body.email || ''
    const email = emailRaw.toString().toLowerCase().trim()

    if (!email || !email.includes('@')) {
      return e.json(400, {
        error: 'Por favor, informe um endereço de e-mail válido.',
      })
    }

    // 1. Rate limiting defensivo (60 segundos por e-mail)
    const chaveRateLimit = 'rate_reset_' + $security.md5(email)
    const agoraMs = new Date().getTime()

    try {
      const rateRec = $app.findFirstRecordByData('configuracoes_sistema', 'chave', chaveRateLimit)
      if (rateRec) {
        const ultimoEnvioMs = parseInt(rateRec.getString('valor') || '0', 10)
        const diffSegundos = Math.floor((agoraMs - ultimoEnvioMs) / 1000)
        if (diffSegundos < 60) {
          const restantes = 60 - diffSegundos
          return e.json(429, {
            error: `Por favor, aguarde ${restantes} segundos antes de solicitar um novo link de recuperação para este e-mail.`,
            segundos_restantes: restantes,
          })
        }
        rateRec.set('valor', agoraMs.toString())
        rateRec.set('ultima_verificacao', new Date().toISOString())
        $app.save(rateRec)
      }
    } catch (_) {
      try {
        const colConf = $app.findCollectionByNameOrId('configuracoes_sistema')
        const novoRate = new Record(colConf)
        novoRate.set('chave', chaveRateLimit)
        novoRate.set('valor', agoraMs.toString())
        novoRate.set('descricao', 'Rate limit recuperação de senha: ' + email)
        novoRate.set('tipo', 'rate_limit')
        novoRate.set('ultima_verificacao', new Date().toISOString())
        $app.save(novoRate)
      } catch (errSaveRate) {
        console.warn('[auth:recuperacao] Aviso ao gravar rate limit:', errSaveRate)
      }
    }

    // 2. Busca do usuário (sem revelar se existe ou não para evitar enumeração de contas)
    let usuario = null
    try {
      usuario = $app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {
      return e.json(200, {
        sucesso: true,
        mensagem:
          'Se existir uma conta cadastrada com este e-mail, as instruções para redefinição de senha foram enviadas.',
      })
    }

    if (!usuario) {
      return e.json(200, {
        sucesso: true,
        mensagem:
          'Se existir uma conta cadastrada com este e-mail, as instruções para redefinição de senha foram enviadas.',
      })
    }

    const nomeDestinatario = usuario.getString('name') || 'Usuário OrçaFácil'

    // 3. Gerar token oficial de reset do PocketBase
    // No PocketBase v0.36+, a geração do token de reset para auth records pode ser obtida
    // via $tokens.recordPasswordResetToken(usuario) ou $security.createJWT com tokenKey
    let tokenReset = ''
    try {
      if (typeof usuario.newPasswordResetToken === 'function') {
        tokenReset = usuario.newPasswordResetToken()
      }
    } catch (errToken) {
      console.warn('[auth:recuperacao] newPasswordResetToken info:', errToken)
    }

    if (!tokenReset) {
      try {
        if (
          typeof $tokens !== 'undefined' &&
          typeof $tokens.recordPasswordResetToken === 'function'
        ) {
          tokenReset = $tokens.recordPasswordResetToken(usuario)
        }
      } catch (tokErr) {
        console.warn('[auth:recuperacao] $tokens.recordPasswordResetToken info:', tokErr)
      }
    }

    // Fallback robusto: se não gerou via helper nativo, tenta invocar o método interno ou JWT
    if (!tokenReset) {
      try {
        const tokenKey = usuario.getString('tokenKey') || $security.randomString(32)
        tokenReset = $security.createJWT(
          { id: usuario.id, email: email, type: 'password_reset' },
          tokenKey,
          7200,
        )
      } catch (jwtErr) {
        console.error('[auth:recuperacao] Erro ao gerar token JWT:', jwtErr)
      }
    }

    // Link oficial apontando para o domínio de produção com query param ?token=...
    const linkRedefinicao =
      'https://orcafacil.jmsistemas.app.br/redefinir-senha?token=' + encodeURIComponent(tokenReset)

    // 4. Montar corpo de e-mail com identidade visual OrçaFácil
    const assunto = 'Recuperação de senha — OrçaFácil'
    const corpoHtml = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${assunto}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
          <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
            
            <!-- HEADER -->
            <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb, #7c3aed); padding: 32px 28px; text-align: center; color: #ffffff;">
              <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); padding: 10px 22px; border-radius: 12px; font-weight: 800; font-size: 22px; color: #ffffff; letter-spacing: -0.5px; margin-bottom: 8px;">
                OF
              </div>
              <h1 style="margin: 8px 0 2px 0; font-size: 22px; font-weight: 700; color: #ffffff;">
                OrçaFácil
              </h1>
              <p style="margin: 0; font-size: 13px; color: #dbeafe; font-weight: 500;">
                Feito para quem vive de serviço
              </p>
            </div>

            <!-- CONTEÚDO -->
            <div style="padding: 32px 28px;">
              <h2 style="font-size: 18px; color: #0f172a; margin: 0 0 14px 0; font-weight: 600;">
                Olá, ${nomeDestinatario}!
              </h2>

              <p style="font-size: 15px; color: #334155; margin: 0 0 18px 0; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>OrçaFácil</strong>. Se você solicitou essa alteração, clique no botão abaixo para definir sua nova senha com segurança:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${linkRedefinicao}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);">
                  Redefinir Minha Senha
                </a>
              </div>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 24px 0;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; font-weight: 600;">
                  Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                </p>
                <a href="${linkRedefinicao}" style="font-size: 12px; color: #2563eb; word-break: break-all; text-decoration: underline;">
                  ${linkRedefinicao}
                </a>
              </div>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 500;">
                  ⏳ <strong>Atenção:</strong> Este link é temporário e expira em breve. Se você não solicitou a troca de senha, pode ignorar este e-mail com total segurança — sua senha atual não será alterada.
                </p>
              </div>
            </div>

            <!-- FOOTER LEGAL -->
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #475569;">
                QUEVRON TECNOLOGIA INOVA SIMPLES (I.S.) • CNPJ 69.482.315/0001-19
              </p>
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">
                R. Mogi Mirim, SN — CH São José, Bela Vista — Águas de Lindoia/SP • Contato: jaocarloss@gmail.com
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Mensagem automática de segurança enviada pela plataforma OrçaFácil.
              </p>
            </div>

          </div>
        </body>
        </html>
      `

    // 5. Disparo do e-mail via MailerMessage
    let emailEnviado = false
    try {
      const remetente = $app.settings().meta.senderAddress || 'suporte@orcafacil.jmsistemas.app.br'
      const emailMessage = new MailerMessage({
        from: {
          address: remetente,
          name: 'OrçaFácil',
        },
        to: [{ address: email, name: nomeDestinatario }],
        subject: assunto,
        html: corpoHtml,
      })

      $app.newMailClient().send(emailMessage)
      emailEnviado = true
      console.log(`[auth:recuperacao] E-mail de redefinição enviado com sucesso para ${email}`)
    } catch (sendErr) {
      console.warn(`[auth:recuperacao] Aviso no envio via MailerMessage: ${sendErr}`)
    }

    return e.json(200, {
      sucesso: true,
      email_enviado: emailEnviado,
      mensagem:
        'Se existir uma conta cadastrada com este e-mail, as instruções para redefinição de senha foram enviadas.',
    })
  } catch (err) {
    console.error('[auth:recuperacao] Erro não tratado:', err)
    return e.json(500, {
      error: 'Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.',
    })
  }
})
