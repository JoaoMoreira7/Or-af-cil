import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, AlertCircle, KeyRound, Sparkles, Check, Copy } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { evaluatePasswordStrength, generateStrongPassword } from '@/lib/passwordUtils'

export default function Signup() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [sugestaoAtiva, setSugestaoAtiva] = useState(false)
  const [senhaCopiada, setSenhaCopiada] = useState(false)

  const isMountedRef = useRef(true)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const { signup } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  // Medidor de força da senha em tempo real
  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password])

  // Ação de sugerir senha forte
  const handleSugerirSenha = () => {
    const novaSenha = generateStrongPassword(14)
    setPassword(novaSenha)
    setConfirmPassword(novaSenha)
    setShowPassword(true) // mostra a senha para o usuário poder conferir e anotar
    setSugestaoAtiva(true)
    setErrorMessage('')

    toast({
      title: 'Senha forte gerada!',
      description: 'Preenchemos a senha e a confirmação para você. Guarde-a em local seguro.',
    })
  }

  const handleCopiarSenha = async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setSenhaCopiada(true)
      toast({
        title: 'Senha copiada!',
        description: 'A senha gerada foi copiada para a sua área de transferência.',
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!nome.trim() || !email.trim() || !password) {
      setErrorMessage('Todos os campos são obrigatórios.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('A senha deve conter no mínimo 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.')
      return
    }

    try {
      setLoading(true)
      await signup(nome, email, password)
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Seja bem-vindo(a) ao OrçaFácil.',
      })
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Falha ao cadastrar usuário. Tente novamente.'
      setErrorMessage(msg.includes('email') ? 'Este e-mail já está em uso.' : msg)
    } finally {
      setLoading(false)
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
          Já tenho uma conta
        </Link>
      </div>

      {/* SIGNUP CARD */}
      <div className="w-full max-w-[440px] mx-auto my-auto py-6">
        <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-100">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-md mb-2">
              OF
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              Feito para quem vive de serviço
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Crie sua conta no OrçaFácil
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Para eletricistas, fotógrafos, marceneiros, diaristas, técnicos e todos os
              profissionais autônomos
            </p>
          </div>

          {errorMessage ? (
            <div
              key="signup-error-banner"
              className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5 animate-shake-x"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <form onSubmit={handleSignup} className="space-y-3.5">
            <div className="space-y-1">
              <Label htmlFor="nome" className="text-xs font-semibold text-slate-700">
                Nome completo
              </Label>
              <Input
                id="nome"
                type="text"
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                required
                className="h-10 rounded-lg text-sm border-slate-300 focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                E-mail profissional
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                required
                className="h-10 rounded-lg text-sm border-slate-300 focus:border-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Senha (mínimo 8 caracteres)
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
                  placeholder="Crie ou gere uma senha segura"
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
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

              {/* MEDIDOR DE FORÇA DA SENHA EM TEMPO REAL */}
              {password.length > 0 && (
                <div className="space-y-1.5 pt-1 animate-fade-in">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Força da senha:</span>
                    <span className={`font-bold ${passwordStrength.colorClass}`}>
                      {passwordStrength.label}
                    </span>
                  </div>

                  {/* BARRA DE FORÇA */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-1">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        passwordStrength.score >= 0 ? passwordStrength.bgClass : 'bg-slate-200'
                      }`}
                      style={{ width: `${passwordStrength.percent}%` }}
                    />
                  </div>

                  {/* DICAS CURTAS EM PT-BR */}
                  {passwordStrength.hints.length > 0 && (
                    <p className="text-[11px] text-slate-500 leading-tight">
                      {passwordStrength.hints[0]}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                Confirmar senha
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita sua senha"
                  required
                  className="h-10 rounded-lg text-sm pr-10 border-slate-300 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirmPassword ? 'Ocultar confirmação' : 'Exibir confirmação'}
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

            <div className="text-[11px] text-slate-500 pt-1">
              Ao se cadastrar, você concorda com os nossos{' '}
              <Link to="/termos-de-uso" target="_blank" className="text-blue-600 underline">
                Termos de Uso
              </Link>{' '}
              e nossa{' '}
              <Link
                to="/politica-de-privacidade"
                target="_blank"
                className="text-blue-600 underline"
              >
                Política de Privacidade
              </Link>
              .
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold text-sm rounded-lg shadow-md transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>

          <div className="mt-5 text-center text-xs text-slate-600">
            Já tem um cadastro?{' '}
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
