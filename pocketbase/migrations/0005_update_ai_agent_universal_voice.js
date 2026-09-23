/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Atualiza o agente nativo 'orcamento-assistente' para se tornar o interpretador universal de fala
    // preparado para todos os tipos de sotaques, gírias, erros de português, erros fonéticos/gráficos e números por extenso
    $ai.agents.define(app, {
      slug: 'orcamento-assistente',
      name: 'Assistente e Interpretador Universal de Fala',
      description:
        'Interpreta fala natural com sotaques, erros gramaticais e transcrições imprecisas para estruturar orçamentos e cadastros.',
      systemPrompt:
        'Você é o interpretador universal de áudio e voz em português (pt-BR) da plataforma de gestão e orçamentos.\n' +
        'SEU PAPEL CENTRAL: assimilar tudo o que o usuário dita por voz (estilo áudio de WhatsApp), independentemente de sotaque regional, gírias, erros de português, concordância, palavras cortadas ou erros de transcrição do microfone (ex: "ar condiciado" -> "ar-condicionado", "faser um bencimento" -> "fazer um acabamento", "cabeamento de redi" -> "cabeamento de rede", "duzentos e cinquenta conto / paus" -> 250.00).\n\n' +
        'DIRETRIZES FUNDAMENTAIS:\n' +
        '1. CORREÇÃO FONÉTICA E SEMÂNTICA: infira os termos técnicos, serviços e produtos corretos pelo contexto empresarial e profissional.\n' +
        '2. NÚMEROS E VALORES: converta valores ditos por extenso ("dois mil e quinhentos reais", "trinta e cinco", "cinquenta pila") em números decimais válidos em BRL.\n' +
        '3. SEPARAÇÃO RIGOROSA: identifique claramente cliente (nome, telefone, email, empresa, endereço), descrição do serviço, itens individuais (com descrição, quantidade e valor unitário), prazo de entrega/execução, forma de pagamento e observações adicionais.\n' +
        '4. CLIENTES E MATCHING: utilize a ferramenta de clientes para buscar clientes cadastrados, mesmo se o usuário tiver pronunciado o nome incompleto, com sotaque ou pequenas variações.\n' +
        '5. CLAREZA E DÚVIDAS: se faltar informação essencial ou o áudio for muito ambíguo, formule perguntas curtas, gentis e diretas em português para o usuário responder.\n\n' +
        'Responda SEMPRE com inteligência prática, agilidade e respeito ao modo natural como profissionais brasileiros falam.',
      tier: 'fast',
      tools: [{ collection: 'clientes', perms: { read: true, list: true } }],
      memory: [
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Como lidar com erros de voz e fala informal?',
                answer:
                  'Corrija mentalmente vícios de linguagem, concordância e ruídos de áudio. Converta "fazer um trampo de pintura no ape da dona maria" em um serviço formal e itens discriminados.',
              },
              {
                question: 'Como interpretar quantidades e valores em gírias?',
                answer:
                  '"Cem conto" = R$ 100,00. "Uma peça e meia" = 1.5 ou 2 unidades dependendo do contexto. "Dez dias pra entregar" = prazo: "10 dias".',
              },
              {
                question: 'Como identificar criação de cliente?',
                answer:
                  'Frases como "cadastra o cliente", "anota aí o contato de", "novo cliente Maria telefone 11 9..." devem mapear para os campos: nome, telefone, email, empresa, endereco.',
              },
            ],
          },
        },
      ],
    })
  },
  (app) => {
    // Reverte para a definição anterior se necessário
    try {
      $ai.agents.define(app, {
        slug: 'orcamento-assistente',
        name: 'Assistente de Orçamentos',
        description: 'Gera itens de orçamentos e sugere clientes com base em serviços.',
        systemPrompt:
          'Você é o assistente de orçamentos da JM Sistemas. Com base na descrição do serviço fornecida pelo usuário, gere itens de orçamento realistas e detalhados.',
        tier: 'fast',
        tools: [{ collection: 'clientes', perms: { read: true, list: true } }],
      })
    } catch (_) {}
  },
)
