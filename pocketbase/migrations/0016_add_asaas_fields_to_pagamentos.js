/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const pagamentos = app.findCollectionByNameOrId('pagamentos')

    if (!pagamentos.fields.getByName('asaas_id')) {
      pagamentos.fields.add(
        new TextField({
          name: 'asaas_id',
          required: false,
        }),
      )
    }

    if (!pagamentos.fields.getByName('asaas_customer_id')) {
      pagamentos.fields.add(
        new TextField({
          name: 'asaas_customer_id',
          required: false,
        }),
      )
    }

    if (!pagamentos.fields.getByName('pix_qr_code_url')) {
      pagamentos.fields.add(
        new TextField({
          name: 'pix_qr_code_url',
          required: false,
        }),
      )
    }

    if (!pagamentos.fields.getByName('pix_copia_cola')) {
      pagamentos.fields.add(
        new TextField({
          name: 'pix_copia_cola',
          required: false,
        }),
      )
    }

    if (!pagamentos.fields.getByName('invoice_url')) {
      pagamentos.fields.add(
        new TextField({
          name: 'invoice_url',
          required: false,
        }),
      )
    }

    if (!pagamentos.fields.getByName('pago_em')) {
      pagamentos.fields.add(
        new DateField({
          name: 'pago_em',
          required: false,
        }),
      )
    }

    pagamentos.addIndex('idx_pagamentos_asaas_id', false, 'asaas_id', '')

    app.save(pagamentos)
  },
  (app) => {
    try {
      const pagamentos = app.findCollectionByNameOrId('pagamentos')
      pagamentos.removeIndex('idx_pagamentos_asaas_id')
      pagamentos.fields.removeByName('asaas_id')
      pagamentos.fields.removeByName('asaas_customer_id')
      pagamentos.fields.removeByName('pix_qr_code_url')
      pagamentos.fields.removeByName('pix_copia_cola')
      pagamentos.fields.removeByName('invoice_url')
      pagamentos.fields.removeByName('pago_em')
      app.save(pagamentos)
    } catch (_) {}
  },
)
