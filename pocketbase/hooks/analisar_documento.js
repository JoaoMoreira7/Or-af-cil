// @ts-nocheck
routerAdd(
  'POST',
  '/backend/v1/analisar-documento',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      // Lê preferências da IA do usuário
      let prefNome = ''
      let prefTom = 'amigavel'
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

      // 1. Tenta verificar se há arquivos enviados (multipart/form-data)
      let uploadedFiles = []
      try {
        uploadedFiles = e.findUploadedFiles('foto') || []
        if (uploadedFiles.length === 0) {
          uploadedFiles = e.findUploadedFiles('arquivo') || []
        }
      } catch (_) {}

      // 2. Extrai dados de texto/OCR opcionais enviados pelo cliente ou do body
      const body = e.requestInfo().body || {}
      const textoInformado = (body.texto || body.transcricao || '').trim()
      const nomeArquivo = body.nome_arquivo || (uploadedFiles[0] ? uploadedFiles[0].name : '')

      // Tenta ler com $documents.toMarkdown caso seja PDF ou documento suportado
      let textoDoDocumento = ''
      let foiLidoPorDocumentos = false

      if (uploadedFiles.length > 0) {
        const arq = uploadedFiles[0]
        const ext = (arq.name || '').toLowerCase()
        if (
          ext.endsWith('.pdf') ||
          ext.endsWith('.docx') ||
          ext.endsWith('.xlsx') ||
          ext.endsWith('.pptx')
        ) {
          try {
            const docRes = $documents.toMarkdown({ file: arq })
            if (docRes && docRes.markdown) {
              textoDoDocumento = docRes.markdown
              foiLidoPorDocumentos = true
            }
          } catch (errDoc) {
            console.log('Aviso ao converter documento com $documents.toMarkdown:', errDoc)
          }
        }
      }

      // 3. Testa se o $ai.chat aceita mensagens multimodais / vision se houver imagem em base64 ou URL
      // Verificação honesta do gateway conforme Requisito 6
      let leituraAutomaticaPorVisao = false
      let respostaVisao = null

      if (body.imagem_base64 && typeof body.imagem_base64 === 'string') {
        try {
          const promptVision = [
            {
              role: 'system',
              content:
                'Você é a persona "Assistente de Campo" (estilo Luna / Meu Assessor) da plataforma JM Sistemas.\n' +
                'Você analisa fotos de notas fiscais, cupons fiscais, recibos, orçamentos em papel ou listas de materiais.\n' +
                'Extraia com rigor e precisão em formato JSON:\n' +
                '{\n' +
                '  "tipo_documento": "nota_fiscal" | "recibo" | "orcamento_papel" | "lista_materiais" | "comprovante" | "outro",\n' +
                '  "fornecedor": "Nome da empresa/fornecedor ou vazio",\n' +
                '  "data_documento": "DD/MM/AAAA ou YYYY-MM-DD ou vazio",\n' +
                '  "itens": [\n' +
                '    { "descricao": "...", "quantidade": 1, "valor_unitario": 0, "valor_total": 0 }\n' +
                '  ],\n' +
                '  "valor_total": 0.0,\n' +
                '  "valor_impostos": 0.0,\n' +
                '  "observacoes": "...",\n' +
                '  "confianca": "alta" | "media" | "baixa"\n' +
                '}\n' +
                'Retorne APENAS o JSON.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analise esta foto de nota/recibo/orçamento e extraia os campos:',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: body.imagem_base64.startsWith('data:')
                      ? body.imagem_base64
                      : 'data:image/jpeg;base64,' + body.imagem_base64,
                  },
                },
              ],
            },
          ]

          const reply = $ai.chat({
            model: 'fast',
            messages: promptVision,
          })

          const replyText = reply?.choices?.[0]?.message?.content || ''
          const matchJson = replyText.match(/\{[\s\S]*\}/)
          if (matchJson) {
            respostaVisao = JSON.parse(matchJson[0])
            leituraAutomaticaPorVisao = true
          }
        } catch (visionErr) {
          // O AI Gateway não suporta imagem ou falhou: fallback honesto ativado
          console.log(
            'Skip AI Gateway vision não disponível ou rejeitou imagem:',
            visionErr.message,
          )
        }
      }

      // 4. Se tiver texto extraído (por documentos ou informado/digitado), processa com IA em texto
      let interpretacaoTexto = null
      const textoParaAnalisar = textoDoDocumento || textoInformado

      if (textoParaAnalisar && !leituraAutomaticaPorVisao) {
        try {
          const promptTexto =
            'Você é a persona "Assistente de Campo" da plataforma JM Sistemas. O usuário enviou um documento/foto com o seguinte texto/conteúdo:\n\n' +
            textoParaAnalisar +
            '\n\n' +
            'Analise as informações do documento comercial e estruture os dados em formato JSON estrito:\n' +
            '{\n' +
            '  "tipo_documento": "nota_fiscal" | "recibo" | "orcamento_papel" | "lista_materiais" | "comprovante" | "outro",\n' +
            '  "fornecedor": "Nome da loja/fornecedor/emissor ou vazio",\n' +
            '  "data_documento": "DD/MM/AAAA ou vazio",\n' +
            '  "itens": [\n' +
            '    { "descricao": "...", "quantidade": 1, "valor_unitario": 0, "valor_total": 0 }\n' +
            '  ],\n' +
            '  "valor_total": 0.0,\n' +
            '  "valor_impostos": 0.0,\n' +
            '  "observacoes": "...",\n' +
            '  "confianca": "alta" | "media" | "baixa"\n' +
            '}\n' +
            'Responda estritamente com o JSON válido.'

          const reply = $ai.chat({
            model: 'fast',
            messages: [
              {
                role: 'system',
                content:
                  'Você é um assistente especialista em conferência de notas fiscais, recibos e orçamentos comerciais.',
              },
              { role: 'user', content: promptTexto },
            ],
          })

          const replyText = reply?.choices?.[0]?.message?.content || ''
          const matchJson = replyText.match(/\{[\s\S]*\}/)
          if (matchJson) {
            interpretacaoTexto = JSON.parse(matchJson[0])
          }
        } catch (errAiTexto) {
          console.log('Erro ao analisar texto com AI Gateway:', errAiTexto.message)
        }
      }

      // 5. Monta dados finais consolidados com honestidade e transparência
      let dadosFinais = respostaVisao || interpretacaoTexto

      // Se nenhum retornou, cria estrutura base para o usuário conferir/editar na interface
      if (!dadosFinais) {
        dadosFinais = {
          tipo_documento: 'recibo',
          fornecedor: '',
          data_documento: new Date().toLocaleDateString('pt-BR'),
          itens: [
            {
              descricao: 'Item a conferir na foto',
              quantidade: 1,
              valor_unitario: 0,
              valor_total: 0,
            },
          ],
          valor_total: 0,
          valor_impostos: 0,
          observacoes: '',
          confianca: 'baixa',
        }
      }

      // Normalização e garantia de itens
      if (!Array.isArray(dadosFinais.itens) || dadosFinais.itens.length === 0) {
        dadosFinais.itens = [
          {
            descricao: 'Item do documento',
            quantidade: 1,
            valor_unitario: Number(dadosFinais.valor_total) || 0,
            valor_total: Number(dadosFinais.valor_total) || 0,
          },
        ]
      } else {
        dadosFinais.itens = dadosFinais.itens.map(function (it) {
          const q = Math.max(1, Number(it.quantidade) || 1)
          const u = Math.max(0, Number(it.valor_unitario) || 0)
          const t = Math.max(0, Number(it.valor_total) || q * u)
          return {
            descricao: String(it.descricao || 'Item').trim(),
            quantidade: q,
            valor_unitario: u,
            valor_total: t,
          }
        })
      }

      // Recalcula total se for 0 e os itens tiverem valor
      if (!dadosFinais.valor_total || dadosFinais.valor_total === 0) {
        let soma = 0
        for (let i = 0; i < dadosFinais.itens.length; i++) {
          soma += dadosFinais.itens[i].valor_total
        }
        dadosFinais.valor_total = soma
      }

      // Mensagem personalizada do assistente respeitando nome, tom e emojis
      const saudacao = prefNome ? prefNome + ', ' : ''
      const emojiIcon = prefEmojis ? '📸 ' : ''
      let mensagemAssistente = ''

      if (leituraAutomaticaPorVisao) {
        if (prefTom === 'formal') {
          mensagemAssistente =
            'A fotografia foi processada com êxito pelo modelo de visão computacional. Por gentileza, confira os dados extraídos abaixo antes de aplicar.'
        } else if (prefTom === 'direto') {
          mensagemAssistente = 'Dados extraídos da imagem. Confira e selecione a ação desejada.'
        } else {
          mensagemAssistente =
            (prefEmojis ? '✨ ' : '') +
            saudacao +
            'analisei a foto da nota/recibo! Veja abaixo os itens e valores identificados. Você pode editar qualquer campo antes de confirmar.'
        }
      } else if (foiLidoPorDocumentos) {
        if (prefTom === 'formal') {
          mensagemAssistente =
            'O documento enviado foi convertido e analisado. Verifique os dados abaixo para continuidade.'
        } else if (prefTom === 'direto') {
          mensagemAssistente = 'Documento analisado via leitor de arquivos. Confira os itens.'
        } else {
          mensagemAssistente =
            (prefEmojis ? '📄 ' : '') +
            saudacao +
            'li os dados do documento digital! Confira os itens e o valor total extraídos.'
        }
      } else {
        // Fallback honesto e transparente (Requisito 6)
        if (prefTom === 'formal') {
          mensagemAssistente =
            'Modo de Conferência Assistida ativo: visualize a foto ao lado e preencha ou ajuste os dados-chave do documento para registrar no sistema.'
        } else if (prefTom === 'direto') {
          mensagemAssistente =
            'Conferência assistida: foto exibida ao lado. Confira e ajuste os dados antes de salvar.'
        } else {
          mensagemAssistente =
            emojiIcon +
            saudacao +
            'abrimos o modo de Conferência Assistida! A foto está bem visível aqui ao lado para você conferir e ajustar os itens e valores antes de aplicar a ação.'
        }
      }

      return e.json(200, {
        sucesso: true,
        leitura_automatica: leituraAutomaticaPorVisao || foiLidoPorDocumentos,
        modo_visao_suportado: leituraAutomaticaPorVisao,
        mensagem_assistente: mensagemAssistente,
        preferencias_aplicadas: {
          nome_preferido: prefNome,
          tom_resposta: prefTom,
          usar_emojis: prefEmojis,
        },
        dados_extraidos: dadosFinais,
      })
    } catch (err) {
      console.error('Erro na rota /backend/v1/analisar-documento:', err)
      return e.json(500, {
        error: err.message || 'Erro ao processar análise do documento',
      })
    }
  },
  $apis.requireAuth(),
)
