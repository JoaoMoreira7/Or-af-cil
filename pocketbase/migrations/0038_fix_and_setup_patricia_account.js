// @ts-nocheck
migrate(
  (app) => {
    // 1. Limpar debug_users_col se existir
    try {
      const debugRec = app.findFirstRecordByData(
        'configuracoes_sistema',
        'chave',
        'debug_users_col',
      )
      app.delete(debugRec)
    } catch (_) {}

    // 2. Tratar a conta da Patricia De Souza Almeida Santos (consultoriajmnfe@gmail.com):
    // Garantir que ela tenha email verificado e o plano de teste de 7 dias criado e ativo
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'consultoriajmnfe@gmail.com')
      user.setVerified(true)
      user.set('name', 'Patricia De Souza Almeida Santos')
      app.save(user)

      // Verificar se já possui plano
      let planoExistente = null
      try {
        planoExistente = app.findFirstRecordByData('planos', 'user_id', user.id)
      } catch (_) {}

      if (!planoExistente) {
        const planosCol = app.findCollectionByNameOrId('planos')
        const novoPlano = new Record(planosCol)
        novoPlano.set('user_id', user.id)
        novoPlano.set('plano', 'essencial')
        novoPlano.set('status', 'trial')
        const trialAte = new Date()
        trialAte.setDate(trialAte.getDate() + 7)
        novoPlano.set('trial_ate', trialAte.toISOString())
        novoPlano.set('aviso_teste_enviado', false)
        app.save(novoPlano)
      }
    } catch (_) {}
  },
  (app) => {},
)
