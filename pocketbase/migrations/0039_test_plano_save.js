// @ts-nocheck
migrate(
  (app) => {
    let errResult = ''
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'consultoriajmnfe@gmail.com')
      const planosCol = app.findCollectionByNameOrId('planos')
      const p = new Record(planosCol)
      p.set('user_id', user.id)
      p.set('plano', 'essencial')
      p.set('status', 'trial')
      p.set('aviso_teste_enviado', false)
      const trialAte = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      p.set('trial_ate', trialAte.toISOString())
      app.save(p)
      errResult = 'sucesso id=' + p.id
    } catch (e) {
      errResult = 'erro: ' + e
    }

    try {
      const confCol = app.findCollectionByNameOrId('configuracoes_sistema')
      let rec = new Record(confCol)
      rec.set('chave', 'debug_planos_save')
      rec.set('valor', errResult)
      app.save(rec)
    } catch (_) {}
  },
  (app) => {},
)
