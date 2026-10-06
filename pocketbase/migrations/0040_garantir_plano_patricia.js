// @ts-nocheck
migrate(
  (app) => {
    // 1. Limpar debugs
    try {
      const d1 = app.findFirstRecordByData('configuracoes_sistema', 'chave', 'debug_planos_save')
      app.delete(d1)
    } catch (_) {}

    // 2. Garantir plano para o usuário consultoriajmnfe@gmail.com
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'consultoriajmnfe@gmail.com')
      user.setVerified(true)
      user.set('name', 'Patricia De Souza Almeida Santos')
      app.save(user)

      let planoExistente = null
      try {
        planoExistente = app.findFirstRecordByData('planos', 'user_id', user.id)
      } catch (_) {}

      if (!planoExistente) {
        const planosCol = app.findCollectionByNameOrId('planos')
        const p = new Record(planosCol)
        p.set('user_id', user.id)
        p.set('plano', 'essencial')
        p.set('status', 'trial')
        const trialAte = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        p.set('trial_ate', trialAte.toISOString())
        p.set('aviso_teste_enviado', false)
        app.save(p)
      }
    } catch (_) {}
  },
  (app) => {},
)
