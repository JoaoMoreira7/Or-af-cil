// @ts-nocheck
routerAdd('POST', '/backend/v1/auth/confirmar-redefinicao', (e) => {
  try {
    const body = e.requestInfo().body || {}
    const token = (body.token || '').toString().trim()
    const password = (body.password || '').toString()
    const passwordConfirm = (body.passwordConfirm || body.confirmPassword || '').toString()

    if (!token) {
      return e.json(400, {
        error: 'Token de redefinição não fornecido ou inválido.',
      })
    }

    if (!password || password.length < 8) {
      return e.json(400, {
        error: 'A nova senha deve ter no mínimo 8 caracteres.',
      })
    }

    if (password !== passwordConfirm) {
      return e.json(400, {
        error: 'A nova senha e a confirmação não coincidem.',
      })
    }

    let userId = null
    let userEmail = null

    // Tentativa 1: Verificar se é um token nativo de password reset
    // No PocketBase v0.36, pode ser validado via pbCollection users confirmPasswordReset internamente
    // Ou via $security.parseJWT
    let jwtPayload = null
    try {
      // Tentar parse como JWT não assinado para ler os claims id / email
      // Um JWT tem 3 partes separadas por ponto
      const parts = token.split('.')
      if (parts.length === 3) {
        // Decodificar base64url do payload
        let payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        while (payloadBase64.length % 4) {
          payloadBase64 += '='
        }
        // PocketBase goja pode decodificar base64
        // Em goja não há atob por padrão, mas podemos tentar parseJWT ou busca por tokenKey
      }
    } catch (_) {}

    // Tentar decodificar/validar o token contra os usuários do sistema
    // Encontrar o usuário cujo tokenKey valida o token
    let usuarioEncontrado = null
    const todosUsuarios = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 500, 0)

    for (let i = 0; i < todosUsuarios.length; i++) {
      const u = todosUsuarios[i]
      const tokenKey = u.getString('tokenKey')

      // 1. Tentar validação com parseJWT usando tokenKey do usuário
      if (tokenKey) {
        try {
          const data = $security.parseJWT(token, tokenKey)
          if (data && (data.id === u.id || data.email === u.getString('email'))) {
            usuarioEncontrado = u
            break
          }
        } catch (_) {}
      }

      // 2. Tentar validação nativa caso o PocketBase tenha gerado com outro segredo do app
      try {
        const appSecret =
          $app.settings().recordPasswordResetToken?.secret || $app.settings().meta?.appName
        if (appSecret) {
          const data = $security.parseJWT(token, appSecret)
          if (data && (data.id === u.id || data.email === u.getString('email'))) {
            usuarioEncontrado = u
            break
          }
        }
      } catch (_) {}
    }

    // Se ainda não encontrou via parse manual, tentar se há método no $tokens ou tentar com as coleções
    if (!usuarioEncontrado) {
      return e.json(400, {
        error: 'Link inválido ou expirado. Por favor, solicite um novo link de recuperação.',
        codigo: 'TOKEN_INVALIDO',
      })
    }

    // Atualizar a senha do usuário encontrado
    usuarioEncontrado.setPassword(password)
    // Renovar o tokenKey para invalidar tokens de reset anteriores
    usuarioEncontrado.set('tokenKey', $security.randomString(32))
    $app.save(usuarioEncontrado)

    console.log(
      `[auth:confirmar_redefinicao] Senha redefinida com sucesso para usuário ${usuarioEncontrado.getString('email')}`,
    )

    return e.json(200, {
      sucesso: true,
      email: usuarioEncontrado.getString('email'),
      mensagem: 'Senha redefinida com sucesso! Você já pode entrar com sua nova senha.',
    })
  } catch (err) {
    console.error('[auth:confirmar_redefinicao] Erro:', err)
    return e.json(500, {
      error: 'Erro ao redefinir a senha. Verifique os dados e tente novamente.',
    })
  }
})
