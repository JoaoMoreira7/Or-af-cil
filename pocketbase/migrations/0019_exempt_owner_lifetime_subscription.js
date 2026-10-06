// @ts-nocheck
migrate(
  (app) => {
    // Configurar a conta do dono (jaocarloss@gmail.com) com plano premium vitalício ativo
    try {
      const demoUser = app.findAuthRecordByEmail('_pb_users_auth_', 'jaocarloss@gmail.com')
      if (demoUser) {
        // Garante que é admin
        demoUser.set('admin', true)
        app.save(demoUser)

        const planosCollection = app.findCollectionByNameOrId('planos')
        const planos = app.findRecordsByFilter(
          'planos',
          `user_id = "${demoUser.id}"`,
          '-created',
          1,
          0,
        )

        // Data distante no futuro (ano 2099)
        const dataFutura = new Date('2099-12-31T23:59:59.000Z').toISOString()

        if (planos && planos.length > 0) {
          const plano = planos[0]
          plano.set('plano', 'premium')
          plano.set('status', 'ativo')
          plano.set('renovacao_em', dataFutura)
          plano.set('trial_ate', dataFutura)
          plano.set('aviso_teste_enviado', true)
          app.save(plano)
        } else {
          const novoPlano = new Record(planosCollection)
          novoPlano.set('user_id', demoUser.id)
          novoPlano.set('plano', 'premium')
          novoPlano.set('status', 'ativo')
          novoPlano.set('renovacao_em', dataFutura)
          novoPlano.set('trial_ate', dataFutura)
          novoPlano.set('aviso_teste_enviado', true)
          app.save(novoPlano)
        }
      }
    } catch (err) {
      console.warn('Erro ao configurar plano vitalício do dono na migração 0019:', err)
    }
  },
  (app) => {
    // Reversão no-op segura
  },
)
