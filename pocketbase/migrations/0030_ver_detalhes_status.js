// @ts-nocheck
migrate(
  (app) => {
    let val = ''
    try {
      const r = app.findFirstRecordByData('configuracoes_sistema', 'chave', 'debug_asaas_status')
      if (r) val = r.getString('valor')
    } catch (_) {}

    // Cortar o início para ver o resto
    const parte2 = val.length > 150 ? val.slice(150, 450) : val

    try {
      const logRec = app.findFirstRecordByData(
        'configuracoes_sistema',
        'chave',
        'debug_asaas_status',
      )
      logRec.set('valor', parte2)
      app.save(logRec)
    } catch (_) {}
  },
  (app) => {},
)
