// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/interpretar',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const userId = e.auth?.id || body.userId
      if (!userId) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const transcricao = body.transcricao || body.texto || ''
      if (!transcricao || typeof transcricao !== 'string' || !transcricao.trim()) {
        return e.json(400, { error: 'A transcrição de áudio ou texto é obrigatória' })
      }

      let contexto = body.contexto || 'geral'

      // Função inline de normalização para matching difuso
      const normalizeText = function (str) {
        if (!str) return ''
        return str
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }

      const transNorm = normalizeText(transcricao)

      // 0. Carrega preferências da IA do usuário (se configuradas)
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
        // Tenta pegar nome do usuário como fallback
        try {
          const uRec = $app.findCollectionByNameOrId('_pb_users_auth_')
          const u = $app.findRecordById('_pb_users_auth_', userId)
          if (u) {
            prefNome = (u.getString('name') || '').split(' ')[0]
          }
        } catch (_) {}
      }

      // Se veio no body preferências personalizadas explícitas, tem precedência
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

      // Função auxiliar para montar saudação ou tratamento de acordo com o tom
      const formatarTratamento = function () {
        const nomeAlvo = prefNome ? prefNome : 'você'
        if (prefTom === 'formal') {
          return prefNome ? 'Sr(a). ' + prefNome : 'Prezado(a)'
        }
        if (prefTom === 'direto') {
          return prefNome ? prefNome : ''
        }
        // amigavel
        return prefNome ? prefNome : 'amigo'
      }

      // 1. Verificação de comando de Desfazer ("desfaz aquilo", "desfaz o último", "desfazer")
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

      // 2. Verificação de comando para Personalizar IA (Melhoria 5)
      // Ex: "me chama de Zé", "me chame de João", "meu nome é Carlos", "fala comigo de forma informal",
      // "tom direto", "fala de forma formal", "para de usar emoji", "sem emoji", "pode usar emoji", "use emojis"
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
        transNorm.indexOf('descontraido') !== -1 ||
        transNorm.indexOf('amigavel') !== -1
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
        // Capitaliza o nome
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

      // 3. Carrega clientes do usuário para matching difuso
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

      // Matching difuso de cliente existente
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

      // 4. Carrega orçamentos do usuário
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

      // 5. Carrega cobranças existentes para verificar baixas e pagamentos
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

      // 5.1 Carrega gastos recentes do usuário para consultas de gastos
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
            data: gRec.getString('data') || '',
            origem: gRec.getString('origem') || 'manual',
            orcamento_vinculado: gRec.getString('orcamento_vinculado') || '',
          })
        }
      } catch (errGastosDb) {}

      // 5.2 Verificação de comando: "quanto gastei esse mês?" / consulta de gastos
      const ehConsultaGastos =
        transNorm.indexOf('quanto gastei') !== -1 ||
        transNorm.indexOf('quanto eu gastei') !== -1 ||
        transNorm.indexOf('total de gastos') !== -1 ||
        transNorm.indexOf('meus gastos esse mes') !== -1 ||
        transNorm.indexOf('meus gastos este mes') !== -1 ||
        transNorm.indexOf('resumo de gastos') !== -1 ||
        (transNorm.indexOf('quanto') !== -1 && transNorm.indexOf('gastei') !== -1)

      if (ehConsultaGastos) {
        const hojeObj = new Date()
        const mesAtualStr = hojeObj.toISOString().slice(0, 7) // 'YYYY-MM'
        const gastosMes = gastosUsuario.filter(function (g) {
          return g.data && g.data.startsWith(mesAtualStr)
        })

        let totalGastoMes = 0
        const porCategoria = {}
        for (let i = 0; i < gastosMes.length; i++) {
          const g = gastosMes[i]
          totalGastoMes += g.valor
          porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.valor
        }

        // Encontra a maior categoria
        let maiorCategoria = null
        let maiorValorCat = 0
        for (const cat in porCategoria) {
          if (porCategoria[cat] > maiorValorCat) {
            maiorValorCat = porCategoria[cat]
            maiorCategoria = cat
          }
        }

        const trat = formatarTratamento()
        const emojiGasto = prefEmojis ? '📊 ' : ''
        let textoResposta = ''

        if (gastosMes.length === 0) {
          if (prefTom === 'formal') {
            textoResposta =
              (trat ? trat + ', ' : '') +
              'nenhum gasto foi registrado no mês corrente até o momento.'
          } else if (prefTom === 'direto') {
            textoResposta = 'Nenhum gasto registrado este mês. Total: R$ 0,00.'
          } else {
            textoResposta =
              (prefEmojis ? '💸 ' : '') +
              (prefNome ? prefNome + ', ' : '') +
              'você ainda não registrou nenhum gasto este mês!'
          }
        } else {
          const valorFormatado = totalGastoMes.toFixed(2).replace('.', ',')
          const detalheMaior = maiorCategoria
            ? ', sendo a maior categoria "' +
              maiorCategoria +
              '" com R$ ' +
              maiorValorCat.toFixed(2).replace('.', ',')
            : ''

          if (prefTom === 'formal') {
            textoResposta =
              (trat ? trat + ', ' : '') +
              'o montante total de gastos registrados neste mês é de R$ ' +
              valorFormatado +
              ' (' +
              gastosMes.length +
              ' registro(s)' +
              detalheMaior +
              ').'
          } else if (prefTom === 'direto') {
            textoResposta =
              'Total de gastos no mês: R$ ' +
              valorFormatado +
              ' em ' +
              gastosMes.length +
              ' lançamentos' +
              (maiorCategoria ? ' (maior: ' + maiorCategoria + ')' : '') +
              '.'
          } else {
            textoResposta =
              emojiGasto +
              (prefNome ? prefNome + ', ' : '') +
              'você registrou R$ ' +
              valorFormatado +
              ' em gastos este mês (' +
              gastosMes.length +
              ' lançamentos' +
              detalheMaior +
              ').'
          }
        }

        return e.json(200, {
          sucesso: true,
          audio_id: null,
          transcricao_original: transcricao,
          interpretacao: {
            intencao_detectada: 'consulta_gastos',
            comando_consulta_gastos: {
              total_mes: totalGastoMes,
              qtd_gastos: gastosMes.length,
              maior_categoria: maiorCategoria,
              valor_maior_categoria: maiorValorCat,
              mensagem_resposta: textoResposta,
            },
            transcricao_corrigida: transcricao.trim(),
            descricao_servico: 'Consulta de gastos do mês',
            itens: [],
            confianca: 'alta',
            duvidas: [],
          },
          citations: [],
        })
      }

      // 5.3 Detecção e extração de REGISTRO DE GASTO por voz
      // Ex: "gastei 150 reais de gasolina hoje", "comprei material elétrico, 340 reais no cartão",
      // "almoço 45 reais ontem", "paguei 1200 de aluguel da oficina", "gasto de 80 conto com brocas"
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
        transNorm.indexOf('almoco ') !== -1 ||
        transNorm.indexOf('jantar') !== -1 ||
        transNorm.indexOf('gasolina') !== -1

      if (contexto === 'gasto' || temPalavrasGasto) {
        // Tenta detectar orçamento vinculado na fala ("do orcamento 3", "da obra 2", "na empresa", etc.)
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

        // Se não achou por número, verifica se citou cliente de algum orçamento
        if (!orcVinculadoId && melhorClienteMatch && scoreMatch >= 8) {
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (o.cliente_id === melhorClienteMatch.id) {
              orcVinculadoId = o.id
              orcVinculadoNum = o.numero
              break
            }
          }
        }

        // Pede para o LLM estruturar o gasto com precisão
        const promptGasto =
          'Você é o assistente inteligente do OrçaFácil especializado em finanças e registro de gastos.\n' +
          'O usuário falou um gasto/despesa em português brasileiro informal:\n' +
          '"""\n' +
          transcricao.trim() +
          '\n"""\n\n' +
          'DATA ATUAL DE REFERÊNCIA: ' +
          new Date().toISOString().slice(0, 10) +
          '\n' +
          'CATEGORIAS PERMITIDAS (escolha EXATAMENTE uma destas):\n' +
          '- "Material" (fios, canos, cimento, peças, tintas, parafusos, componentes)\n' +
          '- "Transporte" (gasolina, combustível, pedágio, uber, estacionamento, passagem)\n' +
          '- "Alimentação" (almoço, café, marmita, lanche, mercado, refeição)\n' +
          '- "Moradia/Aluguel" (aluguel de oficina/galpão/sala, condomínio, luz, água da oficina)\n' +
          '- "Ferramentas" (brocas, lixadeiras, alicates, discos de corte, chaves)\n' +
          '- "Serviços terceirizados" (ajudante, terceirizado, mão de obra contratada, frete)\n' +
          '- "Impostos/Taxas" (MEI, DAS, taxas bancárias, licenças, notas)\n' +
          '- "Outros" (qualquer outro gasto não listado)\n\n' +
          'REGRAS:\n' +
          '1. Extraia o valor numérico (ex: "150 reais" -> 150; "um mil e duzentos" -> 1200; "cinquenta e cinco com cinquenta" -> 55.5; "80 conto" -> 80). Se não houver valor claro, retorne null.\n' +
          '2. Extraia uma descricao curta e limpa (ex: "Gasolina do carro", "Material elétrico", "Almoço da equipe", "Aluguel da oficina").\n' +
          '3. Calcule a data no formato YYYY-MM-DD. Se falou "hoje" ou omitiu -> data de hoje (' +
          new Date().toISOString().slice(0, 10) +
          '). Se falou "ontem" -> subtraia 1 dia. Se falou "anteontem" -> subtraia 2 dias. Se mencionou dia da semana passado, calcule a data correspondente.\n' +
          '4. Escolha a categoria mais apropriada da lista.\n' +
          '5. Se faltar o valor ou a descrição for ininteligível, liste a dúvida em "duvidas" e defina "precisa_confirmacao": true.\n' +
          '6. Crie uma mensagem_resposta curta para o usuário respeitando o tom ' +
          prefTom +
          (prefNome ? ' e chamando-o de ' + prefNome : '') +
          (prefEmojis ? ' com emoji.' : ' sem emoji.') +
          '\n\n' +
          'Retorne APENAS JSON válido sem formatação markdown:\n' +
          '{\n' +
          '  "valor": number | null,\n' +
          '  "descricao": string,\n' +
          '  "categoria": "Material" | "Transporte" | "Alimentação" | "Moradia/Aluguel" | "Ferramentas" | "Serviços terceirizados" | "Impostos/Taxas" | "Outros",\n' +
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
        } catch (errLlmGasto) {}

        let parsedGasto = null
        if (llmGastoResp?.content) {
          try {
            const m = llmGastoResp.content.match(/\{[\s\S]*\}/)
            if (m) parsedGasto = JSON.parse(m[0])
          } catch (eParse) {}
        }

        // Heurística de fallback para valor e categoria caso o agente falhe
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
          if (
            transNorm.indexOf('gasolina') !== -1 ||
            transNorm.indexOf('combustivel') !== -1 ||
            transNorm.indexOf('abastecer') !== -1 ||
            transNorm.indexOf('abasteci') !== -1 ||
            transNorm.indexOf('pedagio') !== -1 ||
            transNorm.indexOf('uber') !== -1
          ) {
            catHeuristica = 'Transporte'
          } else if (
            transNorm.indexOf('almoco') !== -1 ||
            transNorm.indexOf('lanche') !== -1 ||
            transNorm.indexOf('refeicao') !== -1 ||
            transNorm.indexOf('cafe') !== -1 ||
            transNorm.indexOf('marmita') !== -1
          ) {
            catHeuristica = 'Alimentação'
          } else if (
            transNorm.indexOf('aluguel') !== -1 ||
            transNorm.indexOf('galpao') !== -1 ||
            transNorm.indexOf('sala') !== -1 ||
            transNorm.indexOf('condominio') !== -1
          ) {
            catHeuristica = 'Moradia/Aluguel'
          } else if (
            transNorm.indexOf('material') !== -1 ||
            transNorm.indexOf('fio') !== -1 ||
            transNorm.indexOf('cano') !== -1 ||
            transNorm.indexOf('tinta') !== -1 ||
            transNorm.indexOf('cimento') !== -1
          ) {
            catHeuristica = 'Material'
          } else if (
            transNorm.indexOf('ferramenta') !== -1 ||
            transNorm.indexOf('broca') !== -1 ||
            transNorm.indexOf('disco') !== -1 ||
            transNorm.indexOf('alicate') !== -1
          ) {
            catHeuristica = 'Ferramentas'
          } else if (
            transNorm.indexOf('ajudante') !== -1 ||
            transNorm.indexOf('diaria') !== -1 ||
            transNorm.indexOf('terceirizado') !== -1 ||
            transNorm.indexOf('frete') !== -1
          ) {
            catHeuristica = 'Serviços terceirizados'
          } else if (
            transNorm.indexOf('das') !== -1 ||
            transNorm.indexOf('mei') !== -1 ||
            transNorm.indexOf('imposto') !== -1 ||
            transNorm.indexOf('taxa') !== -1
          ) {
            catHeuristica = 'Impostos/Taxas'
          }

          parsedGasto = {
            valor: valEncontrado,
            descricao: transcricao.trim(),
            categoria: catHeuristica,
            data: new Date().toISOString().slice(0, 10),
            precisa_confirmacao: valEncontrado === null,
            mensagem_resposta: valEncontrado
              ? 'Identifiquei o gasto de R$ ' +
                valEncontrado.toFixed(2).replace('.', ',') +
                ' em ' +
                catHeuristica +
                '.'
              : 'Não consegui identificar o valor do gasto. Pode repetir informando o valor?',
            duvidas: valEncontrado === null ? ['Qual foi o valor exato gasto?'] : [],
          }
        }

        // Validação da categoria contra as permitidas
        const categoriasValidas = [
          'Material',
          'Transporte',
          'Alimentação',
          'Moradia/Aluguel',
          'Ferramentas',
          'Serviços terceirizados',
          'Impostos/Taxas',
          'Outros',
        ]
        let catFinal = parsedGasto.categoria || 'Outros'
        if (categoriasValidas.indexOf(catFinal) === -1) {
          catFinal = 'Outros'
        }

        // Data válida
        let dataFinal = parsedGasto.data
        if (!dataFinal || !dataFinal.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dataFinal = new Date().toISOString().slice(0, 10)
        }

        const valorFinal =
          typeof parsedGasto.valor === 'number' && !isNaN(parsedGasto.valor)
            ? parsedGasto.valor
            : null

        const precisaConfirmacao =
          valorFinal === null ||
          valorFinal <= 0 ||
          Boolean(parsedGasto.precisa_confirmacao) ||
          (parsedGasto.duvidas && parsedGasto.duvidas.length > 0)

        // Mensagem persona
        let msgRespGasto = parsedGasto.mensagem_resposta
        if (!msgRespGasto) {
          const tratGasto = formatarTratamento()
          const emojiOk = prefEmojis ? '📝 ' : ''
          if (valorFinal !== null) {
            const vStr = valorFinal.toFixed(2).replace('.', ',')
            if (prefTom === 'formal') {
              msgRespGasto =
                (tratGasto ? tratGasto + ', ' : '') +
                'registrei a intenção de gasto no valor de R$ ' +
                vStr +
                ' referente a ' +
                (parsedGasto.descricao || 'despesa') +
                ' na categoria ' +
                catFinal +
                '.'
            } else if (prefTom === 'direto') {
              msgRespGasto =
                'Gasto: R$ ' +
                vStr +
                ' - ' +
                catFinal +
                ' (' +
                (parsedGasto.descricao || 'despesa') +
                '). Confirmar lançamento?'
            } else {
              msgRespGasto =
                emojiOk +
                (prefNome ? prefNome + ', ' : '') +
                'entendi o gasto de R$ ' +
                vStr +
                ' com ' +
                (parsedGasto.descricao || 'despesa') +
                ' (' +
                catFinal +
                '). Deseja salvar?'
            }
          } else {
            msgRespGasto =
              (prefNome ? prefNome + ', ' : '') +
              'não consegui identificar o valor do gasto. Pode falar novamente dizendo o valor em reais?'
          }
        }

        // Salva áudio no histórico com contexto 'gasto'
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
              data: dataFinal,
              orcamento_vinculado_id: orcVinculadoId,
              orcamento_vinculado_numero: orcVinculadoNum,
            },
          })
          audioRec.set('confianca', precisaConfirmacao ? 'media' : 'alta')
          audioRec.set('comando_executado', false)
          $app.save(audioRec)
          audioRecordIdGasto = audioRec.id
        } catch (errAudioGasto) {}

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
              data: dataFinal,
              origem: 'voz',
              orcamento_vinculado_id: orcVinculadoId,
              orcamento_vinculado_numero: orcVinculadoNum,
              precisa_confirmacao: precisaConfirmacao,
              mensagem_resposta: msgRespGasto,
            },
            transcricao_corrigida: transcricao.trim(),
            descricao_servico:
              'Registro de gasto: ' + (parsedGasto.descricao || transcricao.trim()),
            itens: [],
            confianca: precisaConfirmacao ? 'media' : 'alta',
            duvidas: parsedGasto.duvidas || [],
          },
          citations: llmGastoResp?.citations || [],
        })
      }

      // 6. Verificação de comando: "quem está me devendo?" / "contas a receber" (Melhoria 6)
      const ehConsultaDevedores =
        transNorm.indexOf('quem esta me devendo') !== -1 ||
        transNorm.indexOf('quem tá me devendo') !== -1 ||
        transNorm.indexOf('quem me deve') !== -1 ||
        transNorm.indexOf('contas a receber') !== -1 ||
        transNorm.indexOf('valores a receber') !== -1 ||
        transNorm.indexOf('quanto tenho pra receber') !== -1 ||
        transNorm.indexOf('quem esta devendo') !== -1 ||
        transNorm.indexOf('quem ta devendo') !== -1

      if (ehConsultaDevedores) {
        // Agrupa orçamentos aprovados pendentes por cliente
        // Um orçamento aprovado é considerado pago se existe uma cobrança com status = 'pago' para ele
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

        // Monta resposta personalizada pelo tom e nome
        const trat = formatarTratamento()
        const emojiPrefix = prefEmojis ? '💰 ' : ''
        let textoResposta = ''

        if (aprovadosNaoPagos.length === 0) {
          if (prefTom === 'formal') {
            textoResposta =
              (trat ? trat + ', ' : '') +
              'não há orçamentos aprovados pendentes de pagamento no momento. Todas as contas estão em dia.'
          } else if (prefTom === 'direto') {
            textoResposta = 'Nenhum valor pendente a receber no momento. Tudo quitado.'
          } else {
            textoResposta =
              (emojiPrefix ? '🎉 ' : '') +
              (prefNome ? prefNome + ', ' : '') +
              'boa notícia! Ninguém está te devendo no momento. Todos os orçamentos aprovados já foram pagos!'
          }
        } else {
          // Agrupa por cliente
          const porCliente = {}
          for (let i = 0; i < aprovadosNaoPagos.length; i++) {
            const o = aprovadosNaoPagos[i]
            const cli = o.cliente_nome || 'Cliente não identificado'
            if (!porCliente[cli]) {
              porCliente[cli] = { total: 0, qtd: 0, orcamentos: [] }
            }
            porCliente[cli].total += o.valor_total
            porCliente[cli].qtd += 1
            porCliente[cli].orcamentos.push(o.numero)
          }

          const linhasClientes = []
          for (const cli in porCliente) {
            const dados = porCliente[cli]
            linhasClientes.push(
              cli +
                ': R$ ' +
                dados.total.toFixed(2).replace('.', ',') +
                ' (' +
                dados.qtd +
                ' proposta(s): ' +
                dados.orcamentos.join(', ') +
                ')',
            )
          }

          if (prefTom === 'formal') {
            textoResposta =
              (trat ? trat + ', ' : '') +
              'o total a receber atualmente é de R$ ' +
              totalDevido.toFixed(2).replace('.', ',') +
              ', distribuído entre os seguintes clientes:\n' +
              linhasClientes
                .map(function (l) {
                  return '• ' + l
                })
                .join('\n')
          } else if (prefTom === 'direto') {
            textoResposta =
              'Total a receber: R$ ' +
              totalDevido.toFixed(2).replace('.', ',') +
              ' (' +
              aprovadosNaoPagos.length +
              ' orçamentos pendentes):\n' +
              linhasClientes
                .map(function (l) {
                  return '• ' + l
                })
                .join('\n')
          } else {
            textoResposta =
              emojiPrefix +
              (prefNome ? prefNome + ', ' : '') +
              'você tem um total de R$ ' +
              totalDevido.toFixed(2).replace('.', ',') +
              ' a receber de ' +
              Object.keys(porCliente).length +
              ' cliente(s):\n' +
              linhasClientes
                .map(function (l) {
                  return '• ' + l
                })
                .join('\n')
          }
        }

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
            descricao_servico: 'Consulta de contas a receber e clientes devedores',
            itens: [],
            confianca: 'alta',
            duvidas: [],
          },
          citations: [],
        })
      }

      // 7. Verificação de comando para "Dar Baixa / Marcar como Pago" (Melhoria 4 & 6)
      // Ex: "o João pagou o orçamento 3", "o João pagou", "marcar a cobrança do orçamento 3 como paga",
      // "orçamento 3 foi pago", "dar baixa no orçamento 2", "recebi o orçamento 1"
      const ehComandoBaixa =
        transNorm.indexOf('pagou') !== -1 ||
        transNorm.indexOf('pago') !== -1 ||
        transNorm.indexOf('dar baixa') !== -1 ||
        transNorm.indexOf('da baixa') !== -1 ||
        transNorm.indexOf('marcar como pago') !== -1 ||
        transNorm.indexOf('marcar como paga') !== -1 ||
        transNorm.indexOf('marcar a cobranca') !== -1 ||
        transNorm.indexOf('recebi o') !== -1 ||
        transNorm.indexOf('recebi da') !== -1

      if (ehComandoBaixa) {
        // Tenta achar número de orçamento mencionado
        const numMatch =
          transcricao.match(/(?:orçamento|proposta|numero|n[ºo#])\s*#?(\d+)/i) ||
          transcricao.match(/#?(\d+)/)
        const numeroProcurado = numMatch ? numMatch[1] : null

        let orcAlvo = null
        if (numeroProcurado) {
          const numFormatado1 = '#' + numeroProcurado.padStart(3, '0')
          const numFormatado2 = '#' + numeroProcurado
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (
              o.numero === numFormatado1 ||
              o.numero === numFormatado2 ||
              o.numero.replace(/\D/g, '') === numeroProcurado
            ) {
              orcAlvo = o
              break
            }
          }
        }

        // Se não achou por número, busca por cliente
        if (!orcAlvo && melhorClienteMatch) {
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (o.cliente_id === melhorClienteMatch.id && o.status === 'aprovado') {
              orcAlvo = o
              break
            }
          }
          if (!orcAlvo) {
            for (let i = 0; i < orcamentosUsuario.length; i++) {
              const o = orcamentosUsuario[i]
              if (o.cliente_id === melhorClienteMatch.id) {
                orcAlvo = o
                break
              }
            }
          }
        }

        if (orcAlvo) {
          // Procura cobrança existente deste orçamento
          let cobAlvoId = null
          for (let c = 0; c < cobrancasUsuario.length; c++) {
            if (cobrancasUsuario[c].orcamento_id === orcAlvo.id) {
              cobAlvoId = cobrancasUsuario[c].id
              break
            }
          }

          const emojiCheck = prefEmojis ? '✅ ' : ''
          const trat = formatarTratamento()
          let msgConf = ''

          if (prefTom === 'formal') {
            msgConf =
              'Confirmar o recebimento e dar baixa no orçamento ' +
              orcAlvo.numero +
              (orcAlvo.cliente_nome ? ' (' + orcAlvo.cliente_nome + ')' : '') +
              ' no valor de R$ ' +
              orcAlvo.valor_total.toFixed(2).replace('.', ',') +
              '?'
          } else if (prefTom === 'direto') {
            msgConf =
              'Dar baixa no orçamento ' +
              orcAlvo.numero +
              ' (' +
              (orcAlvo.cliente_nome || 'Cliente') +
              ') - R$ ' +
              orcAlvo.valor_total.toFixed(2).replace('.', ',') +
              '?'
          } else {
            msgConf =
              emojiCheck +
              (prefNome ? prefNome + ', ' : '') +
              'confirmar que o orçamento ' +
              orcAlvo.numero +
              (orcAlvo.cliente_nome ? ' de ' + orcAlvo.cliente_nome : '') +
              ' foi pago (R$ ' +
              orcAlvo.valor_total.toFixed(2).replace('.', ',') +
              ')?'
          }

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
              descricao_servico: 'Registrar baixa e pagamento do orçamento ' + orcAlvo.numero,
              itens: [],
              confianca: 'alta',
              duvidas: [],
            },
            citations: [],
          })
        }
      }

      // 8. Verificação de comando: "Gerar Cobrança" (Melhoria 4)
      // Ex: "gera a cobrança do orçamento 3", "gerar cobrança pro joao", "cobrar o orçamento 2"
      const ehComandoGerarCobranca =
        transNorm.indexOf('gerar cobranca') !== -1 ||
        transNorm.indexOf('gera a cobranca') !== -1 ||
        transNorm.indexOf('gera cobranca') !== -1 ||
        transNorm.indexOf('criar cobranca') !== -1 ||
        transNorm.indexOf('cria a cobranca') !== -1 ||
        transNorm.indexOf('emitir cobranca') !== -1 ||
        transNorm.indexOf('emite a cobranca') !== -1 ||
        transNorm.indexOf('mandar pix') !== -1 ||
        transNorm.indexOf('gerar pix') !== -1 ||
        transNorm.indexOf('gera o pix') !== -1 ||
        (transNorm.indexOf('cobrar') !== -1 && transNorm.indexOf('orcamento') !== -1)

      if (ehComandoGerarCobranca) {
        const numMatch =
          transcricao.match(/(?:orçamento|proposta|numero|n[ºo#])\s*#?(\d+)/i) ||
          transcricao.match(/#?(\d+)/)
        const numeroProcurado = numMatch ? numMatch[1] : null

        let orcAlvo = null
        if (numeroProcurado) {
          const numFormatado1 = '#' + numeroProcurado.padStart(3, '0')
          const numFormatado2 = '#' + numeroProcurado
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (
              o.numero === numFormatado1 ||
              o.numero === numFormatado2 ||
              o.numero.replace(/\D/g, '') === numeroProcurado
            ) {
              orcAlvo = o
              break
            }
          }
        }

        if (!orcAlvo && melhorClienteMatch) {
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (o.cliente_id === melhorClienteMatch.id) {
              orcAlvo = o
              break
            }
          }
        }

        if (orcAlvo) {
          const emojiPix = prefEmojis ? '⚡ ' : ''
          let msgConf = ''
          if (prefTom === 'formal') {
            msgConf =
              'Gerar cobrança simulada com chave PIX para o orçamento ' +
              orcAlvo.numero +
              (orcAlvo.cliente_nome ? ' (' + orcAlvo.cliente_nome + ')' : '') +
              ' no valor de R$ ' +
              orcAlvo.valor_total.toFixed(2).replace('.', ',') +
              '?'
          } else if (prefTom === 'direto') {
            msgConf =
              'Gerar PIX de R$ ' +
              orcAlvo.valor_total.toFixed(2).replace('.', ',') +
              ' para o orçamento ' +
              orcAlvo.numero +
              '?'
          } else {
            msgConf =
              emojiPix +
              (prefNome ? prefNome + ', ' : '') +
              'gerar a cobrança PIX do orçamento ' +
              orcAlvo.numero +
              (orcAlvo.cliente_nome ? ' (' + orcAlvo.cliente_nome + ')' : '') +
              ' de R$ ' +
              orcAlvo.valor_total.toFixed(2).replace('.', ',') +
              '?'
          }

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

      // 9. Detecção heurística de comando de status (ex: "marcar orçamento 3 como aprovado")
      const temPalavrasComandoStatus =
        transNorm.indexOf('marcar') !== -1 ||
        transNorm.indexOf('mudar') !== -1 ||
        transNorm.indexOf('alterar') !== -1 ||
        transNorm.indexOf('colocar') !== -1 ||
        transNorm.indexOf('aprovar') !== -1 ||
        transNorm.indexOf('rejeitar') !== -1 ||
        transNorm.indexOf('cancelar') !== -1 ||
        transNorm.indexOf('enviar') !== -1 ||
        transNorm.indexOf('status') !== -1

      if (contexto === 'comando_status' || (contexto === 'geral' && temPalavrasComandoStatus)) {
        contexto = 'comando_status'
      }

      // 10. Monta listas de resumo para o prompt do agente
      const listaClientesResumo = clientesUsuario
        .map(function (c) {
          return (
            '- ID: "' +
            c.id +
            '", Nome: "' +
            c.nome +
            '", Empresa: "' +
            c.empresa +
            '", Telefone: "' +
            c.telefone +
            '"'
          )
        })
        .join('\n')

      const listaOrcamentosResumo = orcamentosUsuario
        .slice(0, 30)
        .map(function (o) {
          return (
            '- ID: "' +
            o.id +
            '", Número: "' +
            o.numero +
            '", Cliente: "' +
            (o.cliente_nome || 'N/A') +
            '", Descrição: "' +
            o.descricao.slice(0, 40) +
            '", Status atual: "' +
            o.status +
            '", Valor: R$ ' +
            o.valor_total +
            ''
          )
        })
        .join('\n')

      // Prompt para o agente universal com preferências do usuário aplicadas
      const promptInstrucoes =
        'Você é o assistente inteligente de voz em português (pt-BR) da plataforma OrçaFácil.\n' +
        'O OrçaFácil atende prestadores de serviços de todos os segmentos: eletricistas, encanadores, diaristas, pintores, técnicos de informática, fotógrafos, marceneiros, pedreiros, mecânicos, professores e autônomos em geral.\n' +
        'O usuário ' +
        (prefNome ? 'chama-se "' + prefNome + '"' : '') +
        ' e prefere um tom de resposta ' +
        prefTom +
        (prefEmojis ? ' com emojis leves.' : ' sem emojis.') +
        '\n\n' +
        'Texto falado bruto transcrito:\n' +
        '"""\n' +
        transcricao.trim() +
        '\n"""\n\n' +
        'Contexto da solicitação: ' +
        contexto.toUpperCase() +
        '.\n\n' +
        'Clientes cadastrados deste usuário:\n' +
        (listaClientesResumo || '(Nenhum cliente cadastrado ainda)') +
        '\n\n' +
        'Orçamentos recentes deste usuário:\n' +
        (listaOrcamentosResumo || '(Nenhum orçamento emitido ainda)') +
        '\n\n' +
        'REGRAS OBRIGATÓRIAS:\n' +
        '1. Entenda erros fonéticos e termos informais brasileiros.\n' +
        '2. Se a fala for comando de mudar status de orçamento:\n' +
        '   - Identifique número ou cliente.\n' +
        '   - novo_status: "rascunho" | "enviado" | "aprovado" | "rejeitado" | "cancelado".\n' +
        '   - Monte a mensagem_confirmacao respeitando o tom ' +
        prefTom +
        ' e chamando pelo nome ' +
        (prefNome || 'usuário') +
        '.\n' +
        '3. Se for criação de orçamento:\n' +
        '   - Extraia descricao_servico, itens (descricao, quantidade, valor_unitario), cliente_sugerido ou cliente_novo.\n' +
        '4. Se for cliente novo, extraia os dados em cliente_novo.\n' +
        'RETORNE ESTRITAMENTE JSON VÁLIDO sem formatação markdown:\n' +
        '{\n' +
        '  "intencao_detectada": "orcamento" | "cliente" | "comando_status",\n' +
        '  "transcricao_corrigida": "...",\n' +
        '  "descricao_servico": "...",\n' +
        '  "cliente_sugerido_id": "id ou null",\n' +
        '  "cliente_sugerido_nome": "nome ou null",\n' +
        '  "cliente_novo": null,\n' +
        '  "itens": [{ "descricao": "...", "quantidade": 1, "valor_unitario": 100 }],\n' +
        '  "comando_status": {\n' +
        '    "orcamento_id": "id ou null",\n' +
        '    "orcamento_numero": "numero ou null",\n' +
        '    "cliente_nome": "nome ou null",\n' +
        '    "status_anterior": "status atual",\n' +
        '    "novo_status": "aprovado",\n' +
        '    "mensagem_confirmacao": "..."\n' +
        '  },\n' +
        '  "confianca": "alta" | "media" | "baixa",\n' +
        '  "duvidas": []\n' +
        '}'

      let agentResponse = null
      try {
        agentResponse = $ai.agent('orcamento-assistente').chat({
          user_id: userId,
          message: promptInstrucoes,
        })
      } catch (agentErr) {}

      const content = agentResponse?.content || ''
      let parsed = null

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        } else {
          parsed = JSON.parse(content)
        }
      } catch (parseErr) {
        parsed = null
      }

      // Heurística de matching para comando de status caso agente falhe
      let comandoStatusHeuristico = null
      if (temPalavrasComandoStatus || contexto === 'comando_status') {
        let novoStatus = null
        if (transNorm.indexOf('aprovad') !== -1 || transNorm.indexOf('aprovar') !== -1) {
          novoStatus = 'aprovado'
        } else if (transNorm.indexOf('rejeitad') !== -1 || transNorm.indexOf('rejeitar') !== -1) {
          novoStatus = 'rejeitado'
        } else if (transNorm.indexOf('enviad') !== -1 || transNorm.indexOf('enviar') !== -1) {
          novoStatus = 'enviado'
        } else if (transNorm.indexOf('cancelad') !== -1 || transNorm.indexOf('cancelar') !== -1) {
          novoStatus = 'cancelado'
        } else if (transNorm.indexOf('rascunho') !== -1) {
          novoStatus = 'rascunho'
        }

        const numMatch =
          transcricao.match(/(?:orçamento|proposta|numero|n[ºo#])\s*#?(\d+)/i) ||
          transcricao.match(/#?(\d+)/)
        const numeroProcurado = numMatch ? numMatch[1] : null

        let orcamentoEncontrado = null
        if (numeroProcurado) {
          const numFormatado1 = '#' + numeroProcurado.padStart(3, '0')
          const numFormatado2 = '#' + numeroProcurado
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (
              o.numero === numFormatado1 ||
              o.numero === numFormatado2 ||
              o.numero.replace(/\D/g, '') === numeroProcurado
            ) {
              orcamentoEncontrado = o
              break
            }
          }
        }

        if (!orcamentoEncontrado && melhorClienteMatch) {
          for (let i = 0; i < orcamentosUsuario.length; i++) {
            const o = orcamentosUsuario[i]
            if (o.cliente_id === melhorClienteMatch.id) {
              orcamentoEncontrado = o
              break
            }
          }
        }

        if (novoStatus && orcamentoEncontrado) {
          const saud = prefNome ? prefNome + ', ' : ''
          const emojiIcon = prefEmojis ? '🔄 ' : ''
          let msg = ''
          if (prefTom === 'formal') {
            msg =
              'Confirmar a alteração do orçamento ' +
              orcamentoEncontrado.numero +
              (orcamentoEncontrado.cliente_nome
                ? ' (' + orcamentoEncontrado.cliente_nome + ')'
                : '') +
              ' para o status "' +
              novoStatus +
              '"?'
          } else if (prefTom === 'direto') {
            msg = 'Mudar orçamento ' + orcamentoEncontrado.numero + ' para "' + novoStatus + '"?'
          } else {
            msg =
              emojiIcon +
              saud +
              'mudar o orçamento ' +
              orcamentoEncontrado.numero +
              (orcamentoEncontrado.cliente_nome
                ? ' (' + orcamentoEncontrado.cliente_nome + ')'
                : '') +
              ' de "' +
              orcamentoEncontrado.status +
              '" para "' +
              novoStatus +
              '"?'
          }

          comandoStatusHeuristico = {
            orcamento_id: orcamentoEncontrado.id,
            orcamento_numero: orcamentoEncontrado.numero,
            cliente_nome: orcamentoEncontrado.cliente_nome || '',
            status_anterior: orcamentoEncontrado.status,
            novo_status: novoStatus,
            mensagem_confirmacao: msg,
          }
        }
      }

      if (!parsed) {
        parsed = {
          intencao_detectada: comandoStatusHeuristico ? 'comando_status' : contexto,
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
          prazo: null,
          observacoes: null,
          comando_status: comandoStatusHeuristico,
          confianca: 'media',
          duvidas: [],
        }
      }

      if (comandoStatusHeuristico) {
        if (!parsed.comando_status || !parsed.comando_status.orcamento_id) {
          parsed.comando_status = comandoStatusHeuristico
        }
        if (!parsed.intencao_detectada) {
          parsed.intencao_detectada = 'comando_status'
        }
      }

      if (
        parsed.comando_status &&
        !parsed.comando_status.orcamento_id &&
        parsed.comando_status.orcamento_numero
      ) {
        const numDigitos = String(parsed.comando_status.orcamento_numero).replace(/\D/g, '')
        for (let i = 0; i < orcamentosUsuario.length; i++) {
          const o = orcamentosUsuario[i]
          if (o.numero.replace(/\D/g, '') === numDigitos) {
            parsed.comando_status.orcamento_id = o.id
            parsed.comando_status.orcamento_numero = o.numero
            parsed.comando_status.status_anterior = o.status
            parsed.comando_status.cliente_nome = o.cliente_nome
            break
          }
        }
      }

      if (!parsed.cliente_sugerido_id && melhorClienteMatch && scoreMatch >= 3) {
        parsed.cliente_sugerido_id = melhorClienteMatch.id
        parsed.cliente_sugerido_nome = melhorClienteMatch.nome
      }

      const rawItens = Array.isArray(parsed.itens) ? parsed.itens : []
      const itensLimpos = rawItens.map(function (it) {
        return {
          descricao: String(it.descricao || 'Item de serviço').trim(),
          quantidade: Math.max(1, Number(it.quantidade) || 1),
          valor_unitario: Math.max(0, Number(it.valor_unitario) || 0),
        }
      })

      if (
        (contexto === 'orcamento' || parsed.intencao_detectada === 'orcamento') &&
        itensLimpos.length === 0
      ) {
        itensLimpos.push({
          descricao: parsed.descricao_servico || 'Serviço solicitado: ' + transcricao.slice(0, 50),
          quantidade: 1,
          valor_unitario: 300.0,
        })
      }

      parsed.itens = itensLimpos
      if (!Array.isArray(parsed.duvidas)) {
        parsed.duvidas = []
      }

      // Salva áudio no histórico
      let contextoHistorico = 'geral'
      if (parsed.comando_status?.orcamento_id) {
        contextoHistorico = 'comando_status'
      } else if (contexto === 'cliente' || parsed.intencao_detectada === 'cliente') {
        contextoHistorico = 'cliente'
      } else if (contexto === 'orcamento' || parsed.intencao_detectada === 'orcamento') {
        contextoHistorico = 'orcamento'
      }

      let audioRecordId = null
      try {
        const audiosCol = $app.findCollectionByNameOrId('audios')
        const audioRec = new Record(audiosCol)
        audioRec.set('user_id', userId)
        audioRec.set('transcricao_bruta', transcricao.trim())
        audioRec.set('transcricao_corrigida', parsed.transcricao_corrigida || transcricao.trim())
        audioRec.set('contexto', contextoHistorico)
        audioRec.set('resultado_json', parsed)
        audioRec.set('confianca', parsed.confianca || 'media')
        audioRec.set('comando_executado', false)
        $app.save(audioRec)
        audioRecordId = audioRec.id
      } catch (errAudioSave) {}

      return e.json(200, {
        sucesso: true,
        audio_id: audioRecordId,
        transcricao_original: transcricao,
        interpretacao: parsed,
        citations: agentResponse?.citations || [],
      })
    } catch (err) {
      return e.json(500, {
        error: err.message || 'Erro ao interpretar áudio com IA',
      })
    }
  },
  $apis.requireAuth(),
)
