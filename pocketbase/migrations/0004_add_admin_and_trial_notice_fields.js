/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Adicionar campo admin na coleção users
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('admin')) {
      usersCol.fields.add(
        new BoolField({
          name: 'admin',
          required: false,
        }),
      )
    }

    // Regras de acesso para users:
    // admin pode listar e visualizar todos os usuários; usuários comuns listam e visualizam apenas a si mesmos
    usersCol.listRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.admin = true)"
    usersCol.viewRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.admin = true)"
    app.save(usersCol)

    // 2. Adicionar campo aviso_teste_enviado na coleção planos
    const planosCol = app.findCollectionByNameOrId('planos')
    if (!planosCol.fields.getByName('aviso_teste_enviado')) {
      planosCol.fields.add(
        new BoolField({
          name: 'aviso_teste_enviado',
          required: false,
        }),
      )
    }

    // Regras de acesso para planos:
    // admin pode listar e visualizar todos os planos para o painel de administração
    planosCol.listRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.admin = true)"
    planosCol.viewRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.admin = true)"
    app.save(planosCol)

    // 3. Marcar conta demo jaocarloss@gmail.com como admin (idempotente)
    try {
      const demoUser = app.findAuthRecordByEmail('_pb_users_auth_', 'jaocarloss@gmail.com')
      demoUser.set('admin', true)
      app.save(demoUser)
    } catch (_) {}
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.listRule = 'id = @request.auth.id'
      usersCol.viewRule = 'id = @request.auth.id'
      const adminField = usersCol.fields.getByName('admin')
      if (adminField) {
        usersCol.fields.remove(adminField)
      }
      app.save(usersCol)
    } catch (_) {}

    try {
      const planosCol = app.findCollectionByNameOrId('planos')
      planosCol.listRule = "@request.auth.id != '' && user_id = @request.auth.id"
      planosCol.viewRule = "@request.auth.id != '' && user_id = @request.auth.id"
      const avisoField = planosCol.fields.getByName('aviso_teste_enviado')
      if (avisoField) {
        planosCol.fields.remove(avisoField)
      }
      app.save(planosCol)
    } catch (_) {}
  },
)
