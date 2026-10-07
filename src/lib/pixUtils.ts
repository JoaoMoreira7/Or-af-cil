/**
 * Utilitários de validação, sanitização e cálculo de CRC16 para PIX BR Code (EMVCo MPM).
 *
 * Especificação do Banco Central do Brasil:
 * - O payload sempre inicia com "00020101" ou "000201" (Payload Format Indicator: 00 com 02 chars "01").
 * - O payload termina obrigatoriamente com o campo 63 (CRC16): ID "63" + tamanho "04" + 4 caracteres hexadecimais em MAIÚSCULAS.
 * - Algoritmo: CRC16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF, sem reflexão de entrada/saída, sem XOR final).
 * - O CRC é calculado sobre toda a string ATÉ e INCLUINDO o prefixo "6304".
 */

/**
 * Calcula o checksum CRC16/CCITT-FALSE de uma string.
 */
export function calcularCrc16CcittFalse(str: string): string {
  let crc = 0xffff
  const polynomial = 0x1021

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    crc ^= (c & 0xff) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Remove espaços em branco, quebras de linha (\r, \n), pontos ou caracteres extras acidentais
 * no início ou no fim, ou quebras de linha internas.
 */
export function sanitizarPixPayload(payload: string): string {
  if (!payload || typeof payload !== 'string') return ''

  // 1. Remove quebras de linha internas e caracteres de controle
  let limpo = payload.replace(/[\r\n\t]+/g, '').trim()

  // 2. Remove pontuações acidentais no fim (ex: " .", ".", etc.)
  limpo = limpo.replace(/[\s.]+$/, '').trim()

  // 3. Localiza se existe o padrão "6304" seguido de 4 caracteres hexadecimais
  // Se houver lixo depois do CRC (ex: "6304B788 ."), corta exatamente no fim do CRC de 4 chars
  const matchCrc = limpo.match(/6304[0-9A-Fa-f]{4}/)
  if (matchCrc && matchCrc.index !== undefined) {
    const fimCrc = matchCrc.index + 8 // "6304" (4) + CRC (4)
    if (limpo.length > fimCrc) {
      limpo = limpo.slice(0, fimCrc)
    }
  }

  return limpo
}

export interface ValidacaoPixResultado {
  valido: boolean
  payloadSanitizado: string
  crcAtual: string
  crcEsperado: string
  crcCorreto: boolean
  motivo?: string
}

/**
 * Valida minuciosamente um payload PIX BR Code:
 * - Começa com 000201
 * - Contém 6304 + 4 hex chars no final
 * - Compara o CRC16 gravado com o CRC16 calculado
 */
export function validarPixPayload(rawPayload: string): ValidacaoPixResultado {
  const payload = sanitizarPixPayload(rawPayload)

  if (!payload) {
    return {
      valido: false,
      payloadSanitizado: '',
      crcAtual: '',
      crcEsperado: '',
      crcCorreto: false,
      motivo: 'Código PIX vazio ou ausente.',
    }
  }

  if (!payload.startsWith('000201')) {
    return {
      valido: false,
      payloadSanitizado: payload,
      crcAtual: '',
      crcEsperado: '',
      crcCorreto: false,
      motivo: 'Código PIX não inicia com o identificador padrão "000201".',
    }
  }

  // O payload precisa ter o campo 6304 no final
  const idx6304 = payload.lastIndexOf('6304')
  if (idx6304 === -1 || idx6304 !== payload.length - 8) {
    return {
      valido: false,
      payloadSanitizado: payload,
      crcAtual: '',
      crcEsperado: '',
      crcCorreto: false,
      motivo: 'Formato inválido: campo de verificação de redundância (6304) não localizado no fim.',
    }
  }

  const crcAtual = payload.slice(idx6304 + 4).toUpperCase()
  if (!/^[0-9A-F]{4}$/.test(crcAtual)) {
    return {
      valido: false,
      payloadSanitizado: payload,
      crcAtual,
      crcEsperado: '',
      crcCorreto: false,
      motivo: 'Checksum CRC16 não contém 4 dígitos hexadecimais válidos.',
    }
  }

  // String para cálculo do CRC: tudo até o "6304" inclusive
  const parteParaCrc = payload.slice(0, idx6304 + 4)
  const crcEsperado = calcularCrc16CcittFalse(parteParaCrc)

  const crcCorreto = crcAtual === crcEsperado

  if (!crcCorreto) {
    return {
      valido: false,
      payloadSanitizado: payload,
      crcAtual,
      crcEsperado,
      crcCorreto: false,
      motivo: `Verificação de Redundância Cíclica (CRC) divergente: código possui ${crcAtual}, mas o esperado era ${crcEsperado}.`,
    }
  }

  return {
    valido: true,
    payloadSanitizado: payload,
    crcAtual,
    crcEsperado,
    crcCorreto: true,
  }
}

/**
 * Garante que um payload PIX esteja sanitizado e com o CRC16 correto.
 * Se o CRC estiver ausente ou corrompido, recalcula e anexa o CRC16 correto.
 */
export function normalizarOuRepararPixPayload(rawPayload: string): {
  payload: string
  reparado: boolean
  crc: string
} {
  const sanitizado = sanitizarPixPayload(rawPayload)
  if (!sanitizado) {
    return { payload: '', reparado: false, crc: '' }
  }

  const validacao = validarPixPayload(sanitizado)
  if (validacao.valido) {
    return {
      payload: validacao.payloadSanitizado,
      reparado: false,
      crc: validacao.crcAtual,
    }
  }

  // Tenta reparar caso tenha sido truncado ou o CRC tenha divergido
  const idx6304 = sanitizado.lastIndexOf('6304')
  let baseParaCrc = sanitizado
  if (idx6304 !== -1) {
    baseParaCrc = sanitizado.slice(0, idx6304 + 4)
  } else {
    baseParaCrc = sanitizado + '6304'
  }

  const novoCrc = calcularCrc16CcittFalse(baseParaCrc)
  const payloadReparado = baseParaCrc + novoCrc

  return {
    payload: payloadReparado,
    reparado: true,
    crc: novoCrc,
  }
}
