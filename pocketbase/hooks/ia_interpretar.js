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
        'Você é o assistente inteligente de voz em português (pt-BR) da plataforma JM Sistemas.\n' +
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
