import pb from '@/lib/pocketbase/client'

export interface SolicitarRecuperacaoResultado {
  sucesso: boolean
  mensagem: string
  segundosRestantes?: number
  emailEnviado?: boolean
}

export interface ConfirmarRedefinicaoResultado {
  sucesso: boolean
  mensagem: string
  email?: string
}

export const authRecoveryService = {
  /**
   * Solicita envio de link de recuperação de senha para o e-mail informado.
   * Dispara o hook customizado do backend que:
   * 1. Aplica rate limit (1 por minuto por e-mail)
   * 2. Responde com mensagem neutra anti-enumeração
   * 3. Envia o e-mail transacional com branding OrçaFácil e link para https://orcafacil.jmsistemas.app.br/redefinir-senha?token=...
   * 4. Também aciona redundância no PocketBase nativo
   */
  solicitarRecuperacao: async (email: string): Promise<SolicitarRecuperacaoResultado> => {
    const emailLimpo = email.trim().toLowerCase()
    if (!emailLimpo) {
      throw new Error('Informe seu endereço de e-mail.')
    }

    // 1. Tentar endpoint customizado do OrçaFácil (com template rico, rate limit e MailerMessage)
    try {
      const res = await pb.send('/backend/v1/auth/solicitar-recuperacao', {
        method: 'POST',
        body: { email: emailLimpo },
      })
      return {
        sucesso: true,
        mensagem:
          res?.mensagem ||
          'Se existir uma conta cadastrada com este e-mail, as instruções de recuperação foram enviadas.',
        emailEnviado: res?.email_enviado,
      }
    } catch (err: unknown) {
      const pbErr = err as {
        status?: number
        response?: { error?: string; segundos_restantes?: number }
      }
      if (pbErr?.status === 429) {
        throw new Error(
          pbErr.response?.error ||
            'Por favor, aguarde 60 segundos antes de solicitar um novo link de recuperação.',
        )
      }
      if (pbErr?.status === 400 && pbErr.response?.error) {
        throw new Error(pbErr.response.error)
      }

      // Fallback para API nativa do PocketBase users.requestPasswordReset
      try {
        await pb.collection('users').requestPasswordReset(emailLimpo)
        return {
          sucesso: true,
          mensagem:
            'Se existir uma conta cadastrada com este e-mail, as instruções de recuperação foram enviadas.',
        }
      } catch (nativeErr: unknown) {
        // Anti-enumeração: não expor se o e-mail não existe no banco
        console.warn('[authRecoveryService] Erro na tentativa nativa:', nativeErr)
        return {
          sucesso: true,
          mensagem:
            'Se existir uma conta cadastrada com este e-mail, as instruções de recuperação foram enviadas.',
        }
      }
    }
  },

  /**
   * Confirma redefinição de senha com o token recebido no e-mail.
   * Tenta primeiro a API nativa do PocketBase (confirmPasswordReset), e em fallback
   * o endpoint customizado do hook caso o token tenha sido emitido pelo backend customizado.
   */
  confirmarRedefinicao: async (
    token: string,
    novaSenha: string,
  ): Promise<ConfirmarRedefinicaoResultado> => {
    if (!token) {
      throw new Error('Token de redefinição não encontrado ou link incompleto.')
    }
    if (!novaSenha || novaSenha.length < 8) {
      throw new Error('A nova senha deve ter no mínimo 8 caracteres.')
    }

    let erroNativo: unknown = null
    // Tentativa 1: API nativa do PocketBase
    try {
      await pb.collection('users').confirmPasswordReset(token, novaSenha, novaSenha)
      return {
        sucesso: true,
        mensagem: 'Senha redefinida com sucesso! Você já pode entrar com sua nova senha.',
      }
    } catch (err) {
      erroNativo = err
      console.warn(
        '[authRecoveryService] Tentativa nativa confirmPasswordReset falhou, tentando hook customizado:',
        err,
      )
    }

    // Tentativa 2: Endpoint customizado no backend
    try {
      const res = await pb.send('/backend/v1/auth/confirmar-redefinicao', {
        method: 'POST',
        body: {
          token,
          password: novaSenha,
          passwordConfirm: novaSenha,
        },
      })
      return {
        sucesso: true,
        mensagem:
          res?.mensagem || 'Senha redefinida com sucesso! Você já pode entrar com sua nova senha.',
        email: res?.email,
      }
    } catch (errCustom: unknown) {
      const customErr = errCustom as { response?: { error?: string; codigo?: string } }
      const msg =
        customErr?.response?.error ||
        (erroNativo instanceof Error ? erroNativo.message : null) ||
        'Link inválido ou expirado. Por favor, solicite um novo link de recuperação.'

      if (msg.includes('invalid') || msg.includes('token') || msg.includes('expirado')) {
        throw new Error('Link inválido ou expirado. Solicite um novo link de recuperação.')
      }
      throw new Error(msg)
    }
  },
}
