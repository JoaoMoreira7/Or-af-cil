// @ts-nocheck
migrate(
  (app) => {
    // Ler o debug_asaas_status completo anterior
    let anterior = ''
    try {
      const r = app.findFirstRecordByData('configuracoes_sistema', 'chave', 'debug_asaas_status')
      if (r) anterior = r.getString('valor')
    } catch (_) {}

    // Testar também a criação ou garantia de plano
    let userTeste = null
    try {
      userTeste = app.findFirstRecordByData('users', 'email', 'jaocarloss@gmail.com')
    } catch (_) {}

    let testePlanoStatus = 'Nenhum'
    if (userTeste) {
      try {
        // Busca plano atual
        const planoAtual = app.findFirstRecordByData('planos', 'user_id', userTeste.id)
        testePlanoStatus =
          'Existe plano id=' +
          planoAtual.id +
          ' status=' +
          planoAtual.getString('status') +
          ' plano=' +
          planoAtual.getString('plano')
      } catch (err) {
        testePlanoStatus = 'Erro: ' + (err.message || String(err))
      }
    }

    try {
      const logRec = app.findFirstRecordByData(
        'configuracoes_sistema',
        'chave',
        'debug_asaas_status',
      )
      logRec.set('valor', (anterior + '\nPLANO: ' + testePlanoStatus).slice(0, 3000))
      app.save(logRec)
    } catch (_) {}
  },
  (app) => {},
)
