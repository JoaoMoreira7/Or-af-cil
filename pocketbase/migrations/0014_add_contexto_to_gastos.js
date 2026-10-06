/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Adicionar campo 'contexto' na coleção 'gastos' (valores: 'empresa', 'pessoal', maxSelect: 1)
    try {
      const gastosCol = app.findCollectionByNameOrId('gastos')
      if (!gastosCol.fields.getByName('contexto')) {
        gastosCol.fields.add(
          new SelectField({
            name: 'contexto',
            required: false,
            values: ['empresa', 'pessoal'],
            maxSelect: 1,
          }),
        )
        app.save(gastosCol)
      }
    } catch (e) {
      console.log('Erro ao adicionar campo contexto em gastos:', e)
    }

    // 2. Preencher registros existentes de 'gastos' com contexto = 'empresa' (padrão)
    try {
      app
        .db()
        .newQuery("UPDATE gastos SET contexto = 'empresa' WHERE contexto IS NULL OR contexto = ''")
        .execute()
    } catch (e) {
      console.log('Erro ao atualizar contexto padrão dos gastos existentes:', e)
    }

    // 3. Adicionar índice em gastos (contexto)
    try {
      const gastosCol = app.findCollectionByNameOrId('gastos')
      gastosCol.addIndex('idx_gastos_contexto', false, 'contexto', '')
      app.save(gastosCol)
    } catch (e) {
      console.log('Erro ao adicionar índice idx_gastos_contexto:', e)
    }

    // 4. Adicionar campo 'contexto_gasto_padrao' em 'preferencias_ia'
    try {
      const prefCol = app.findCollectionByNameOrId('preferencias_ia')
      if (!prefCol.fields.getByName('contexto_gasto_padrao')) {
        prefCol.fields.add(
          new SelectField({
            name: 'contexto_gasto_padrao',
            required: false,
            values: ['empresa', 'pessoal'],
            maxSelect: 1,
          }),
        )
        app.save(prefCol)
      }
    } catch (e) {
      console.log('Erro ao adicionar campo contexto_gasto_padrao em preferencias_ia:', e)
    }

    // 5. Preencher preferencias_ia existentes com contexto_gasto_padrao = 'empresa' se nulo
    try {
      app
        .db()
        .newQuery(
          "UPDATE preferencias_ia SET contexto_gasto_padrao = 'empresa' WHERE contexto_gasto_padrao IS NULL OR contexto_gasto_padrao = ''",
        )
        .execute()
    } catch (e) {
      console.log('Erro ao atualizar contexto_gasto_padrao em preferencias_ia:', e)
    }
  },
  (app) => {
    try {
      const gastosCol = app.findCollectionByNameOrId('gastos')
      gastosCol.removeIndex('idx_gastos_contexto')
      const campoContexto = gastosCol.fields.getByName('contexto')
      if (campoContexto) {
        gastosCol.fields.remove(campoContexto)
      }
      app.save(gastosCol)
    } catch (_) {}

    try {
      const prefCol = app.findCollectionByNameOrId('preferencias_ia')
      const campoPadrao = prefCol.fields.getByName('contexto_gasto_padrao')
      if (campoPadrao) {
        prefCol.fields.remove(campoPadrao)
      }
      app.save(prefCol)
    } catch (_) {}
  },
)
