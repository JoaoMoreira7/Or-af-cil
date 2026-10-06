import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tente novamente.'
  }

  const fieldErrors = extractFieldErrors(error)
  const data = error.response?.data as
    | Record<string, { code?: string; message?: string }>
    | undefined

  // Traduções amigáveis de mensagens por campo
  if (data?.email || fieldErrors.email) {
    const emailMsg = fieldErrors.email || data?.email?.message || ''
    const emailCode = data?.email?.code || ''
    if (
      emailCode === 'validation_not_unique' ||
      emailMsg.toLowerCase().includes('unique') ||
      emailMsg.toLowerCase().includes('already')
    ) {
      return 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.'
    }
    if (emailCode === 'validation_is_email' || emailMsg.toLowerCase().includes('valid')) {
      return 'Informe um endereço de e-mail válido.'
    }
    return 'E-mail inválido ou já em uso.'
  }

  if (data?.password || fieldErrors.password) {
    return 'A senha deve conter no mínimo 8 caracteres.'
  }

  if (data?.passwordConfirm || fieldErrors.passwordConfirm) {
    return 'A confirmação de senha não confere.'
  }

  if (data?.verified || fieldErrors.verified) {
    return 'Não foi possível validar o cadastro. Tente novamente.'
  }

  const msgs = Object.values(fieldErrors)
  if (msgs.length > 0) {
    return msgs.join(' ')
  }

  // Traduções das mensagens genéricas do PocketBase
  const rawMsg = error.message || ''
  if (rawMsg.includes('Failed to create record') || rawMsg.includes('validation')) {
    return 'Não foi possível criar sua conta. Verifique os dados informados e tente novamente.'
  }
  if (rawMsg.includes('Failed to authenticate')) {
    return 'E-mail ou senha incorretos.'
  }

  return 'Não foi possível concluir o cadastro. Verifique os dados e tente novamente.'
}
