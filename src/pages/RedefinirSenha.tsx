import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Sparkles,
  Check,
  Copy,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { evaluatePasswordStrength, generateStrongPassword } from '@/lib/passwordUtils'

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get('token') || ''

  const [token, setToken] = useState(tokenFromUrl)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [sugestaoAtiva, setSugestaoAtiva] = useState(false)
  const [senhaCopiada, setSenhaCopiada] = useState(false)

  // Flag isMountedRef obrigatória da memória do projeto para evitar erros pós-unmount
  const isMountedRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { confirmPasswordReset, login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  // Sincroniza se o token mudar via query
  useEffect(() => {
    if (tokenFromUrl && tokenFromUrl !== token) {
      setToken(tokenFromUrl)
    }
  }, [tokenFromUrl, token])

  // Avaliação de força de senha em tempo real reutilizando passwordUtils
  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password])

  // Sugerir senha forte automática
  const handleSugerirSenha = () => {
    const novaSenha = generateStrongPassword(14)
    setPassword(novaSenha)
    setConfirmPassword(novaSenha)
    setShowPassword(true)
    setSugestaoAtiva(true)
    setErrorMessage('')

    toast({
      title: 'Senha forte gerada!',
      description: 'Preenchemos os campos de senha para você. Guarde-a em local seguro.',
    })
  }

  // Copiar senha sugerida
  const handleCopiarSenha = async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setSenhaCopiada(true)
      toast({
        title: 'Senha copiada!',
        description: 'A senha foi copiada para a área de transferência.',
      })
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setSenhaCopiada(false)
        }
      }, 2500)
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Selecione e copie a senha manualmente.',
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!token) {
      setErrorMessage(
        'Token de verificação ausente. Por favor, acesse o link enviado para o seu e-mail ou solicite um novo.',
      )
      return
    }

    if (!password || password.length < 8) {
      setErrorMessage('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.')
      return
    }

    setLoading(true)

    try {
      const res = await confirmPasswordReset(token, password)
      if (!isMountedRef.current) return

      if (res.error) {
        const msg = res.error.message || 'Falha ao redefinir a senha.'
        setErrorMessage(
          msg.includes('invalid') || msg.includes('token') || msg.includes('expirado')
            ? 'Link inválido ou expirado. Por favor, solicite um novo link de recuperação.'
            : msg,
        )
        return
      }

      setSucesso(true)
      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Sua nova senha já está valendo. Redirecionando para o login...',
      })

      // Redireciona com segurança verificando se ainda está montado
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          navigate('/login', { replace: true })
        }
      }, 3000)
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg = err instanceof Error ? err.message : 'Erro ao redefinir senha.'
      setErrorMessage(
        msg.includes('invalid') || msg.includes('token') || msg.includes('expirado')
          ? 'Link inválido ou expirado. Solicite um novo link de recuperação.'
          : msg,
      )
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-[#0F172A] via-[#111C44] to-[#1E3A8A] text-white p-4 sm:p-6 md:p-8">
      {/* HEADER */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between py-2">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-base shadow-lg">
            OF
          </div>
          <span className="font-bold text-lg text-white tracking-tight">OrçaFácil</span>
        </Link>
        <Link
          to="/login"
          className="text-xs sm:text-sm text-slate-300 hover:text-white font-medium hover:underline"
        >
          Voltar para o login
        </Link>
      </div>

      {/* CARD PRINCIPAL */}
      <div className="w-full max-w-[440px] mx-auto my-auto py-6">
        <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-100">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-md mb-2">
              OF
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              Segurança da Conta
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Redefinir sua senha
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Crie uma nova senha segura para acessar sua conta no OrçaFácil
            </p>
          </div>

          {/* SUCESSO */}
          {sucesso ? (
            <div className="space-y-5 py-3 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">Senha alterada com sucesso!</h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Sua conta já está com a nova senha atualizada. Você será redirecionado para o
                  login em instantes.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-sm"
              >
                Ir para o Login agora
              </Button>
            </div>
          ) : (
            <>
              {/* ERRO BANNER */}
              {errorMessage ? (
                <div
                  key="reset-error-banner"
                  className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5 animate-shake-x"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{errorMessage}</span>
                    {errorMessage.includes('inválido ou expirado') && (
                      <div className="mt-2">
                        <Link
                          to="/login"
                          className="font-semibold text-blue-700 underline hover:text-blue-900"
                        >
                          Voltar ao login e solicitar novo link
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* SEM TOKEN NA URL */}
              {!token ? (
                <div className="space-y-4 py-2">
                  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                    <p className="font-semibold mb-1">Link de redefinição não identificado</p>
                    <p>
                      Para redefinir sua senha, clique no link recebido no seu e-mail. Se ainda não
                      solicitou, acesse a tela de login e clique em "Esqueci minha senha".
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      Ir para a tela de login
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                        Nova senha (mínimo 8 caracteres)
                      </Label>
                      <button
                        type="button"
                        onClick={handleSugerirSenha}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors focus:outline-none"
                        title="Gera uma senha forte e segura automaticamente"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                        <span>Sugerir senha forte</span>
                      </button>
                    </div>

                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          setSugestaoAtiva(false)
                        }}
                        placeholder="Digite sua nova senha"
                        required
                        className="h-10 rounded-lg text-sm pr-20 border-slate-300 focus:border-blue-600"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {password && (
                          <button
                            type="button"
                            onClick={handleCopiarSenha}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copiar senha"
                            aria-label="Copiar senha"
                          >
                            {senhaCopiada ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors"
                          aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* AVISO QUANDO UMA SENHA FOI GERADA AUTOMATICAMENTE */}
                    {sugestaoAtiva && (
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-[11px] text-blue-800 animate-fade-in">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
                          Senha forte preenchida nos dois campos.
                        </span>
                        <button
                          type="button"
                          onClick={handleCopiarSenha}
                          className="font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
                        >
                          {senhaCopiada ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    )}

                    {/* MEDIDOR DE FORÇA DA SENHA */}
                    {password.length > 0 && (
                      <div className="space-y-1.5 pt-1 animate-fade-in">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Força da senha:</span>
                          <span className={`font-bold ${passwordStrength.colorClass}`}>
                            {passwordStrength.label}
                          </span>
                        </div>

                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-1">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              passwordStrength.score >= 0
                                ? passwordStrength.bgClass
                                : 'bg-slate-200'
                            }`}
                            style={{ width: `${passwordStrength.percent}%` }}
                          />
                        </div>

                        {passwordStrength.hints.length > 0 && (
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {passwordStrength.hints[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor="confirmPassword"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Confirmar nova senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                        required
                        className="h-10 rounded-lg text-sm pr-10 border-slate-300 focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={
                          showConfirmPassword ? 'Ocultar confirmação' : 'Exibir confirmação'
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <p className="text-[11px] text-rose-500 mt-1">As senhas não coincidem.</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !password || password !== confirmPassword}
                    className="w-full h-10 mt-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold text-sm rounded-lg shadow-md transition-all active:scale-[0.98]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Atualizando senha...
                      </>
                    ) : (
                      'Salvar nova senha'
                    )}
                  </Button>
                </form>
              )}
            </>
          )}

          <div className="mt-5 text-center text-xs text-slate-600">
            Lembrou da senha antiga?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">
              Fazer login
            </Link>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="w-full max-w-6xl mx-auto py-3 text-center text-xs text-slate-400 flex flex-wrap items-center justify-center gap-4">
        <span>© {new Date().getFullYear()} OrçaFácil. Todos os direitos reservados.</span>
        <span className="text-slate-600">•</span>
        <Link to="/termos-de-uso" className="hover:text-slate-200 underline">
          Termos de Uso
        </Link>
        <span className="text-slate-600">•</span>
        <Link to="/politica-de-privacidade" className="hover:text-slate-200 underline">
          Política de Privacidade
        </Link>
      </footer>
    </div>
  )
}
