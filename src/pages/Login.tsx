import React, { useState } from 'react'
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

  const { login } = useAuth()
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
      toast({
        title: 'Bem-vindo(a) de volta!',
        description: 'Login realizado com sucesso.',
      })
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Credenciais inválidas. Verifique seu e-mail e senha.'
      setErrorMessage(msg.includes('Failed to authenticate') ? 'E-mail ou senha incorretos.' : msg)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) return

    setForgotLoading(true)
    setTimeout(() => {
      setForgotLoading(false)
      setForgotModalOpen(false)
      setForgotEmail('')
      toast({
        title: 'Instruções enviadas!',
        description: 'Se o e-mail estiver cadastrado, você receberá o link de redefinição.',
      })
    }, 800)
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
                  onClick={() => setForgotModalOpen(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
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

          {/* Dica de acesso padrão */}
          <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 text-center">
            <span className="font-semibold text-slate-800">Acesso de demonstração:</span>
            <br />
            jaocarloss@gmail.com / Skip@Pass
          </div>

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
      <Dialog open={forgotModalOpen} onOpenChange={setForgotModalOpen}>
        <DialogContent className="max-w-[380px] rounded-xl bg-white text-slate-900 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Recuperar senha</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Digite seu e-mail cadastrado e enviaremos um link para criar uma nova senha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForgotSubmit} className="space-y-4 mt-3">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-xs font-semibold">
                E-mail
              </Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                required
                className="h-9 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForgotModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={forgotLoading}
                className="bg-blue-600 text-white"
              >
                {forgotLoading ? 'Enviando...' : 'Enviar link'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
