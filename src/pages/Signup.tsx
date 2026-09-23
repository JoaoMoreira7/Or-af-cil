import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Signup() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const { signup } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

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
        description: 'Seja bem-vindo(a) à plataforma JM Sistemas.',
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
            JM
          </div>
          <span className="font-bold text-lg text-white tracking-tight">JM Sistemas</span>
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
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-md mb-3">
              JM
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Crie sua conta</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Comece a criar orçamentos profissionais com IA hoje mesmo
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                required
                className="h-10 rounded-lg text-sm border-slate-300 focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                Senha (mínimo 8 caracteres)
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="h-10 rounded-lg text-sm pr-10 border-slate-300 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                Confirmar senha
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita sua senha"
                required
                className="h-10 rounded-lg text-sm border-slate-300 focus:border-blue-600"
              />
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
        <span>© {new Date().getFullYear()} JM Sistemas. Todos os direitos reservados.</span>
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
