/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const clientesCol = app.findCollectionByNameOrId('clientes')
    const emailField = clientesCol.fields.getByName('email')
    if (emailField) {
      emailField.required = false
      app.save(clientesCol)
    }
  },
  (app) => {
    try {
      const clientesCol = app.findCollectionByNameOrId('clientes')
      const emailField = clientesCol.fields.getByName('email')
      if (emailField) {
        emailField.required = true
        app.save(clientesCol)
      }
    } catch (_) {}
  },
)
