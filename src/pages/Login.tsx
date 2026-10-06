import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [forgotModalOpen, setForgotModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotFeedback, setForgotFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const isMountedRef = useRef(true)
  const forgotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (forgotTimerRef.current) {
        clearTimeout(forgotTimerRef.current)
      }
    }
  }, [])

  const { login, requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!email || !password) {
      setErrorMessage('Por favor, preencha todos os campos.')
      return
    }

    try {
      setLoading(true)
      await login(email, password)
      if (!isMountedRef.current) return
      toast({
        title: 'Bem-vindo(a) de volta!',
        description: 'Login realizado com sucesso.',
      })
      navigate('/dashboard')
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg =
        err instanceof Error ? err.message : 'Credenciais inválidas. Verifique seu e-mail e senha.'
      setErrorMessage(msg.includes('Failed to authenticate') ? 'E-mail ou senha incorretos.' : msg)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) return

    setForgotLoading(true)
    setForgotFeedback(null)

    try {
      const res = await requestPasswordReset(forgotEmail.trim())
      if (!isMountedRef.current) return

      if (res.error) {
        setForgotFeedback({
          type: 'error',
          message: res.error.message || 'Erro ao solicitar recuperação. Tente novamente.',
        })
        return
      }

      setForgotFeedback({
        type: 'success',
        message:
          'Se existir uma conta com este e-mail, enviamos o link de recuperação. Verifique sua caixa de entrada e a pasta de spam.',
      })

      toast({
        title: 'Solicitação processada',
        description:
          'Se houver conta cadastrada, o link de recuperação foi enviado para seu e-mail.',
      })

      // Fecha modal após alguns segundos para o usuário ver a confirmação
      if (forgotTimerRef.current) clearTimeout(forgotTimerRef.current)
      forgotTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return
        setForgotModalOpen(false)
        setForgotEmail('')
        setForgotFeedback(null)
      }, 4000)
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg = err instanceof Error ? err.message : 'Erro ao processar solicitação.'
      setForgotFeedback({
        type: 'error',
        message: msg,
      })
    } finally {
      if (isMountedRef.current) {
        setForgotLoading(false)
      }
    }
  }

  const handleOpenForgotModal = () => {
    setForgotFeedback(null)
    setForgotEmail(email || '')
    setForgotModalOpen(true)
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-[#0F172A] via-[#111C44] to-[#1E3A8A] text-white p-4 sm:p-6 md:p-8">
      {/* HEADER MONOGRAM */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between py-2">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-base shadow-lg">
            OF
          </div>
          <span className="font-bold text-lg text-white tracking-tight">OrçaFácil</span>
        </Link>
        <Link
          to="/signup"
          className="text-xs sm:text-sm text-slate-300 hover:text-white font-medium hover:underline"
        >
          Criar nova conta
        </Link>
      </div>

      {/* LOGIN CARD */}
      <div className="w-full max-w-[420px] mx-auto my-auto py-6">
        <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-100">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-md mb-2">
              OF
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              Feito para quem vive de serviço
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Acesse o OrçaFácil</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Orçamentos profissionais e gestão para prestadores de serviços de todos os segmentos
            </p>
          </div>

          {/* ERROR BANNER WITH SHAKE ANIMATION */}
          {errorMessage ? (
            <div
              key="login-error-banner"
              className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5 animate-shake-x"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                required
                className="h-10 rounded-lg text-sm border-slate-300 focus:border-blue-600 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Senha
                </Label>
                <button
                  type="button"
                  onClick={handleOpenForgotModal}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-10 rounded-lg text-sm pr-10 border-slate-300 focus:border-blue-600 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold text-sm rounded-lg shadow-md transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-600">
            Não possui uma conta?{' '}
            <Link to="/signup" className="text-blue-600 font-semibold hover:underline">
              Cadastre-se gratuitamente
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

      {/* MODAL ESQUECI MINHA SENHA */}
      <Dialog
        open={forgotModalOpen}
        onOpenChange={(open) => {
          setForgotModalOpen(open)
          if (!open) {
            setForgotFeedback(null)
          }
        }}
      >
        <DialogContent className="max-w-[420px] rounded-xl bg-white text-slate-900 p-6 shadow-xl border border-slate-200">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                OF
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Recuperar senha
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              Informe seu e-mail cadastrado. Se houver uma conta associada, você receberá um link
              seguro para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>

          {forgotFeedback && (
            <div
              className={`p-3 rounded-lg text-xs leading-relaxed flex items-start gap-2.5 ${
                forgotFeedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              <AlertCircle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  forgotFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              />
              <span>{forgotFeedback.message}</span>
            </div>
          )}

          {forgotFeedback?.type !== 'success' ? (
            <form onSubmit={handleForgotSubmit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-xs font-semibold text-slate-700">
                  E-mail da sua conta
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  required
                  className="h-10 text-sm border-slate-300 focus:border-blue-600"
                />
              </div>

              <div className="text-[11px] text-slate-500 leading-normal">
                🔒 Por segurança, não informamos se o e-mail está ou não cadastrado no sistema.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForgotModalOpen(false)}
                  disabled={forgotLoading}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={forgotLoading}
                  className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-xs font-medium"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Enviando link...
                    </>
                  ) : (
                    'Enviar link de recuperação'
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setForgotModalOpen(false)}
                className="text-xs"
              >
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
