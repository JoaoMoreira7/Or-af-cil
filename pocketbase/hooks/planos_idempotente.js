// @ts-nocheck

/**
 * Hook de proteção e idempotência para a collection 'planos'.
 *
 * 1. onRecordCreate: Impede violação de índice único idx_planos_user_id no DB interceptando
 *    qualquer tentativa de create caso já exista registro para o mesmo user_id.
 * 2. routerAdd POST /backend/v1/planos/garantir: Endpoint atômico de upsert seguro.
 */

onRecordCreate((e) => {
  try {
    const record = e.record
    if (!record) {
      e.next()
      return
    }

    const userId = record.getString('user_id')
    if (!userId) {
      e.next()
      return
    }

    let planoExistente = null
    try {
      planoExistente = $app.findFirstRecordByData('planos', 'user_id', userId)
    } catch (_) {
      planoExistente = null
    }

    if (planoExistente) {
      // Atualiza o existente se necessário com os campos do novo record
      const novoPlano = record.getString('plano')
      const novoStatus = record.getString('status')
      const novaRenovacao = record.getString('renovacao_em')
      const novoTrialAte = record.getString('trial_ate')
      const novoAviso = record.getBool('aviso_teste_enviado')

      let alterou = false
      if (novoPlano && novoPlano !== planoExistente.getString('plano')) {
        planoExistente.set('plano', novoPlano)
        alterou = true
      }
      if (novoStatus && novoStatus !== planoExistente.getString('status')) {
        planoExistente.set('status', novoStatus)
        alterou = true
      }
      if (novaRenovacao && novaRenovacao !== planoExistente.getString('renovacao_em')) {
        planoExistente.set('renovacao_em', novaRenovacao)
        alterou = true
      }
      if (novoTrialAte && novoTrialAte !== planoExistente.getString('trial_ate')) {
        planoExistente.set('trial_ate', novoTrialAte)
        alterou = true
      }
      if (novoAviso !== undefined && novoAviso !== planoExistente.getBool('aviso_teste_enviado')) {
        planoExistente.set('aviso_teste_enviado', novoAviso)
        alterou = true
      }

      if (alterou) {
        $app.save(planoExistente)
      }

      // Lança erro amigável informando colisão de plano existente
      throw new BadRequestError(`Plano já existente para o usuário ${userId}. Utilize atualização.`)
    }

    // Se não existia plano prévio, permite salvar normalmente chamando e.next()!
    e.next()
  } catch (err) {
    if (err.status) throw err
    console.warn('[hook:planos_idempotente] Aviso onRecordCreate:', err)
    e.next()
  }
}, 'planos')

routerAdd(
  'POST',
  '/backend/v1/planos/garantir',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const body = e.requestInfo().body || {}
      let targetUserId = String(body.user_id || '').trim()

      // Se não especificado ou se não for admin, força para o próprio ID autenticado
      const isSuperuserOrAdmin =
        authUser.isSuperuser?.() ||
        authUser.getBool('admin') ||
        authUser.getString('email') === 'jaocarloss@gmail.com'
      if (!targetUserId || !isSuperuserOrAdmin) {
        targetUserId = authUser.id
      }

      const planoRecebido = String(body.plano || 'essencial')
      const statusRecebido = String(body.status || 'trial')
      const renovacaoRecebida = body.renovacao_em ? String(body.renovacao_em) : ''
      const trialAteRecebido = body.trial_ate ? String(body.trial_ate) : ''
      const avisoRecebido =
        body.aviso_teste_enviado !== undefined ? Boolean(body.aviso_teste_enviado) : false

      // Busca plano existente
      let planoRecord = null
      try {
        planoRecord = $app.findFirstRecordByData('planos', 'user_id', targetUserId)
      } catch (_) {
        planoRecord = null
      }

      if (planoRecord) {
        let alterou = false
        if (planoRecebido && planoRecebido !== planoRecord.getString('plano')) {
          planoRecord.set('plano', planoRecebido)
          alterou = true
        }
        if (statusRecebido && statusRecebido !== planoRecord.getString('status')) {
          planoRecord.set('status', statusRecebido)
          alterou = true
        }
        if (renovacaoRecebida && renovacaoRecebida !== planoRecord.getString('renovacao_em')) {
          planoRecord.set('renovacao_em', renovacaoRecebida)
          alterou = true
        }
        if (trialAteRecebido && trialAteRecebido !== planoRecord.getString('trial_ate')) {
          planoRecord.set('trial_ate', trialAteRecebido)
          alterou = true
        }
        if (
          body.aviso_teste_enviado !== undefined &&
          avisoRecebido !== planoRecord.getBool('aviso_teste_enviado')
        ) {
          planoRecord.set('aviso_teste_enviado', avisoRecebido)
          alterou = true
        }

        if (alterou) {
          $app.save(planoRecord)
        }

        return e.json(200, planoRecord)
      }

      // Criar novo registro de plano de forma segura no backend
      const colPlanos = $app.findCollectionByNameOrId('planos')
      const novoPlano = new Record(colPlanos)
      novoPlano.set('user_id', targetUserId)
      novoPlano.set('plano', planoRecebido)
      novoPlano.set('status', statusRecebido)
      if (renovacaoRecebida) novoPlano.set('renovacao_em', renovacaoRecebida)
      if (trialAteRecebido) novoPlano.set('trial_ate', trialAteRecebido)
      novoPlano.set('aviso_teste_enviado', avisoRecebido)

      try {
        $app.save(novoPlano)
        return e.json(200, novoPlano)
      } catch (createErr) {
        // Em caso de corrida, busca o registro que acabou de ser criado
        try {
          const planoRecuperado = $app.findFirstRecordByData('planos', 'user_id', targetUserId)
          return e.json(200, planoRecuperado)
        } catch (_) {
          throw createErr
        }
      }
    } catch (err) {
      console.error('[planos_idempotente] Erro ao garantir plano do usuário:', err)
      return e.json(500, { error: err.message || 'Erro interno ao garantir plano' })
    }
  },
  $apis.requireAuth(),
)
