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

      const contexto = body.contexto || 'orcamento' // 'orcamento' ou 'cliente'

      // 1. Carrega clientes do usuário para fazer matching difuso e dar contexto ao agente
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

      // 2. Prepara o prompt rigoroso para o agente
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

      const promptInstrucoes =
        'Você é o interpretador de áudio e voz em português (pt-BR). O usuário falou uma mensagem (áudio estilo WhatsApp) e o texto transcrito bruto é:\n' +
        '"""\n' +
        transcricao.trim() +
        '\n"""\n\n' +
        'Contexto da solicitação: ' +
        contexto.toUpperCase() +
        '.\n\n' +
        'Clientes já cadastrados na base deste usuário:\n' +
        (listaClientesResumo || '(Nenhum cliente cadastrado ainda)') +
        '\n\n' +
        'REGRAS OBRIGATÓRIAS:\n' +
        '1. Sotaques e Erros: Entenda e corrija termos cortados, gírias e erros fonéticos (ex: "ar condiciado" -> "Ar-condicionado", "faser um bencimento" -> "Acabamento em gesso", "cem conto" -> 100.00).\n' +
        '2. Se contexto = "orcamento":\n' +
        '   - Extraia a "descricao_servico" corrigida e formalizada.\n' +
        '   - Identifique ou sugira os itens do orçamento no array "itens" com: { "descricao": string, "quantidade": number, "valor_unitario": number }.\n' +
        '   - Se o usuário citou cliente existente ou os dados batem com a lista acima, preencha "cliente_sugerido_id" com o ID correspondente e "cliente_sugerido_nome".\n' +
        '   - Se o usuário falou dados de um novo cliente (nome, telefone etc.), preencha o objeto "cliente_novo": { "nome": string, "telefone": string, "email": string, "empresa": string, "endereco": string }.\n' +
        '   - Extraia "prazo": string ou null (ex: "5 dias úteis", "15 dias").\n' +
        '   - Extraia "observacoes": string ou null.\n' +
        '   - Se faltar dado crítico (ex: não citou o que fazer ou faltou detalhe importante), liste 1 a 2 perguntas curtas e diretas em "duvidas": ["pergunta 1"].\n' +
        '3. Se contexto = "cliente":\n' +
        '   - Extraia os campos do novo cliente no objeto "cliente_novo": { "nome": string, "telefone": string, "email": string, "empresa": string, "endereco": string }.\n' +
        '   - Se o nome ou contato estiver incompleto, coloque em "duvidas" perguntas gentis de confirmação.\n' +
        '4. Atribua um nível de confiança ("alta", "media" ou "baixa") no campo "confianca".\n\n' +
        'RETORNE ESTRITAMENTE UM OBJETO JSON VÁLIDO sem blocos de texto ou markdown fora do JSON. Siga este formato:\n' +
        '{\n' +
        '  "transcricao_corrigida": "Texto da fala corrigido gramaticalmente e formatado",\n' +
        '  "descricao_servico": "Descrição formal do serviço",\n' +
        '  "cliente_sugerido_id": "id_ou_null",\n' +
        '  "cliente_sugerido_nome": "Nome do cliente sugerido ou null",\n' +
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
        // Fallback em caso de falha de conexão do agente
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

      // Se não veio parse válido do agente, usa heurística com o melhor cliente encontrado
      if (!parsed) {
        parsed = {
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
          confianca: 'media',
          duvidas: [],
        }
      }

      // Validação e coerência com o matching difuso local:
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

      // Se nenhum item foi extraído no contexto de orçamento, cria um item baseado na descrição
      if (contexto === 'orcamento' && itensLimpos.length === 0) {
        itensLimpos.push({
          descricao: parsed.descricao_servico || 'Serviço solicitado: ' + transcricao.slice(0, 50),
          quantidade: 1,
          valor_unitario: 300.0,
        })
      }

      parsed.itens = itensLimpos

      // Garante duvidas como array
      if (!Array.isArray(parsed.duvidas)) {
        parsed.duvidas = []
      }

      return e.json(200, {
        sucesso: true,
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
