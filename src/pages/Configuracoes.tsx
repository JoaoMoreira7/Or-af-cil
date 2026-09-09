import React, { useState } from 'react'
import { User, Lock, Save, Loader2, Check, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Configuracoes() {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()

  // Profile Form
  const [name, setName] = useState(user?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password Form
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Por favor, informe seu nome completo.',
      })
      return
    }

    setSavingProfile(true)
    try {
      await updateUser({ name: name.trim() })
      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações cadastrais foram salvas com sucesso.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar perfil'
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: msg,
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('Preencha todos os campos de senha.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('A nova senha e a confirmação não coincidem.')
      return
    }

    if (!user?.id) return

    setSavingPassword(true)
    try {
      await pb.collection('users').update(user.id, {
        oldPassword,
        password: newPassword,
        passwordConfirm: confirmPassword,
      })

      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')

      toast({
        title: 'Senha alterada com sucesso',
        description: 'Sua nova senha já está valendo para os próximos acessos.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao alterar senha'
      setPasswordError(msg.includes('oldPassword') ? 'Senha atual incorreta.' : msg)
    } finally {
      setSavingPassword(false)
    }
  }

  const getInitials = (n?: string) => {
    if (!n) return 'JM'
    return n
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
  }

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in-up">
      {/* HEADER */}
      <div className="pb-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Configurações da Conta</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Gerencie seus dados pessoais, perfil de exibição e credenciais de segurança
        </p>
      </div>

      {/* CARD DE PERFIL */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-violet-600 text-white font-black text-lg flex items-center justify-center shadow">
            {getInitials(user?.name)}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{user?.name || 'Usuário'}</h3>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4 mt-5">
          <div className="space-y-1.5">
            <Label htmlFor="user-name" className="text-xs font-semibold text-slate-700">
              Nome de Exibição
            </Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              className="h-10 text-sm max-w-md"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-email" className="text-xs font-semibold text-slate-700">
              E-mail (Somente leitura)
            </Label>
            <Input
              id="user-email"
              value={user?.email || ''}
              disabled
              className="h-10 text-sm max-w-md bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-400">
              Para alterar seu e-mail de acesso, entre em contato com nosso suporte técnico.
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={savingProfile}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg"
            >
              {savingProfile ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* CARD DE SEGURANÇA E ALTERAÇÃO DE SENHA */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
          <Shield className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Segurança & Senha</h3>
            <p className="text-xs text-slate-500">
              Mantenha sua conta protegida com uma senha forte
            </p>
          </div>
        </div>

        {passwordError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {passwordError}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4 mt-5">
          <div className="space-y-1.5">
            <Label htmlFor="old-pass" className="text-xs font-semibold text-slate-700">
              Senha atual
            </Label>
            <Input
              id="old-pass"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 text-sm max-w-md"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-pass" className="text-xs font-semibold text-slate-700">
              Nova senha (mínimo 8 caracteres)
            </Label>
            <Input
              id="new-pass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 text-sm max-w-md"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pass" className="text-xs font-semibold text-slate-700">
              Confirmar nova senha
            </Label>
            <Input
              id="confirm-pass"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 text-sm max-w-md"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={savingPassword}
              className="h-9 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg"
            >
              {savingPassword ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Alterando senha...
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  Alterar Senha
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
