// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/resumo-semanal',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const userId = e.auth?.id || body.userId
      if (!userId) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const agora = new Date()
      // Últimos 7 dias
      const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
      const seteDiasIso = seteDiasAtras.toISOString().replace('T', ' ')
      // Limite para orçamentos sem resposta há 5+ dias
      const cincoDiasAtras = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000)

      // 1. Carrega preferências de IA do usuário
      let prefNome = ''
      let prefTom = 'amigavel' // 'formal', 'amigavel', 'direto'
      let prefEmojis = true

      try {
        const prefRec = $app.findFirstRecordByData('preferencias_ia', 'user_id', userId)
        if (prefRec) {
          prefNome = prefRec.getString('nome_preferido') || ''
          prefTom = prefRec.getString('tom_resposta') || 'amigavel'
          prefEmojis = prefRec.getBool('usar_emojis')
        }
      } catch (_) {
        try {
          const u = $app.findRecordById('_pb_users_auth_', userId)
          if (u) {
            prefNome = (u.getString('name') || '').split(' ')[0]
          }
        } catch (_) {}
      }

      if (body.preferencias) {
        if (body.preferencias.nome_preferido !== undefined) {
          prefNome = body.preferencias.nome_preferido
        }
        if (body.preferencias.tom_resposta) {
          prefTom = body.preferencias.tom_resposta
        }
        if (body.preferencias.usar_emojis !== undefined) {
          prefEmojis = !!body.preferencias.usar_emojis
        }
      }

      // 2. Busca orçamentos do usuário
      let orcamentosTodos = []
      try {
        orcamentosTodos = $app.findRecordsByFilter(
          'orcamentos',
          "user_id = '" + userId + "'",
          '-created',
          200,
          0,
        )
      } catch (err) {}

      // Agregação dos orçamentos
      let orcamentosCriadosSemana = 0
      let orcamentosAprovadosSemana = 0
      let valorAprovadoSemana = 0
      let orcamentosSemResposta5Dias = 0
      let orcamentosEnviadosSemana = 0

      for (let i = 0; i < orcamentosTodos.length; i++) {
        const o = orcamentosTodos[i]
        const createdStr = o.getString('created') || ''
        const createdDate = new Date(createdStr)
        const valor = o.getFloat('valor_total') || 0
        const status = o.getString('status') || ''

        // Criados nos últimos 7 dias
        if (createdDate >= seteDiasAtras) {
          orcamentosCriadosSemana++
          if (status === 'enviado') {
            orcamentosEnviadosSemana++
          }
        }

        // Aprovados com atualização ou criação nos últimos 7 dias
        const updatedStr = o.getString('updated') || createdStr
        const updatedDate = new Date(updatedStr)
        if (
          status === 'aprovado' &&
          (updatedDate >= seteDiasAtras || createdDate >= seteDiasAtras)
        ) {
          orcamentosAprovadosSemana++
          valorAprovadoSemana += valor
        }

        // Sem resposta há 5+ dias: status 'enviado' ou 'rascunho' criados há 5 dias ou mais
        if ((status === 'enviado' || status === 'rascunho') && createdDate <= cincoDiasAtras) {
          orcamentosSemResposta5Dias++
        }
      }

      // 3. Busca cobranças do usuário
      let cobrancasTodas = []
      try {
        cobrancasTodas = $app.findRecordsByFilter(
          'cobrancas',
          "user_id = '" + userId + "'",
          '-created',
          200,
          0,
        )
      } catch (err) {}

      let cobrancasPagasSemana = 0
      let valorCobradoPagoSemana = 0
      let cobrancasPendentes = 0
      let valorPendenteReceber = 0

      for (let i = 0; i < cobrancasTodas.length; i++) {
        const c = cobrancasTodas[i]
        const status = c.getString('status')
        const valor = c.getFloat('valor') || 0
        const pagoEmStr = c.getString('pago_em') || c.getString('updated')
        const pagoEm = pagoEmStr ? new Date(pagoEmStr) : null

        if (status === 'pago') {
          if (pagoEm && pagoEm >= seteDiasAtras) {
            cobrancasPagasSemana++
            valorCobradoPagoSemana += valor
          }
        } else if (status === 'pendente') {
          cobrancasPendentes++
          valorPendenteReceber += valor
        }
      }

      // Se não há cobranças pendentes cadastradas explicitamente, calcula o saldo a receber dos orçamentos aprovados
      if (valorPendenteReceber === 0) {
        for (let i = 0; i < orcamentosTodos.length; i++) {
          const o = orcamentosTodos[i]
          if (o.getString('status') === 'aprovado') {
            let pago = false
            for (let k = 0; k < cobrancasTodas.length; k++) {
              if (
                cobrancasTodas[k].getString('orcamento_id') === o.id &&
                cobrancasTodas[k].getString('status') === 'pago'
              ) {
                pago = true
                break
              }
            }
            if (!pago) {
              valorPendenteReceber += o.getFloat('valor_total') || 0
            }
          }
        }
      }

      // 4. Busca novos clientes nos últimos 7 dias
      let novosClientesSemana = 0
      try {
        const clientes = $app.findRecordsByFilter(
          'clientes',
          "user_id = '" + userId + "'",
          '-created',
          100,
          0,
        )
        for (let i = 0; i < clientes.length; i++) {
          const createdStr = clientes[i].getString('created') || ''
          if (new Date(createdStr) >= seteDiasAtras) {
            novosClientesSemana++
          }
        }
      } catch (err) {}

      const metricas = {
        orcamentos_criados: orcamentosCriadosSemana,
        orcamentos_enviados: orcamentosEnviadosSemana,
        orcamentos_aprovados: orcamentosAprovadosSemana,
        valor_aprovado: valorAprovadoSemana,
        cobrancas_pagas: cobrancasPagasSemana,
        valor_pago: valorCobradoPagoSemana,
        cobrancas_pendentes: cobrancasPendentes,
        valor_pendente: valorPendenteReceber,
        novos_clientes: novosClientesSemana,
        orcamentos_sem_resposta_5_dias: orcamentosSemResposta5Dias,
      }

      // 5. Monta texto fallback inteligente caso o LLM esteja sem resposta
      const formatarMoeda = function (num) {
        return 'R$ ' + (num || 0).toFixed(2).replace('.', ',')
      }

      const saudacaoNome = prefNome ? prefNome : 'parceiro(a)'
      let fallbackTexto = ''
      const emojiIcon = prefEmojis ? '🎙️ ' : ''
      const emojiCheck = prefEmojis ? '✅ ' : ''
      const emojiMoney = prefEmojis ? '💰 ' : ''
      const emojiSparkle = prefEmojis ? '✨ ' : ''

      if (prefTom === 'formal') {
        const trat = prefNome ? 'Prezado(a) ' + prefNome : 'Prezado(a) gestor(a)'
        fallbackTexto =
          trat +
          ', aqui está o seu balanço semanal de atividades. ' +
          'Nos últimos 7 dias, foram formalizados ' +
          orcamentosCriadosSemana +
          ' novo(s) orçamento(s) ' +
          'e aprovado(s) ' +
          orcamentosAprovadosSemana +
          ' (' +
          formatarMoeda(valorAprovadoSemana) +
          '). ' +
          (orcamentosSemResposta5Dias > 0
            ? 'Atualmente, há ' +
              orcamentosSemResposta5Dias +
              ' proposta(s) aguardando retorno há mais de 5 dias. '
            : 'Não constam propostas pendentes há mais de 5 dias. ') +
          (valorPendenteReceber > 0
            ? 'O saldo total pendente a receber é de ' + formatarMoeda(valorPendenteReceber) + '. '
            : 'Não há pendências de recebimento. ') +
          (novosClientesSemana > 0
            ? 'Houve ' + novosClientesSemana + ' novo(s) cliente(s) cadastrado(s). '
            : '') +
          'Desejamos uma excelente semana de trabalho.'
      } else if (prefTom === 'direto') {
        fallbackTexto =
          'Resumo da semana: ' +
          orcamentosAprovadosSemana +
          ' orçamentos fechados (' +
          formatarMoeda(valorAprovadoSemana) +
          '), ' +
          orcamentosCriadosSemana +
          ' criados e ' +
          orcamentosSemResposta5Dias +
          ' aguardando retorno há mais de 5 dias. ' +
          'Saldo a receber: ' +
          formatarMoeda(valorPendenteReceber) +
          '. ' +
          (novosClientesSemana > 0 ? novosClientesSemana + ' novos clientes. ' : '') +
          'Boa semana.'
      } else {
        // amigável padrão estilo "podcast de 1 minuto" do Meu Assessor
        fallbackTexto =
          emojiIcon +
          'Olá, ' +
          saudacaoNome +
          '! Aqui é seu resumo semanal em áudio de 1 minuto. ' +
          emojiCheck +
          'Esta semana você fechou ' +
          orcamentosAprovadosSemana +
          ' orçamento(s) totalizando ' +
          formatarMoeda(valorAprovadoSemana) +
          ', ' +
          'criou ' +
          orcamentosCriadosSemana +
          ' nova(s) proposta(s) ' +
          (orcamentosSemResposta5Dias > 0
            ? 'e tem ' + orcamentosSemResposta5Dias + ' aguardando resposta há mais de 5 dias. '
            : 'e todos os contatos estão em dia! ') +
          (valorPendenteReceber > 0
            ? emojiMoney + 'Você tem ' + formatarMoeda(valorPendenteReceber) + ' a receber. '
            : 'Suas contas estão 100% em dia. ') +
          (novosClientesSemana > 0
            ? emojiSparkle +
              'Além disso, conquistou ' +
              novosClientesSemana +
              ' novo(s) cliente(s)! '
            : '') +
          'Continue com esse ritmo e tenha uma excelente semana!'
      }

      // 6. Chamada ao $ai.chat (alias "fast") para gerar podcast falado personalizado
      let textoGerado = fallbackTexto
      try {
        const promptSistema =
          'Você é o assistente virtual executivo da plataforma JM Sistemas (estilo o app Meu Assessor).\n' +
          'Sua missão é produzir um "podcast de 1 minuto" em texto corrido em português do Brasil (pt-BR) ' +
          'para ser LIDO EM VOZ ALTA por um sintetizador de voz (Web Speech API).\n\n' +
          'REGRAS DO TEXTO:\n' +
          '1. Escreva um texto fluido, natural de falar, com pontuação adequada para pausas de respiração.\n' +
          '2. Duração ideal de fala: entre 40 a 60 segundos (cerca de 70 a 110 palavras).\n' +
          '3. Persona do usuário:\n' +
          '   - Nome preferido: ' +
          (prefNome || 'Gestor(a)') +
          '\n' +
          '   - Tom: ' +
          prefTom +
          ' (formal: polido e profissional; amigavel: motivador, caloroso e parceiro; direto: objetivo, sem rodeios)\n' +
          '   - Usar emojis no texto: ' +
          (prefEmojis ? 'sim (poucos e bem colocados)' : 'não') +
          '\n' +
          '4. Fale explicitamente dos números consolidados da semana:\n' +
          '   - Orçamentos fechados/aprovados e valor em reais\n' +
          '   - Orçamentos criados/enviados\n' +
          '   - Orçamentos pendentes sem resposta há mais de 5 dias (se houver, alerte com cuidado)\n' +
          '   - Saldo pendente a receber (se houver)\n' +
          '   - Novos clientes adicionados (se houver)\n' +
          '5. Termine com uma mensagem de encorajamento positiva para a semana.\n' +
          '6. NÃO use tags markdown como títulos (#), negrito (**), marcadores (-) ou tabelas: o texto será lido por síntese de voz, então retorne apenas parágrafos falados contínuos.'

        const promptUsuario =
          'Consolidação dos últimos 7 dias do usuário:\n' +
          '- Orçamentos criados: ' +
          metricas.orcamentos_criados +
          '\n' +
          '- Orçamentos enviados: ' +
          metricas.orcamentos_enviados +
          '\n' +
          '- Orçamentos aprovados: ' +
          metricas.orcamentos_aprovados +
          ' (Total: ' +
          formatarMoeda(metricas.valor_aprovado) +
          ')\n' +
          '- Cobranças pagas na semana: ' +
          metricas.cobrancas_pagas +
          ' (' +
          formatarMoeda(metricas.valor_pago) +
          ')\n' +
          '- Cobranças / valores a receber pendentes: ' +
          formatarMoeda(metricas.valor_pendente) +
          '\n' +
          '- Orçamentos sem resposta há 5+ dias: ' +
          metricas.orcamentos_sem_resposta_5_dias +
          '\n' +
          '- Novos clientes cadastrados na semana: ' +
          metricas.novos_clientes +
          '\n\n' +
          'Gere o roteiro do resumo semanal de voz agora:'

        const aiRes = $ai.chat({
          model: 'fast',
          messages: [
            { role: 'system', content: promptSistema },
            { role: 'user', content: promptUsuario },
          ],
        })

        const respostaAi = aiRes?.choices?.[0]?.message?.content
        if (respostaAi && typeof respostaAi === 'string' && respostaAi.trim().length > 30) {
          // Remove asteriscos e hashtags que atrapalham síntese de voz
          textoGerado = respostaAi
            .replace(/[#*_`]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        }
      } catch (aiErr) {
        // Mantém fallback inteligente
      }

      return e.json(200, {
        sucesso: true,
        resumo_texto: textoGerado,
        metricas: metricas,
        preferencias_aplicadas: {
          nome_preferido: prefNome,
          tom_resposta: prefTom,
          usar_emojis: prefEmojis,
        },
        gerado_em: agora.toISOString(),
      })
    } catch (err) {
      return e.json(500, {
        error: err.message || 'Erro ao gerar resumo semanal',
      })
    }
  },
  $apis.requireAuth(),
)
