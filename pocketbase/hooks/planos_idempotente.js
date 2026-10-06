// @ts-nocheck

/**
 * Hook de proteção e idempotência para a collection 'planos'.
 *
 * Objetivo:
 * Evitar erros HTTP 400 por violação da restrição única no índice `idx_planos_user_id (user_id)`
 * quando dois fluxos ou abas/clientes tentam criar um plano para o mesmo usuário concorrentemente.
 *
 * Se já existir um registro de plano para o `user_id` recebido na requisição:
 * 1. Localiza o registro existente no banco.
 * 2. Atualiza os campos enviados no payload (plano, status, renovacao_em, trial_ate, aviso_teste_enviado).
 * 3. Retorna HTTP 200 com o registro atualizado (interrompendo o e.next() para que o CREATE não seja executado
 *    e a restrição única do banco não seja violada).
 *
 * Se NÃO existir registro prévio, segue normalmente com e.next().
 */
onRecordCreateRequest((e) => {
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

    // Busca se já existe um registro para esse user_id
    let planoExistente = null
    try {
      planoExistente = $app.findFirstRecordByData('planos', 'user_id', userId)
    } catch (_) {
      // Registro não existe ainda, pode prosseguir com o create normal
      planoExistente = null
    }

    if (planoExistente) {
      console.log(
        `[hook:planos_idempotente] Plano já existente (${planoExistente.id}) detectado para user_id=${userId}. Interceptando CREATE para evitar 400.`,
      )

      // Copia campos novos se enviados
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
        console.log(
          `[hook:planos_idempotente] Plano ${planoExistente.id} atualizado com novos campos recebidos no payload de create.`,
        )
      }

      // Retorna 200 diretamente com o JSON do registro existente/atualizado
      // Não chama e.next(), impedindo que o INSERT duplicado ocorra
      e.json(200, planoExistente)
      return
    }
  } catch (err) {
    console.error('[hook:planos_idempotente] Erro na interceptação de create de planos:', err)
  }

  e.next()
}, 'planos')
