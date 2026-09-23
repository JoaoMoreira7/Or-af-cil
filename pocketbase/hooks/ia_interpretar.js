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

      let contexto = body.contexto || 'orcamento' // 'orcamento', 'cliente', 'comando_status', 'geral'

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

      // 1. Carrega clientes do usuário para matching difuso e dar contexto ao agente
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
      } catch (errDb) {
        // Ignora falha de busca de clientes
      }

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

      // 2. Carrega orçamentos recentes do usuário para matching de comandos de status
      let orcamentosUsuario = []
      try {
        const orcRecords = $app.findRecordsByFilter(
          'orcamentos',
          "user_id = '" + userId + "'",
          '-created',
          50,
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
          })
        }
      } catch (errOrc) {
        // Ignora falha de busca de orçamentos
      }

      // Detecção heurística de comando de status (ex: "marcar o orçamento 3 como aprovado", "mudar orçamento para enviado", "aprovar o orçamento da maria")
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

      // 3. Monta listas de resumo para o prompt do agente
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

      // Prepara o prompt do agente
      const promptInstrucoes =
        'Você é o interpretador de áudio e voz em português (pt-BR) da plataforma JM Sistemas.\n' +
        'O usuário falou uma mensagem por voz (áudio estilo WhatsApp) com o seguinte texto transcrito bruto:\n' +
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
        '1. Sotaques e Erros Fonéticos: Entenda termos informais, erros de concordância e palavras cortadas (ex: "ar condiciado" -> "Ar-condicionado", "faser um bencimento" -> "Acabamento em gesso", "cem conto" -> 100.00).\n' +
        '2. Se contexto = "comando_status" ou a fala for comando de mudar status:\n' +
        '   - Identifique qual orçamento o usuário quer mudar. Procure por número (ex: "orçamento 3", "#003", "orçamento três" -> número: "#003" ou ID correspondente na lista de orçamentos acima), ou por cliente / descrição.\n' +
        '   - Identifique o novo status desejado entre estritamente: "rascunho", "enviado", "aprovado", "rejeitado", "cancelado" (ex: "marcar como aprovado" -> "aprovado", "já foi enviado" -> "enviado", "cancela aí" -> "cancelado").\n' +
        '   - Preencha o objeto "comando_status": {\n' +
        '       "orcamento_id": "id_do_orcamento_ou_null",\n' +
        '       "orcamento_numero": "numero_identificado_ou_null",\n' +
        '       "cliente_nome": "nome_do_cliente_ou_null",\n' +
        '       "status_anterior": "status_atual_ou_null",\n' +
        '       "novo_status": "rascunho" | "enviado" | "aprovado" | "rejeitado" | "cancelado" | null,\n' +
        '       "mensagem_confirmacao": "Ex: Mudar o orçamento #003 (João Carlos) de enviado para aprovado?"\n' +
        '     }\n' +
        '3. Se contexto = "orcamento" ou "geral":\n' +
        '   - Extraia a "descricao_servico" formalizada.\n' +
        '   - Identifique itens no array "itens": { "descricao": string, "quantidade": number, "valor_unitario": number }.\n' +
        '   - Se o usuário citou cliente existente, preencha "cliente_sugerido_id" e "cliente_sugerido_nome".\n' +
        '   - Se citou dados de novo cliente, preencha "cliente_novo": { "nome": string, "telefone": string, "email": string, "empresa": string, "endereco": string }.\n' +
        '   - Extraia "prazo" e "observacoes".\n' +
        '   - Dúvidas em "duvidas": [].\n' +
        '4. Se contexto = "cliente":\n' +
        '   - Extraia dados do cliente novo em "cliente_novo".\n' +
        '5. "confianca": "alta" | "media" | "baixa".\n' +
        '6. Identifique a "intencao_detectada": "orcamento" | "cliente" | "comando_status".\n\n' +
        'RETORNE ESTRITAMENTE UM OBJETO JSON VÁLIDO sem markdown ao redor:\n' +
        '{\n' +
        '  "intencao_detectada": "orcamento" | "cliente" | "comando_status",\n' +
        '  "transcricao_corrigida": "Texto da fala corrigido gramaticalmente e formatado",\n' +
        '  "descricao_servico": "Descrição formal do serviço",\n' +
        '  "cliente_sugerido_id": "id_ou_null",\n' +
        '  "cliente_sugerido_nome": "Nome ou null",\n' +
        '  "cliente_novo": {\n' +
        '    "nome": "string ou null",\n' +
        '    "telefone": "string ou null",\n' +
        '    "email": "string ou null",\n' +
        '    "empresa": "string ou null",\n' +
        '    "endereco": "string ou null"\n' +
        '  },\n' +
        '  "itens": [\n' +
        '    { "descricao": "string", "quantidade": 1, "valor_unitario": 100.0 }\n' +
        '  ],\n' +
        '  "prazo": "string ou null",\n' +
        '  "observacoes": "string ou null",\n' +
        '  "comando_status": {\n' +
        '    "orcamento_id": "id_ou_null",\n' +
        '    "orcamento_numero": "numero_ou_null",\n' +
        '    "cliente_nome": "nome_ou_null",\n' +
        '    "status_anterior": "status_ou_null",\n' +
        '    "novo_status": "aprovado",\n' +
        '    "mensagem_confirmacao": "string"\n' +
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
      } catch (agentErr) {
        // Fallback em caso de indisponibilidade
      }

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

      // Heurística de matching para comando de status caso o agente não tenha retornado o objeto
      let comandoStatusHeuristico = null
      if (temPalavrasComandoStatus || contexto === 'comando_status') {
        // Identifica novo status
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

        // Tenta achar número falado (ex: "orçamento 3", "#003", "3")
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

        // Se não achou por número, procura por cliente ou descrição
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
          comandoStatusHeuristico = {
            orcamento_id: orcamentoEncontrado.id,
            orcamento_numero: orcamentoEncontrado.numero,
            cliente_nome: orcamentoEncontrado.cliente_nome || '',
            status_anterior: orcamentoEncontrado.status,
            novo_status: novoStatus,
            mensagem_confirmacao:
              'Mudar orçamento ' +
              orcamentoEncontrado.numero +
              (orcamentoEncontrado.cliente_nome
                ? ' (' + orcamentoEncontrado.cliente_nome + ')'
                : '') +
              ' de "' +
              orcamentoEncontrado.status +
              '" para "' +
              novoStatus +
              '"?',
          }
        }
      }

      // Se não veio parse válido do agente, usa heurística padrão
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

      // Se o agente detectou ou se a heurística pegou comando_status, ajusta
      if (comandoStatusHeuristico) {
        if (!parsed.comando_status || !parsed.comando_status.orcamento_id) {
          parsed.comando_status = comandoStatusHeuristico
        }
        if (!parsed.intencao_detectada) {
          parsed.intencao_detectada = 'comando_status'
        }
      }

      // Se o comando_status existe no parsed mas faltou orcamento_id, tenta resolver pelo numero
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

      // Validação e coerência com o matching difuso local de clientes:
      if (!parsed.cliente_sugerido_id && melhorClienteMatch && scoreMatch >= 3) {
        parsed.cliente_sugerido_id = melhorClienteMatch.id
        parsed.cliente_sugerido_nome = melhorClienteMatch.nome
      }

      // Normaliza itens
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

      // Determina contexto final para salvamento no histórico
      let contextoHistorico = 'orcamento'
      if (parsed.comando_status?.orcamento_id) {
        contextoHistorico = 'comando_status'
      } else if (contexto === 'cliente' || parsed.intencao_detectada === 'cliente') {
        contextoHistorico = 'cliente'
      } else if (contexto === 'comando_status') {
        contextoHistorico = 'comando_status'
      }

      // 4. Salva o áudio no histórico da coleção 'audios'
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
      } catch (errAudioSave) {
        // Falha no log não deve interromper a resposta ao usuário
      }

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
