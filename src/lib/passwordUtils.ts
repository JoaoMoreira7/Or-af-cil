export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 // 0: muito fraca, 1: fraca, 2: média, 3: forte
  label: 'Muito fraca' | 'Fraca' | 'Média' | 'Forte'
  colorClass: string
  bgClass: string
  percent: number
  hints: string[]
}

/**
 * Avalia a força da senha com regras claras em pt-BR:
 * - Comprimento (>=8, >=12)
 * - Letras minúsculas
 * - Letras maiúsculas
 * - Números
 * - Caracteres especiais/símbolos
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      score: 0,
      label: 'Muito fraca',
      colorClass: 'text-slate-400',
      bgClass: 'bg-slate-200',
      percent: 0,
      hints: ['Digite uma senha com no mínimo 8 caracteres.'],
    }
  }

  const length = password.length
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)

  const missing: string[] = []
  if (length < 8) {
    missing.push('no mínimo 8 caracteres')
  }
  if (!hasUpper) {
    missing.push('letras maiúsculas')
  }
  if (!hasLower) {
    missing.push('letras minúsculas')
  }
  if (!hasDigit) {
    missing.push('números')
  }
  if (!hasSpecial) {
    missing.push('símbolos (!@#$%)')
  }

  // Contagem de critérios atendidos
  let criteriaCount = 0
  if (hasLower) criteriaCount++
  if (hasUpper) criteriaCount++
  if (hasDigit) criteriaCount++
  if (hasSpecial) criteriaCount++

  if (length < 8) {
    return {
      score: 0,
      label: 'Muito fraca',
      colorClass: 'text-rose-600',
      bgClass: 'bg-rose-500',
      percent: 20,
      hints: [`Falta: ${missing.join(', ')}`],
    }
  }

  // 8+ caracteres
  if (criteriaCount <= 2 || length < 10) {
    return {
      score: 1,
      label: 'Fraca',
      colorClass: 'text-rose-500',
      bgClass: 'bg-rose-500',
      percent: 40,
      hints:
        missing.length > 0
          ? [`Adicione: ${missing.join(', ')}.`]
          : ['Aumente o tamanho para ficar mais segura.'],
    }
  }

  if (criteriaCount === 3 || length < 12) {
    return {
      score: 2,
      label: 'Média',
      colorClass: 'text-amber-500',
      bgClass: 'bg-amber-500',
      percent: 75,
      hints:
        missing.length > 0
          ? [`Quase lá! Adicione: ${missing.join(', ')}.`]
          : ['Boa senha! Adicione símbolos e mais letras para torná-la forte.'],
    }
  }

  // Forte: >=12 caracteres e todos ou quase todos os critérios atendidos
  return {
    score: 3,
    label: 'Forte',
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-500',
    percent: 100,
    hints: ['Excelente! Senha segura e protegida.'],
  }
}

/**
 * Gera uma senha forte e segura (14 caracteres) com:
 * - Maiúsculas (excluindo caracteres ambíguos)
 * - Minúsculas
 * - Números
 * - Símbolos seguros
 * Garante pelo menos 2 de cada categoria.
 */
export function generateStrongPassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sem I, O
  const lower = 'abcdefghijkmnopqrstuvwxyz' // sem l
  const numbers = '23456789' // sem 0, 1
  const symbols = '!@#$%&*+='

  const all = upper + lower + numbers + symbols

  const getRandom = (charset: string) => {
    const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : null
    if (cryptoObj?.getRandomValues) {
      const arr = new Uint32Array(1)
      cryptoObj.getRandomValues(arr)
      return charset[arr[0] % charset.length]
    }
    return charset[Math.floor(Math.random() * charset.length)]
  }

  // Garante diversidade mínima
  const chars: string[] = [
    getRandom(upper),
    getRandom(upper),
    getRandom(lower),
    getRandom(lower),
    getRandom(numbers),
    getRandom(numbers),
    getRandom(symbols),
    getRandom(symbols),
  ]

  // Completa o tamanho restante
  while (chars.length < length) {
    chars.push(getRandom(all))
  }

  // Embaralha com Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1))
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const randArr = new Uint32Array(1)
      window.crypto.getRandomValues(randArr)
      j = randArr[0] % (i + 1)
    }
    const temp = chars[i]
    chars[i] = chars[j]
    chars[j] = temp
  }

  return chars.join('')
}
