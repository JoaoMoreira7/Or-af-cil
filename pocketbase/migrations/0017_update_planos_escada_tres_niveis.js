/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const planosCol = app.findCollectionByNameOrId('planos')

    // 1. Atualizar select de 'plano' para incluir 'essencial', 'profissional', 'premium' mantendo compatibilidade
    const planoField = planosCol.fields.getByName('plano')
    if (planoField) {
      planoField.values = ['essencial', 'profissional', 'premium', 'starter', 'pro']
      app.save(planosCol)
    }

    // 2. Migrar usuários existentes no plano antigo (starter / pro) para 'essencial' automaticamente (mesmo valor R$ 49,90)
    // Mantendo status e renovacao intactos
    try {
      app
        .db()
        .newQuery(
          "UPDATE planos SET plano = 'essencial' WHERE plano = 'starter' OR plano IS NULL OR plano = ''",
        )
        .execute()
    } catch (err) {
      console.warn('Aviso ao migrar registros antigos de planos via SQL:', err)
    }

    // 3. Atualizar nome do plano nas vendas históricas que tinham Starter para Essencial
    try {
      app
        .db()
        .newQuery(
          "UPDATE pagamentos SET plano_nome = 'Essencial' WHERE plano_nome = 'Starter' OR plano_nome IS NULL",
        )
        .execute()
    } catch (errPag) {
      console.warn('Aviso ao atualizar pagamentos para Essencial:', errPag)
    }
  },
  (app) => {
    try {
      const planosCol = app.findCollectionByNameOrId('planos')
      const planoField = planosCol.fields.getByName('plano')
      if (planoField) {
        planoField.values = ['starter', 'pro']
        app.save(planosCol)
      }
    } catch (_) {}
  },
)
