// @ts-nocheck
/**
 * Hook Centralizado de Inteligência Artificial do OrçaFácil
 * Rota Principal: POST /backend/v1/interpretar
 *
 * Recursos de Confiabilidade:
 * - Autenticação obrigatória ($apis.requireAuth() e e.auth?.id rigoroso)
 * - Isolamento por usuário (clientes, orçamentos, gastos)
 * - Sanitização e validação de entrada
 * - Respostas de erro claras em português sem expor chaves ou segredos
 * - Fallbacks inteligentes e tolerantes a instabilidades do LLM
 */

routerAdd(
  'POST',
  '/backend/v1/interpretar',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) {
        return e.json(401, {
          sucesso: false,
          error: 'Sessão expirada ou não autenticado. Faça login novamente.',
        })
      }

      const body = e.requestInfo().body || {}
      const transcricao = (body.transcricao || body.texto || body.descricao || '').trim()

      if (!transcricao) {
        return e.json(400, {
          sucesso: false,
          error: 'A transcrição de áudio ou texto é obrigatória.',
        })
      }

      // Sanitização de tamanho de texto (proteção contra payloads abusivos)
      if (transcricao.length > 5000) {
        return e.json(400, {
          sucesso: false,
          error: 'O texto informado ultrapassa o limite máximo permitido de 5.000 caracteres.',
        })
      }

      // Função inline de normalização
      const normalizeText = function (str) {
        if (!str) return ''
        return String(str)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }

      const transNorm = normalizeText(transcricao)
      const contexto = body.contexto || 'geral'
      const operacaoDiretaItens = body.modo === 'orcamento_itens'

      // 0. Carrega preferências da IA do usuário
      let prefNome = ''
      let prefTom = 'amigavel' // 'formal', 'amigavel', 'direto'
      let prefEmojis = true
      let prefContextoGastoPadrao = 'empresa'

      try {
        const prefRec = $app.findFirstRecordByData('preferencias_ia', 'user_id', userId)
        if (prefRec) {
          prefNome = prefRec.getString('nome_preferido') || ''
          prefTom = prefRec.getString('tom_resposta') || 'amigavel'
          prefEmojis = prefRec.getBool('usar_emojis')
          prefContextoGastoPadrao = prefRec.getString('contexto_gasto_padrao') || 'empresa'
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
        if (body.preferencias.contexto_gasto_padrao) {
          prefContextoGastoPadrao = body.preferencias.contexto_gasto_padrao
        }
      }

      const formatarTratamento = function () {
        if (prefTom === 'formal') {
          return prefNome ? 'Sr(a). ' + prefNome : 'Prezado(a)'
        }
        if (prefTom === 'direto') {
          return prefNome || ''
        }
        return prefNome || 'amigo'
      }

      // Se for modo explícito de gerar itens para formulário
      if (operacaoDiretaItens) {
        let itensExtraidos = []
        let clienteSug = null
        try {
          const promptMessage =
            'Gere itens realistas de orçamento comercial e estime valores unitários em BRL para o seguinte serviço:\n\n' +
            transcricao.slice(0, 2000) +
            '\n\nRetorne EXCLUSIVAMENTE um JSON sem texto adicional:\n' +
            '{\n' +
            '  "itens": [{ "descricao": "string descritiva", "quantidade": 1, "valor_unitario": 150.00 }]\n' +
            '}'

          let resAgent = null
          try {
            resAgent = $ai.agent('orcamento-assistente').chat({
              user_id: userId,
              message: promptMessage,
            })
          } catch (eChat1) {
            console.log('[ia_interpretar] Fallback do agente para fast chat:', eChat1.message)
            const chatRes = $ai.chat({
              model: 'fast',
              messages: [
                {
                  role: 'system',
                  content: 'Você é especialista em orçamentos comerciais de serviços no Brasil.',
                },
                { role: 'user', content: promptMessage },
              ],
            })
            resAgent = { content: chatRes?.choices?.[0]?.message?.content }
          }

          if (resAgent?.content) {
            const m = resAgent.content.match(/\{[\s\S]*\}/)
            if (m) {
              const parsed = JSON.parse(m[0])
              if (Array.isArray(parsed?.itens)) {
                itensExtraidos = parsed.itens.map(function (it) {
                  return {
                    descricao: String(it.descricao || 'Item de serviço').trim(),
                    quantidade: Math.max(1, Number(it.quantidade) || 1),
                    valor_unitario: Math.max(0, Number(it.valor_unitario) || 0),
                  }
                })
              }
            }
          }
        } catch (errGen) {
          console.log('[ia_interpretar] Aviso ao gerar itens via IA:', errGen.message)
        }

        if (itensExtraidos.length === 0) {
          itensExtraidos.push({
            descricao: 'Serviço especializado: ' + transcricao.slice(0, 60),
            quantidade: 1,
            valor_unitario: 250.0,
          })
        }

        return e.json(200, {
          sucesso: true,
          itens: itensExtraidos,
          cliente_sugerido: clienteSug,
          citations: [],
        })
      }

      // 1. Comando de Desfazer
      const ehComandoDesfazer =
        transNorm.indexOf('desfaz') !== -1 ||
        transNorm.indexOf('desfazer') !== -1 ||
        transNorm.indexOf('reverter') !== -1 ||
        transNorm.indexOf('voltar atras') !== -1

      if (ehComandoDesfazer) {
        return e.json(200, {
          sucesso: true,
          audio_id: null,
          transcricao_original: transcricao,
          interpretacao: {
            intencao_detectada: 'desfazer',
            comando_desfazer: true,
            transcricao_corrigida: transcricao.trim(),
            descricao_servico: 'Desfazer a última ação realizada por voz',
            itens: [],
            confianca: 'alta',
            duvidas: [],
          },
          citations: [],
        })
      }

      // 2. Comando de Personalizar IA
      const querMudarNome = transNorm.match(
        /(?:me\s+chama\s+de|me\s+chame\s+de|pode\s+me\s+chamar\s+de|meu\s+nome\s+e)\s+([a-z0-9]+)/i,
      )
      const querTomFormal =
        transNorm.indexOf('formal') !== -1 ||
        transNorm.indexOf('mais serio') !== -1 ||
        transNorm.indexOf('tom profissional') !== -1
      const querTomDireto =
        transNorm.indexOf('direto') !== -1 ||
        transNorm.indexOf('mais rapido') !== -1 ||
        transNorm.indexOf('sem enrolacao') !== -1 ||
        transNorm.indexOf('objetivo') !== -1
      const querTomAmigavel =
        transNorm.indexOf('informal') !== -1 ||
        transNorm.indexOf('amigavel') !== -1 ||
        transNorm.indexOf('descontraido') !== -1
      const querSemEmoji =
        transNorm.indexOf('sem emoji') !== -1 ||
        transNorm.indexOf('para de usar emoji') !== -1 ||
        transNorm.indexOf('pare de usar emoji') !== -1 ||
        transNorm.indexOf('sem figurinha') !== -1 ||
        transNorm.indexOf('tira os emojis') !== -1 ||
        transNorm.indexOf('nao use emoji') !== -1 ||
        transNorm.indexOf('nao usa emoji') !== -1
      const querComEmoji =
        transNorm.indexOf('com emoji') !== -1 ||
        transNorm.indexOf('use emoji') !== -1 ||
        transNorm.indexOf('pode usar emoji') !== -1 ||
        transNorm.indexOf('ativa os emojis') !== -1 ||
        transNorm.indexOf('coloca emoji') !== -1

      if (
        querMudarNome ||
        querTomFormal ||
        querTomDireto ||
        querTomAmigavel ||
        querSemEmoji ||
        querComEmoji
      ) {
        let novoNomePref = querMudarNome ? querMudarNome[1].trim() : undefined
        if (novoNomePref) {
          novoNomePref = novoNomePref.charAt(0).toUpperCase() + novoNomePref.slice(1).toLowerCase()
        }
        let novoTom = undefined
        if (querTomFormal) novoTom = 'formal'
        else if (querTomDireto) novoTom = 'direto'
        else if (querTomAmigavel) novoTom = 'amigavel'

        let novoEmoji = undefined
        if (querSemEmoji) novoEmoji = false
        else if (querComEmoji) novoEmoji = true

        const alteracoesTexto = []
        if (novoNomePref) alteracoesTexto.push('vou te chamar de ' + novoNomePref)
        if (novoTom) {
          const tomLabel =
            novoTom === 'formal' ? 'formal' : novoTom === 'direto' ? 'direto' : 'amigável'
          alteracoesTexto.push('tom de resposta alterado para ' + tomLabel)
        }
        if (novoEmoji !== undefined) {
          alteracoesTexto.push(novoEmoji ? 'emojis ativados' : 'emojis desativados')
        }

        const msgConf =
          'Pronto! ' +
          alteracoesTexto.join(', ') +
          '. Deseja confirmar essa personalização do assistente?'

        return e.json(200, {
          sucesso: true,
          audio_id: null,
          transcricao_original: transcricao,
          interpretacao: {
            intencao_detectada: 'personalizar_ia',
            comando_personalizar_ia: {
              nome_preferido: novoNomePref !== undefined ? novoNomePref : prefNome,
              tom_resposta: novoTom !== undefined ? novoTom : prefTom,
              usar_emojis: novoEmoji !== undefined ? novoEmoji : prefEmojis,
              mensagem_confirmacao: msgConf,
            },
            transcricao_corrigida: transcricao.trim(),
            descricao_servico: 'Personalizar preferências do assistente de IA',
            itens: [],
            confianca: 'alta',
            duvidas: [],
          },
          citations: [],
        })
      }

      // 3. Carrega clientes do usuário isolado
      let clientesUsuario = []
      try {
        const records = $app.findRecordsByFilter(
          'clientes',
          "user_id = '" + userId + "'",
          '-created',
          100,
          0,
        )
        for (let i = 0; i < records.length; i++) {
          const rec = records[i]
          clientesUsuario.push({
            id: rec.id,
            nome: rec.getString('nome') || '',
            email: rec.getString('email') || '',
            telefone: rec.getString('telefone') || '',
            empresa: rec.getString('empresa') || '',
            endereco: rec.getString('endereco') || '',
          })
        }
      } catch (errDb) {}

      // Matching difuso de cliente
      let melhorClienteMatch = null
      let scoreMatch = 0
      for (let i = 0; i < clientesUsuario.length; i++) {
        const c = clientesUsuario[i]
        const nomeNorm = normalizeText(c.nome)
        const empresaNorm = normalizeText(c.empresa)
        const telDigits = (c.telefone || '').replace(/\D/g, '')

        let score = 0
        if (nomeNorm && transNorm.indexOf(nomeNorm) !== -1) {
          score += 10
        } else if (nomeNorm) {
          const partesNome = nomeNorm.split(' ')
          for (let p = 0; p < partesNome.length; p++) {
            const parte = partesNome[p]
            if (parte.length > 2 && transNorm.indexOf(parte) !== -1) {
              score += 3
            }
          }
        }
        if (empresaNorm && transNorm.indexOf(empresaNorm) !== -1) {
          score += 8
        }
        if (telDigits.length >= 8) {
          const transDigits = transcricao.replace(/\D/g, '')
          if (transDigits.indexOf(telDigits.slice(-8)) !== -1) {
            score += 15
          }
        }
        if (score > scoreMatch) {
          scoreMatch = score
          melhorClienteMatch = c
        }
      }

      // 4. Carrega orçamentos do usuário isolado
      let orcamentosUsuario = []
      try {
        const orcRecords = $app.findRecordsByFilter(
          'orcamentos',
          "user_id = '" + userId + "'",
          '-created',
          60,
          0,
        )
        for (let i = 0; i < orcRecords.length; i++) {
          const oRec = orcRecords[i]
          let cliNome = ''
          const cliId = oRec.getString('cliente_id')
          if (cliId) {
            for (let k = 0; k < clientesUsuario.length; k++) {
              if (clientesUsuario[k].id === cliId) {
                cliNome = clientesUsuario[k].nome
                break
              }
            }
          }
          orcamentosUsuario.push({
            id: oRec.id,
            numero: oRec.getString('numero') || '',
            descricao: oRec.getString('descricao') || '',
            status: oRec.getString('status') || '',
            valor_total: oRec.getFloat('valor_total') || 0,
            cliente_id: cliId,
            cliente_nome: cliNome,
            created: oRec.getString('created') || '',
          })
        }
      } catch (errOrc) {}

      // 5. Carrega cobranças existentes
      let cobrancasUsuario = []
      try {
        const cobRecords = $app.findRecordsByFilter(
          'cobrancas',
          "user_id = '" + userId + "'",
          '-created',
          50,
          0,
        )
        for (let i = 0; i < cobRecords.length; i++) {
          const cRec = cobRecords[i]
          cobrancasUsuario.push({
            id: cRec.id,
            orcamento_id: cRec.getString('orcamento_id'),
            orcamento_numero: cRec.getString('orcamento_numero'),
            cliente_nome: cRec.getString('cliente_nome'),
            valor: cRec.getFloat('valor') || 0,
            status: cRec.getString('status'),
            codigo_pix: cRec.getString('codigo_pix') || '',
          })
        }
      } catch (errCob) {}

      // 5.1 Carrega gastos do usuário
      let gastosUsuario = []
      try {
        const gastRecords = $app.findRecordsByFilter(
          'gastos',
          "user_id = '" + userId + "'",
          '-data',
          200,
          0,
        )
        for (let i = 0; i < gastRecords.length; i++) {
          const gRec = gastRecords[i]
          gastosUsuario.push({
            id: gRec.id,
            descricao: gRec.getString('descricao') || '',
            valor: gRec.getFloat('valor') || 0,
            categoria: gRec.getString('categoria') || 'Outros',
            contexto: gRec.getString('contexto') || 'empresa',
            data: gRec.getString('data') || '',
            origem: gRec.getString('origem') || 'manual',
            orcamento_vinculado: gRec.getString('orcamento_vinculado') || '',
          })
        }
      } catch (errGastosDb) {}

      // 5.1.1 Consulta de Lucro / Resultado do Mês
      const ehConsultaLucro =
        transNorm.indexOf('quanto lucrei') !== -1 ||
        transNorm.indexOf('quanto eu lucrei') !== -1 ||
        transNorm.indexOf('qual o meu lucro') !== -1 ||
        transNorm.indexOf('meu lucro') !== -1 ||
        transNorm.indexOf('lucro desse mes') !== -1 ||
        transNorm.indexOf('lucro deste mes') !== -1 ||
        transNorm.indexOf('resultado do mes') !== -1 ||
        transNorm.indexOf('resultado deste mes') !== -1 ||
        transNorm.indexOf('resultado desse mes') !== -1 ||
        (transNorm.indexOf('lucro') !== -1 &&
          (transNorm.indexOf('mes') !== -1 || transNorm.indexOf('quanto') !== -1))

      if (ehConsultaLucro) {
        const hojeObj = new Date()
        const mesAtualStr = hojeObj.toISOString().slice(0, 7)

        let receitaMes = 0
        for (let i = 0; i < cobrancasUsuario.length; i++) {
          const c = cobrancasUsuario[i]
          if (c.status === 'pago') {
            receitaMes += c.valor || 0
          }
        }
        if (receitaMes === 0) {
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (o.status === 'aprovado' && o.created && o.created.startsWith(mesAtualStr)) {
              receitaMes += o.valor_total || 0
            }
          }
        }

        const gastosMes = gastosUsuario.filter(function (g) {
          return g.data && g.data.startsWith(mesAtualStr)
        })
        let gastosEmpresaMes = 0
        let gastosPessoalMes = 0
        for (let i = 0; i < gastosMes.length; i++) {
          const g = gastosMes[i]
          if (g.contexto === 'pessoal') {
            gastosPessoalMes += g.valor
          } else {
            gastosEmpresaMes += g.valor
          }
        }

        const lucroApurado = receitaMes - gastosEmpresaMes
        const lucroFmt = lucroApurado.toFixed(2).replace('.', ',')
        const recFmt = receitaMes.toFixed(2).replace('.', ',')
        const gastEmpFmt = gastosEmpresaMes.toFixed(2).replace('.', ',')
        const trat = formatarTratamento()

        let textoRespLucro = ''
        if (lucroApurado >= 0) {
          if (prefTom === 'formal') {
            textoRespLucro =
              (trat ? trat + ', ' : '') +
              'o resultado operacional deste mês é positivo em R$ ' +
              lucroFmt +
              ' (receita de R$ ' +
              recFmt +
              ' menos R$ ' +
              gastEmpFmt +
              ' em despesas da empresa).'
          } else if (prefTom === 'direto') {
            textoRespLucro =
              'Lucro do mês: R$ ' +
              lucroFmt +
              ' (Receita R$ ' +
              recFmt +
              ' - Gastos Empresa R$ ' +
              gastEmpFmt +
              ').'
          } else {
            textoRespLucro =
              (prefEmojis ? '📈 ' : '') +
              (prefNome ? prefNome + ', ' : '') +
              'seu lucro neste mês está em R$ ' +
              lucroFmt +
              '! Receita de R$ ' +
              recFmt +
              ' menos R$ ' +
              gastEmpFmt +
              ' de gastos da empresa.'
          }
        } else {
          const defFmt = Math.abs(lucroApurado).toFixed(2).replace('.', ',')
          textoRespLucro =
            (prefEmojis ? '⚠️ ' : '') +
            (prefNome ? prefNome + ', ' : '') +
            'atenção ao fluxo: déficit de R$ ' +
            defFmt +
            ' este mês (Gastos R$ ' +
            gastEmpFmt +
            ' vs Receita R$ ' +
            recFmt +
            ').'
        }

        return e.json(200, {
          sucesso: true,
          audio_id: null,
          transcricao_original: transcricao,
          interpretacao: {
            intencao_detectada: 'resultado_mes',
            comando_resultado_mes: {
              lucro: lucroApurado,
              receita: receitaMes,
              gastos_empresa: gastosEmpresaMes,
              gastos_pessoal: gastosPessoalMes,
              mensagem_resposta: textoRespLucro,
            },
            transcricao_corrigida: transcricao.trim(),
            descricao_servico: 'Consulta do Resultado do Mês (Lucro)',
            itens: [],
            confianca: 'alta',
            duvidas: [],
          },
          citations: [],
        })
      }

      // 5.1.2 Consulta Resumo do Dia
      const ehConsultaResumoDia =
        transNorm.indexOf('resumo do dia') !== -1 ||
        transNorm.indexOf('resumo da manha') !== -1 ||
        transNorm.indexOf('resumo de hoje') !== -1 ||
        transNorm.indexOf('como esta meu dia') !== -1 ||
        transNorm.indexOf('como ta meu dia') !== -1 ||
        transNorm.indexOf('o que tenho pra hoje') !== -1 ||
        transNorm.indexOf('minhas tarefas de hoje') !== -1

      if (ehConsultaResumoDia) {
        let qtdAguardando = 0
        let valorAguardando = 0
        let qtdAprovados = 0
        let totalAReceber = 0

        for (let i = 0; i < orcamentosUsuario.length; i++) {
          const o = orcamentosUsuario[i]
          if (o.status === 'enviado' || o.status === 'rascunho') {
            qtdAguardando++
            valorAguardando += o.valor_total || 0
          } else if (o.status === 'aprovado') {
            qtdAprovados++
            totalAReceber += o.valor_total || 0
          }
        }

        const horaAtual = new Date().getHours()
        let saudacaoDia = 'Bom dia'
        if (horaAtual >= 12 && horaAtual < 18) saudacaoDia = 'Boa tarde'
        else if (horaAtual >= 18 || horaAtual < 5) saudacaoDia = 'Boa noite'

        const vAguardFmt = valorAguardando.toFixed(2).replace('.', ',')
        const vRecFmt = totalAReceber.toFixed(2).replace('.', ',')

        const textoRespResumo =
          saudacaoDia +
          (prefNome ? ', ' + prefNome : '') +
          '! ' +
          (qtdAguardando > 0
            ? 'Você tem ' +
              qtdAguardando +
              ' proposta(s) aguardando aprovação (R$ ' +
              vAguardFmt +
              ')'
            : 'Nenhuma proposta aguardando resposta') +
          (totalAReceber > 0
            ? ' e R$ ' + vRecFmt + ' a receber em orçamentos aprovados.'
            : ' e nenhum pagamento pendente.')

        return e.json(200, {
          sucesso: true,
          audio_id: null,
          transcricao_original: transcricao,
          interpretacao: {
            intencao_detectada: 'resumo_dia',
            comando_resumo_dia: {
              qtd_aguardando: qtdAguardando,
              valor_aguardando: valorAguardando,
              qtd_aprovados: qtdAprovados,
              total_a_receber: totalAReceber,
              mensagem_resposta: textoRespResumo,
            },
            transcricao_corrigida: transcricao.trim(),
            descricao_servico: 'Resumo do dia e operações',
            itens: [],
            confianca: 'alta',
            duvidas: [],
          },
          citations: [],
        })
      }

      // 5.2 Consulta de Gastos
      const ehConsultaGastos =
        transNorm.indexOf('quanto gastei') !== -1 ||
        transNorm.indexOf('quanto eu gastei') !== -1 ||
        transNorm.indexOf('total de gastos') !== -1 ||
        transNorm.indexOf('meus gastos esse mes') !== -1 ||
        transNorm.indexOf('meus gastos este mes') !== -1 ||
        transNorm.indexOf('resumo de gastos') !== -1 ||
        (transNorm.indexOf('quanto') !== -1 && transNorm.indexOf('gastei') !== -1)

      if (ehConsultaGastos) {
        const querEmpresa =
          transNorm.indexOf('na empresa') !== -1 ||
          transNorm.indexOf('da empresa') !== -1 ||
          transNorm.indexOf('pela empresa') !== -1 ||
          transNorm.indexOf('do trabalho') !== -1 ||
          transNorm.indexOf('no cnpj') !== -1
        const querPessoal =
          transNorm.indexOf('no pessoal') !== -1 ||
          transNorm.indexOf('do pessoal') !== -1 ||
          transNorm.indexOf('pessoal mesmo') !== -1 ||
          transNorm.indexOf('para mim') !== -1 ||
          transNorm.indexOf('pra mim') !== -1 ||
          transNorm.indexOf('em casa') !== -1 ||
          transNorm.indexOf('no cpf') !== -1

        let contextoPedido = 'ambos'
        if (querEmpresa && !querPessoal) contextoPedido = 'empresa'
        else if (querPessoal && !querEmpresa) contextoPedido = 'pessoal'

        const hojeObj = new Date()
        const mesAtualStr = hojeObj.toISOString().slice(0, 7)
        const gastosMes = gastosUsuario.filter(function (g) {
          return g.data && g.data.startsWith(mesAtualStr)
        })

        let totalEmpresa = 0
        let qtdEmpresa = 0
        let totalPessoal = 0
        let qtdPessoal = 0

        for (let i = 0; i < gastosMes.length; i++) {
          const g = gastosMes[i]
          if (g.contexto === 'pessoal') {
            totalPessoal += g.valor
            qtdPessoal++
          } else {
            totalEmpresa += g.valor
            qtdEmpresa++
          }
        }

        const totalGeral = totalEmpresa + totalPessoal
        const fmtEmpresa = totalEmpresa.toFixed(2).replace('.', ',')
        const fmtPessoal = totalPessoal.toFixed(2).replace('.', ',')
        const fmtGeral = totalGeral.toFixed(2).replace('.', ',')

        let textoResposta = ''
        if (contextoPedido === 'empresa') {
          textoResposta =
            (prefEmojis ? '🏢 ' : '') +
            (prefNome ? prefNome + ', ' : '') +
            'você gastou R$ ' +
            fmtEmpresa +
            ' na empresa este mês (' +
            qtdEmpresa +
            ' lançamentos).'
        } else if (contextoPedido === 'pessoal') {
          textoResposta =
            (prefEmojis ? '🏠 ' : '') +
            (prefNome ? prefNome + ', ' : '') +
            'você gastou R$ ' +
            fmtPessoal +
            ' no pessoal este mês (' +
            qtdPessoal +
            ' lançamentos).'
        } else {
          textoResposta =
            (prefEmojis ? '📊 ' : '') +
            (prefNome ? prefNome + ', ' : '') +
            'este mês você gastou R$ ' +
            fmtEmpresa +
            ' na empresa (🏢) e R$ ' +
            fmtPessoal +
            ' no pessoal (🏠), totalizando R$ ' +
            fmtGeral +
            '.'
        }

        return e.json(200, {
          sucesso: true,
          audio_id: null,
          transcricao_original: transcricao,
          interpretacao: {
            intencao_detectada: 'consulta_gastos',
            comando_consulta_gastos: {
              contexto_pedido: contextoPedido,
              total_mes:
                contextoPedido === 'empresa'
                  ? totalEmpresa
                  : contextoPedido === 'pessoal'
                    ? totalPessoal
                    : totalGeral,
              total_empresa: totalEmpresa,
              total_pessoal: totalPessoal,
              total_geral: totalGeral,
              qtd_gastos: gastosMes.length,
              qtd_empresa: qtdEmpresa,
              qtd_pessoal: qtdPessoal,
              mensagem_resposta: textoResposta,
            },
            transcricao_corrigida: transcricao.trim(),
            descricao_servico: 'Consulta de gastos do mês (' + contextoPedido + ')',
            itens: [],
            confianca: 'alta',
            duvidas: [],
          },
          citations: [],
        })
      }

      // 5.3 Registro de Gasto por Voz
      const temPalavrasGasto =
        contexto === 'gasto' ||
        transNorm.indexOf('gastei') !== -1 ||
        transNorm.indexOf('gasto de') !== -1 ||
        transNorm.indexOf('paguei') !== -1 ||
        transNorm.indexOf('comprei') !== -1 ||
        transNorm.indexOf('despesa') !== -1 ||
        transNorm.indexOf('custo de') !== -1 ||
        transNorm.indexOf('abasteci') !== -1 ||
        transNorm.indexOf('almoco') !== -1 ||
        transNorm.indexOf('gasolina') !== -1

      if (contexto === 'gasto' || temPalavrasGasto) {
        let orcVinculadoId = null
        let orcVinculadoNum = null
        const orcMatchGasto =
          transcricao.match(/(?:orçamento|orcamento|obra|proposta)\s*#?(\d+)/i) ||
          transcricao.match(/#(\d+)/)
        if (orcMatchGasto) {
          const numP = orcMatchGasto[1]
          const numFmt1 = '#' + numP.padStart(3, '0')
          const numFmt2 = '#' + numP
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (
              o.numero === numFmt1 ||
              o.numero === numFmt2 ||
              o.numero.replace(/\D/g, '') === numP
            ) {
              orcVinculadoId = o.id
              orcVinculadoNum = o.numero
              break
            }
          }
        }

        let contextoDetectado = null
        const falaEmpresa =
          transNorm.indexOf('na empresa') !== -1 ||
          transNorm.indexOf('da empresa') !== -1 ||
          transNorm.indexOf('pela empresa') !== -1 ||
          transNorm.indexOf('do trabalho') !== -1 ||
          transNorm.indexOf('no cnpj') !== -1
        const falaPessoal =
          transNorm.indexOf('no pessoal') !== -1 ||
          transNorm.indexOf('do pessoal') !== -1 ||
          transNorm.indexOf('pessoal mesmo') !== -1 ||
          transNorm.indexOf('para mim') !== -1 ||
          transNorm.indexOf('pra mim') !== -1 ||
          transNorm.indexOf('no cpf') !== -1

        if (falaPessoal && !falaEmpresa) contextoDetectado = 'pessoal'
        else if (falaEmpresa && !falaPessoal) contextoDetectado = 'empresa'

        const promptGasto =
          'Você é o assistente inteligente do OrçaFácil especializado em finanças.\n' +
          'Texto falado do gasto: """' +
          transcricao.trim() +
          '"""\n' +
          'Data referência: ' +
          new Date().toISOString().slice(0, 10) +
          '\n' +
          'Contexto padrão: "' +
          (prefContextoGastoPadrao || 'empresa') +
          '"\n' +
          'Categorias: Material, Transporte, Alimentação, Moradia/Aluguel, Ferramentas, Serviços terceirizados, Impostos/Taxas, Outros.\n' +
          'Retorne APENAS JSON válido:\n' +
          '{\n' +
          '  "valor": number | null,\n' +
          '  "descricao": string,\n' +
          '  "categoria": "Material" | "Transporte" | "Alimentação" | "Moradia/Aluguel" | "Ferramentas" | "Serviços terceirizados" | "Impostos/Taxas" | "Outros",\n' +
          '  "contexto": "empresa" | "pessoal",\n' +
          '  "data": "YYYY-MM-DD",\n' +
          '  "precisa_confirmacao": boolean,\n' +
          '  "mensagem_resposta": string,\n' +
          '  "duvidas": string[]\n' +
          '}'

        let llmGastoResp = null
        try {
          llmGastoResp = $ai.agent('orcamento-assistente').chat({
            user_id: userId,
            message: promptGasto,
          })
        } catch (eG1) {
          try {
            const cRes = $ai.chat({
              model: 'fast',
              messages: [{ role: 'user', content: promptGasto }],
            })
            llmGastoResp = { content: cRes?.choices?.[0]?.message?.content }
          } catch (_) {}
        }

        let parsedGasto = null
        if (llmGastoResp?.content) {
          try {
            const m = llmGastoResp.content.match(/\{[\s\S]*\}/)
            if (m) parsedGasto = JSON.parse(m[0])
          } catch (_) {}
        }

        if (!parsedGasto || parsedGasto.valor === undefined) {
          let valEncontrado = null
          const valMatch =
            transcricao.match(
              /(?:r\$\s*|reais\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais|conto|pila)?/i,
            ) || transcricao.match(/(\d+(?:[.,]\d{1,2})?)/)
          if (valMatch) {
            valEncontrado = parseFloat(valMatch[1].replace(',', '.'))
          }
          let catHeuristica = 'Outros'
          if (transNorm.indexOf('gasolina') !== -1 || transNorm.indexOf('abastecer') !== -1) {
            catHeuristica = 'Transporte'
          } else if (transNorm.indexOf('almoco') !== -1 || transNorm.indexOf('lanche') !== -1) {
            catHeuristica = 'Alimentação'
          } else if (transNorm.indexOf('material') !== -1 || transNorm.indexOf('fio') !== -1) {
            catHeuristica = 'Material'
          }

          const fallbackCtx = contextoDetectado || prefContextoGastoPadrao || 'empresa'
          parsedGasto = {
            valor: valEncontrado,
            descricao: transcricao.trim(),
            categoria: catHeuristica,
            contexto: fallbackCtx,
            data: new Date().toISOString().slice(0, 10),
            precisa_confirmacao: valEncontrado === null,
            mensagem_resposta: valEncontrado
              ? 'Identifiquei o gasto de R$ ' +
                valEncontrado.toFixed(2).replace('.', ',') +
                ' em ' +
                catHeuristica +
                '.'
              : 'Não consegui identificar o valor do gasto. Pode repetir dizendo o valor?',
            duvidas: valEncontrado === null ? ['Qual foi o valor exato gasto?'] : [],
          }
        }

        const valorFinal =
          typeof parsedGasto.valor === 'number' && !isNaN(parsedGasto.valor)
            ? parsedGasto.valor
            : null
        const catFinal = parsedGasto.categoria || 'Outros'
        const ctxFinal =
          contextoDetectado || parsedGasto.contexto || prefContextoGastoPadrao || 'empresa'
        const dataFinal = parsedGasto.data || new Date().toISOString().slice(0, 10)
        const precisaConfirmacao = valorFinal === null || valorFinal <= 0

        let audioRecordIdGasto = null
        try {
          const audiosCol = $app.findCollectionByNameOrId('audios')
          const audioRec = new Record(audiosCol)
          audioRec.set('user_id', userId)
          audioRec.set('transcricao_bruta', transcricao.trim())
          audioRec.set('transcricao_corrigida', transcricao.trim())
          audioRec.set('contexto', 'gasto')
          audioRec.set('resultado_json', {
            intencao_detectada: 'registro_gasto',
            gasto_extraido: {
              descricao: parsedGasto.descricao || transcricao.trim(),
              valor: valorFinal,
              categoria: catFinal,
              contexto: ctxFinal,
              data: dataFinal,
              orcamento_vinculado_id: orcVinculadoId,
              orcamento_vinculado_numero: orcVinculadoNum,
            },
          })
          audioRec.set('confianca', precisaConfirmacao ? 'media' : 'alta')
          audioRec.set('comando_executado', false)
          $app.save(audioRec)
          audioRecordIdGasto = audioRec.id
        } catch (_) {}

        return e.json(200, {
          sucesso: true,
          audio_id: audioRecordIdGasto,
          transcricao_original: transcricao,
          interpretacao: {
            intencao_detectada: 'registro_gasto',
            gasto_extraido: {
              descricao: parsedGasto.descricao || transcricao.trim(),
              valor: valorFinal,
              categoria: catFinal,
              contexto: ctxFinal,
              data: dataFinal,
              origem: 'voz',
              orcamento_vinculado_id: orcVinculadoId,
              orcamento_vinculado_numero: orcVinculadoNum,
              precisa_confirmacao: precisaConfirmacao,
              mensagem_resposta:
                parsedGasto.mensagem_resposta ||
                `Gasto de R$ ${valorFinal ? valorFinal.toFixed(2).replace('.', ',') : '0,00'} em ${catFinal}.`,
            },
            transcricao_corrigida: transcricao.trim(),
            descricao_servico:
              'Registro de gasto (' +
              ctxFinal +
              '): ' +
              (parsedGasto.descricao || transcricao.trim()),
            itens: [],
            confianca: precisaConfirmacao ? 'media' : 'alta',
            duvidas: parsedGasto.duvidas || [],
          },
          citations: llmGastoResp?.citations || [],
        })
      }

      // 6. Consulta de Contas a Receber
      const ehConsultaDevedores =
        transNorm.indexOf('quem esta me devendo') !== -1 ||
        transNorm.indexOf('quem tá me devendo') !== -1 ||
        transNorm.indexOf('quem me deve') !== -1 ||
        transNorm.indexOf('contas a receber') !== -1 ||
        transNorm.indexOf('valores a receber') !== -1 ||
        transNorm.indexOf('quanto tenho pra receber') !== -1

      if (ehConsultaDevedores) {
        const aprovadosNaoPagos = []
        let totalDevido = 0
        for (let i = 0; i < orcamentosUsuario.length; i++) {
          const o = orcamentosUsuario[i]
          if (o.status === 'aprovado') {
            let jaPago = false
            for (let c = 0; c < cobrancasUsuario.length; c++) {
              if (
                cobrancasUsuario[c].orcamento_id === o.id &&
                cobrancasUsuario[c].status === 'pago'
              ) {
                jaPago = true
                break
              }
            }
            if (!jaPago) {
              aprovadosNaoPagos.push(o)
              totalDevido += o.valor_total
            }
          }
        }

        const textoResposta =
          aprovadosNaoPagos.length === 0
            ? 'Boa notícia! Não há nenhum valor pendente a receber no momento.'
            : `Você tem um total de R$ ${totalDevido.toFixed(2).replace('.', ',')} a receber em ${aprovadosNaoPagos.length} orçamento(s).`

        return e.json(200, {
          sucesso: true,
          audio_id: null,
          transcricao_original: transcricao,
          interpretacao: {
            intencao_detectada: 'consulta_devedores',
            comando_consulta_devedores: {
              total_devido: totalDevido,
              qtd_orcamentos_pendentes: aprovadosNaoPagos.length,
              mensagem_resposta: textoResposta,
            },
            transcricao_corrigida: transcricao.trim(),
            descricao_servico: 'Consulta de contas a receber',
            itens: [],
            confianca: 'alta',
            duvidas: [],
          },
          citations: [],
        })
      }

      // 7. Comando de Baixa de Pagamento
      const ehComandoBaixa =
        transNorm.indexOf('pagou') !== -1 ||
        transNorm.indexOf('pago') !== -1 ||
        transNorm.indexOf('dar baixa') !== -1 ||
        transNorm.indexOf('da baixa') !== -1 ||
        transNorm.indexOf('marcar como pago') !== -1

      if (ehComandoBaixa) {
        const numMatch =
          transcricao.match(/(?:orçamento|proposta|numero|n[ºo#])\s*#?(\d+)/i) ||
          transcricao.match(/#?(\d+)/)
        const numeroProcurado = numMatch ? numMatch[1] : null
        let orcAlvo = null
        if (numeroProcurado) {
          const n1 = '#' + numeroProcurado.padStart(3, '0')
          const n2 = '#' + numeroProcurado
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (
              o.numero === n1 ||
              o.numero === n2 ||
              o.numero.replace(/\D/g, '') === numeroProcurado
            ) {
              orcAlvo = o
              break
            }
          }
        }
        if (!orcAlvo && melhorClienteMatch) {
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            if (orcamentosUsuario[i].cliente_id === melhorClienteMatch.id) {
              orcAlvo = orcamentosUsuario[i]
              break
            }
          }
        }

        if (orcAlvo) {
          let cobAlvoId = null
          for (let c = 0; c < cobrancasUsuario.length; c++) {
            if (cobrancasUsuario[c].orcamento_id === orcAlvo.id) {
              cobAlvoId = cobrancasUsuario[c].id
              break
            }
          }
          const msgConf = `Confirmar baixa de pagamento do orçamento ${orcAlvo.numero} (R$ ${orcAlvo.valor_total.toFixed(2).replace('.', ',')})?`
          return e.json(200, {
            sucesso: true,
            audio_id: null,
            transcricao_original: transcricao,
            interpretacao: {
              intencao_detectada: 'baixa_pagamento',
              comando_baixa: {
                orcamento_id: orcAlvo.id,
                orcamento_numero: orcAlvo.numero,
                cliente_nome: orcAlvo.cliente_nome || '',
                cobranca_id: cobAlvoId,
                valor: orcAlvo.valor_total,
                mensagem_confirmacao: msgConf,
              },
              transcricao_corrigida: transcricao.trim(),
              descricao_servico: 'Registrar baixa do orçamento ' + orcAlvo.numero,
              itens: [],
              confianca: 'alta',
              duvidas: [],
            },
            citations: [],
          })
        }
      }

      // 8. Comando de Gerar Cobrança PIX
      const ehComandoGerarCobranca =
        transNorm.indexOf('gerar cobranca') !== -1 ||
        transNorm.indexOf('gera a cobranca') !== -1 ||
        transNorm.indexOf('criar cobranca') !== -1 ||
        transNorm.indexOf('gerar pix') !== -1 ||
        transNorm.indexOf('gera o pix') !== -1

      if (ehComandoGerarCobranca) {
        const numMatch =
          transcricao.match(/(?:orçamento|proposta|numero|n[ºo#])\s*#?(\d+)/i) ||
          transcricao.match(/#?(\d+)/)
        const numeroProcurado = numMatch ? numMatch[1] : null
        let orcAlvo = null
        if (numeroProcurado) {
          const n1 = '#' + numeroProcurado.padStart(3, '0')
          const n2 = '#' + numeroProcurado
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (
              o.numero === n1 ||
              o.numero === n2 ||
              o.numero.replace(/\D/g, '') === numeroProcurado
            ) {
              orcAlvo = o
              break
            }
          }
        }
        if (!orcAlvo && melhorClienteMatch) {
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            if (orcamentosUsuario[i].cliente_id === melhorClienteMatch.id) {
              orcAlvo = orcamentosUsuario[i]
              break
            }
          }
        }
        if (orcAlvo) {
          const msgConf = `Gerar chave PIX para o orçamento ${orcAlvo.numero} no valor de R$ ${orcAlvo.valor_total.toFixed(2).replace('.', ',')}?`
          return e.json(200, {
            sucesso: true,
            audio_id: null,
            transcricao_original: transcricao,
            interpretacao: {
              intencao_detectada: 'gerar_cobranca',
              comando_gerar_cobranca: {
                orcamento_id: orcAlvo.id,
                orcamento_numero: orcAlvo.numero,
                cliente_id: orcAlvo.cliente_id,
                cliente_nome: orcAlvo.cliente_nome || '',
                valor: orcAlvo.valor_total,
                mensagem_confirmacao: msgConf,
              },
              transcricao_corrigida: transcricao.trim(),
              descricao_servico: 'Gerar cobrança PIX para o orçamento ' + orcAlvo.numero,
              itens: [],
              confianca: 'alta',
              duvidas: [],
            },
            citations: [],
          })
        }
      }

      // 9. Prompt estruturado universal para IA com clientes e orçamentos do usuário
      const listaClientesResumo = clientesUsuario
        .slice(0, 40)
        .map(function (c) {
          return (
            '- ID: "' +
            c.id +
            '", Nome: "' +
            c.nome +
            '", Tel: "' +
            c.telefone +
            '", Empresa: "' +
            c.empresa +
            '"'
          )
        })
        .join('\n')

      const listaOrcamentosResumo = orcamentosUsuario
        .slice(0, 25)
        .map(function (o) {
          return (
            '- ID: "' +
            o.id +
            '", Número: "' +
            o.numero +
            '", Cliente: "' +
            o.cliente_nome +
            '", Status: "' +
            o.status +
            '", Total: R$ ' +
            o.valor_total
          )
        })
        .join('\n')

      const promptInstrucoes =
        'Você é o interpretador de áudio e voz em pt-BR do OrçaFácil.\n' +
        'O usuário ' +
        (prefNome ? 'chama-se "' + prefNome + '"' : '') +
        ' e prefere tom ' +
        prefTom +
        '.\n\n' +
        'Texto transcrito:\n"""\n' +
        transcricao.slice(0, 2500) +
        '\n"""\n\n' +
        'Clientes cadastrados:\n' +
        (listaClientesResumo || '(Nenhum)') +
        '\n\nOrçamentos recentes:\n' +
        (listaOrcamentosResumo || '(Nenhum)') +
        '\n\nREGRAS CRÍTICAS:\n' +
        '1. Classifique "intencao_detectada": "orcamento", "cliente" ou "comando_status".\n' +
        '2. Para "cliente", extraia cliente_novo (nome, telefone, email, empresa, endereco). NUNCA invente e-mail se não foi dito expressamente (use null).\n' +
        '3. Para "orcamento", extraia descricao_servico, itens (descricao, quantidade, valor_unitario), cliente_sugerido_id ou cliente_novo.\n' +
        '4. Para "comando_status", extraia orcamento_id, orcamento_numero, novo_status e mensagem_confirmacao.\n\n' +
        'Retorne ESTRITAMENTE JSON sem markdown:\n' +
        '{\n' +
        '  "intencao_detectada": "orcamento" | "cliente" | "comando_status",\n' +
        '  "transcricao_corrigida": "...",\n' +
        '  "descricao_servico": "...",\n' +
        '  "cliente_sugerido_id": "id ou null",\n' +
        '  "cliente_sugerido_nome": "nome ou null",\n' +
        '  "cliente_novo": null,\n' +
        '  "itens": [{ "descricao": "...", "quantidade": 1, "valor_unitario": 100 }],\n' +
        '  "comando_status": null,\n' +
        '  "confianca": "alta" | "media" | "baixa",\n' +
        '  "duvidas": []\n' +
        '}'

      let agentResponse = null
      try {
        agentResponse = $ai.agent('orcamento-assistente').chat({
          user_id: userId,
          message: promptInstrucoes,
        })
      } catch (errAgente) {
        console.log('[ia_interpretar] Fallback do agente para fast chat:', errAgente.message)
        try {
          const directChat = $ai.chat({
            model: 'fast',
            messages: [
              {
                role: 'system',
                content: 'Você é o interpretador universal de voz e texto do OrçaFácil.',
              },
              { role: 'user', content: promptInstrucoes },
            ],
          })
          agentResponse = { content: directChat?.choices?.[0]?.message?.content }
        } catch (errDirect) {
          console.log('[ia_interpretar] Falha no fallback direto:', errDirect.message)
        }
      }

      const content = agentResponse?.content || ''
      let parsed = null
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
      } catch (_) {
        parsed = null
      }

      // Heurística de status caso a IA falhe
      let comandoStatusHeuristico = null
      if (
        transNorm.indexOf('marcar') !== -1 ||
        transNorm.indexOf('mudar') !== -1 ||
        transNorm.indexOf('alterar') !== -1 ||
        transNorm.indexOf('aprovar') !== -1 ||
        transNorm.indexOf('rejeitar') !== -1
      ) {
        let novoStatus = null
        if (transNorm.indexOf('aprovad') !== -1 || transNorm.indexOf('aprovar') !== -1)
          novoStatus = 'aprovado'
        else if (transNorm.indexOf('rejeitad') !== -1 || transNorm.indexOf('rejeitar') !== -1)
          novoStatus = 'rejeitado'
        else if (transNorm.indexOf('enviad') !== -1 || transNorm.indexOf('enviar') !== -1)
          novoStatus = 'enviado'

        if (novoStatus) {
          const numMatch =
            transcricao.match(/(?:orçamento|proposta|numero|n[ºo#])\s*#?(\d+)/i) ||
            transcricao.match(/#?(\d+)/)
          const numP = numMatch ? numMatch[1] : null
          let oMatch = null
          if (numP) {
            for (let i = 0; i < orcamentosUsuario.length; i++) {
              if (orcamentosUsuario[i].numero.replace(/\D/g, '') === numP) {
                oMatch = orcamentosUsuario[i]
                break
              }
            }
          }
          if (oMatch) {
            comandoStatusHeuristico = {
              orcamento_id: oMatch.id,
              orcamento_numero: oMatch.numero,
              cliente_nome: oMatch.cliente_nome || '',
              status_anterior: oMatch.status,
              novo_status: novoStatus,
              mensagem_confirmacao: `Confirmar alteração do orçamento ${oMatch.numero} para "${novoStatus}"?`,
            }
          }
        }
      }

      const ehCadastroClienteHeuristico =
        transNorm.indexOf('cadastrar cliente') !== -1 ||
        transNorm.indexOf('novo cliente') !== -1 ||
        transNorm.indexOf('adicionar cliente') !== -1 ||
        contexto === 'cliente'

      if (!parsed) {
        parsed = {
          intencao_detectada: comandoStatusHeuristico
            ? 'comando_status'
            : ehCadastroClienteHeuristico
              ? 'cliente'
              : 'orcamento',
          transcricao_corrigida: transcricao.trim(),
          descricao_servico: transcricao.trim(),
          cliente_sugerido_id: melhorClienteMatch ? melhorClienteMatch.id : null,
          cliente_sugerido_nome: melhorClienteMatch ? melhorClienteMatch.nome : null,
          cliente_novo: null,
          itens: [
            {
              descricao: 'Serviço descrito: ' + transcricao.slice(0, 50),
              quantidade: 1,
              valor_unitario: 250.0,
            },
          ],
          comando_status: comandoStatusHeuristico,
          confianca: 'media',
          duvidas: [],
        }
      }

      if (ehCadastroClienteHeuristico && !parsed.comando_status) {
        parsed.intencao_detectada = 'cliente'
        if (!parsed.cliente_novo) {
          parsed.cliente_novo = {
            nome: 'Novo Cliente',
            telefone: '',
            email: null,
            empresa: '',
            endereco: '',
          }
        }
      }

      if (comandoStatusHeuristico && !parsed.comando_status) {
        parsed.comando_status = comandoStatusHeuristico
        parsed.intencao_detectada = 'comando_status'
      }

      // Higienização de e-mail de cliente novo: nunca inventar e-mail se não foi fornecido
      if (parsed.cliente_novo && typeof parsed.cliente_novo === 'object') {
        const rawEmail = parsed.cliente_novo.email ? String(parsed.cliente_novo.email).trim() : ''
        if (!rawEmail || rawEmail.endsWith('@cliente.com') || rawEmail.indexOf('@') === -1) {
          parsed.cliente_novo.email = null
        }
      }

      // Higienização e garantia dos itens
      const rawItens = Array.isArray(parsed.itens) ? parsed.itens : []
      const itensLimpos = rawItens.map(function (it) {
        return {
          descricao: String(it.descricao || 'Item de serviço').trim(),
          quantidade: Math.max(1, Number(it.quantidade) || 1),
          valor_unitario: Math.max(0, Number(it.valor_unitario) || 0),
        }
      })

      if (itensLimpos.length === 0 && parsed.intencao_detectada === 'orcamento') {
        itensLimpos.push({
          descricao: parsed.descricao_servico || 'Serviço solicitado: ' + transcricao.slice(0, 50),
          quantidade: 1,
          valor_unitario: 300.0,
        })
      }
      parsed.itens = itensLimpos

      // Salva histórico na coleção audios
      let audioRecordId = null
      try {
        const audiosCol = $app.findCollectionByNameOrId('audios')
        const audioRec = new Record(audiosCol)
        audioRec.set('user_id', userId)
        audioRec.set('transcricao_bruta', transcricao.trim())
        audioRec.set('transcricao_corrigida', parsed.transcricao_corrigida || transcricao.trim())
        audioRec.set('contexto', contexto)
        audioRec.set('resultado_json', parsed)
        audioRec.set('confianca', parsed.confianca || 'media')
        audioRec.set('comando_executado', false)
        $app.save(audioRec)
        audioRecordId = audioRec.id
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        audio_id: audioRecordId,
        transcricao_original: transcricao,
        interpretacao: parsed,
        citations: agentResponse?.citations || [],
      })
    } catch (err) {
      console.error('[ia_interpretar] Erro no processamento de IA:', err.message || err)
      return e.json(500, {
        sucesso: false,
        error:
          'Não foi possível concluir o processamento da IA neste momento. Por favor, tente novamente.',
      })
    }
  },
  $apis.requireAuth(),
)
