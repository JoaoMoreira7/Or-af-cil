/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const planosCol = app.findCollectionByNameOrId('planos')

    // 1. Atualizar select de status se existir
    const statusField = planosCol.fields.getByName('status')
    if (statusField) {
      statusField.values = ['trial', 'ativo', 'expirado', 'inativo']
    } else {
      planosCol.fields.add(
        new SelectField({
          name: 'status',
          required: true,
          values: ['trial', 'ativo', 'expirado', 'inativo'],
          maxSelect: 1,
        }),
      )
    }

    // 2. Adicionar campo trial_ate se não existir
    if (!planosCol.fields.getByName('trial_ate')) {
      planosCol.fields.add(new DateField({ name: 'trial_ate' }))
    }

    // 3. Atualizar select de plano para manter compatibilidade ou apenas starter
    const planoField = planosCol.fields.getByName('plano')
    if (planoField) {
      planoField.values = ['starter', 'pro']
    }

    app.save(planosCol)

    // 4. Configurar conta demo jaocarloss@gmail.com com trial de 3 dias restantes
    try {
      const demoUser = app.findAuthRecordByEmail('_pb_users_auth_', 'jaocarloss@gmail.com')
      const trialAte = new Date()
      trialAte.setDate(trialAte.getDate() + 3) // 3 dias restantes

      try {
        const planoDemo = app.findFirstRecordByData('planos', 'user_id', demoUser.id)
        planoDemo.set('plano', 'starter')
        planoDemo.set('status', 'trial')
        planoDemo.set('trial_ate', trialAte.toISOString())
        app.save(planoDemo)
      } catch (_) {
        const novoPlano = new Record(planosCol)
        novoPlano.set('user_id', demoUser.id)
        novoPlano.set('plano', 'starter')
        novoPlano.set('status', 'trial')
        novoPlano.set('trial_ate', trialAte.toISOString())
        app.save(novoPlano)
      }
    } catch (_) {}
  },
  (app) => {
    // Reverter de volta se necessário
    try {
      const planosCol = app.findCollectionByNameOrId('planos')
      const trialField = planosCol.fields.getByName('trial_ate')
      if (trialField) {
        planosCol.fields.remove(trialField)
        app.save(planosCol)
      }
    } catch (_) {}
  },
)
