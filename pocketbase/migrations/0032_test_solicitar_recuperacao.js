// @ts-nocheck
migrate(
  (app) => {
    // Testar solicitação de recuperação para jaocarloss@gmail.com
    let resultado = 'iniciado'
    try {
      const res = $http.send({
        url: 'https://finalizacao-do-sistema-913b5.shrd00.internal.goskip.dev/backend/v1/auth/solicitar-recuperacao',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'jaocarloss@gmail.com',
        }),
        timeout: 10,
      })
      resultado = 'status: ' + res.statusCode + ' | body: ' + res.raw
    } catch (err) {
      resultado = 'erro: ' + err
    }

    try {
      const confCol = app.findCollectionByNameOrId('configuracoes_sistema')
      let rec = null
      try {
        rec = app.findFirstRecordByData('configuracoes_sistema', 'chave', 'teste_recuperacao_senha')
      } catch (_) {}
      if (!rec) {
        rec = new Record(confCol)
        rec.set('chave', 'teste_recuperacao_senha')
      }
      rec.set('valor', resultado)
      rec.set('descricao', 'Resultado do teste de solicitação de recuperação de senha')
      rec.set('ultima_verificacao', new Date().toISOString())
      app.save(rec)
    } catch (_) {}
  },
  (app) => {},
)
