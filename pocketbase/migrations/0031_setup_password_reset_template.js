// @ts-nocheck
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Atualizar templates de email de auth para o branding OrçaFácil e domínio de produção
    const meta = app.settings().meta || {}

    // Garantir remetente OrçaFácil
    meta.senderName = 'OrçaFácil'
    meta.senderAddress = meta.senderAddress || 'suporte@orcafacil.jmsistemas.app.br'
    meta.appName = 'OrçaFácil'

    // Garantir appUrl apontando para produção
    meta.appUrl = 'https://orcafacil.jmsistemas.app.br'

    // Configurar template de recuperação de senha do PocketBase
    users.passwordResetTemplate = {
      subject: 'Redefinição de senha — OrçaFácil',
      body: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
  <div style="text-align: center; margin-bottom: 24px;">
    <div style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; font-weight: bold; font-size: 20px; padding: 10px 22px; border-radius: 12px;">
      OF
    </div>
    <h1 style="margin: 12px 0 4px 0; font-size: 22px; color: #0f172a; font-weight: 700;">OrçaFácil</h1>
    <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: 600;">Feito para quem vive de serviço</p>
  </div>

  <h2 style="font-size: 18px; color: #0f172a; margin-bottom: 12px;">Olá, {name}!</h2>

  <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
    Recebemos uma solicitação para redefinir a senha da sua conta no <strong>OrçaFácil</strong>.
  </p>

  <div style="text-align: center; margin: 28px 0;">
    <a href="https://orcafacil.jmsistemas.app.br/redefinir-senha?token={token}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
      Redefinir Minha Senha
    </a>
  </div>

  <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-bottom: 12px;">
    Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:<br/>
    <a href="https://orcafacil.jmsistemas.app.br/redefinir-senha?token={token}" style="color: #2563eb; word-break: break-all;">https://orcafacil.jmsistemas.app.br/redefinir-senha?token={token}</a>
  </p>

  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 6px; margin: 24px 0;">
    <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 500;">
      ⏳ Este link é válido por tempo limitado. Se você não solicitou a recuperação de senha, nenhuma ação é necessária e sua senha atual permanecerá segura.
    </p>
  </div>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

  <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.5;">
    <strong>QUEVRON TECNOLOGIA INOVA SIMPLES (I.S.)</strong> • CNPJ 69.482.315/0001-19<br/>
    R. Mogi Mirim, SN — CH São José, Bela Vista — Águas de Lindoia/SP • Contato: jaocarloss@gmail.com
  </p>
</div>`,
      actionUrl: 'https://orcafacil.jmsistemas.app.br/redefinir-senha?token={token}',
    }

    app.save(users)

    // Salvar configurações do sistema
    const settings = app.settings()
    settings.meta = meta
    app.save(settings)
  },
  (app) => {},
)
