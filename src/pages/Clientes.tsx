import React, { useState, useEffect } from 'react'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Building,
  MapPin,
  Loader2,
  AlertTriangle,
  Mic,
  Sparkles,
  Check,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { clientesService } from '@/services/clientes'
import { aiInterpretarService } from '@/services/aiInterpretar'
import { Cliente, formatarData } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { VoiceRecorder } from '@/components/VoiceRecorder'

interface FormErrors {
  nome?: string
  email?: string
  telefone?: string
  empresa?: string
  endereco?: string
}

export default function Clientes() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Novo/Editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Cliente | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [endereco, setEndereco] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  // Estado de IA por Voz no Modal de Cliente
  const [voiceInterpreting, setVoiceInterpreting] = useState(false)
  const [lastVoiceTranscript, setLastVoiceTranscript] = useState('')

  // Modal Exclusão
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchClientes = async () => {
    try {
      const lista = await clientesService.listar()
      setClientes(lista)
    } catch (err) {
      console.error('Erro ao listar clientes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClientes()
  }, [])

  useRealtime('clientes', () => {
    fetchClientes()
  })

  const handleOpenCreate = () => {
    setEditingClient(null)
    setNome('')
    setEmail('')
    setTelefone('')
    setEmpresa('')
    setEndereco('')
    setErrors({})
    setLastVoiceTranscript('')
    setModalOpen(true)
  }

  const handleOpenEdit = (cliente: Cliente) => {
    setEditingClient(cliente)
    setNome(cliente.nome)
    setEmail(cliente.email)
    setTelefone(cliente.telefone || '')
    setEmpresa(cliente.empresa || '')
    setEndereco(cliente.endereco || '')
    setErrors({})
    setLastVoiceTranscript('')
    setModalOpen(true)
  }

  // Preenchimento de Cliente via Áudio estilo WhatsApp
  const handleVoiceClientTranscript = async (transcription: string) => {
    if (!transcription.trim()) return

    setVoiceInterpreting(true)
    setLastVoiceTranscript(transcription)

    try {
      const res = await aiInterpretarService.interpretar({
        transcricao: transcription,
        contexto: 'cliente',
        userId: user?.id,
      })

      const extraido = res.interpretacao?.cliente_novo

      if (extraido) {
        if (extraido.nome) setNome(extraido.nome)
        if (extraido.email) setEmail(extraido.email)
        if (extraido.telefone) setTelefone(extraido.telefone)
        if (extraido.empresa) setEmpresa(extraido.empresa)
        if (extraido.endereco) setEndereco(extraido.endereco)

        toast({
          title: 'Dados preenchidos pela IA!',
          description: `Identificado: ${extraido.nome || 'Cliente'}. Revise os campos antes de salvar.`,
        })
      } else {
        toast({
          title: 'Áudio processado',
          description: 'A IA tentou mapear os dados. Preencha os campos faltantes.',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar áudio'
      toast({
        variant: 'destructive',
        title: 'Erro na interpretação de voz',
        description: msg,
      })
    } finally {
      setVoiceInterpreting(false)
    }
  }

  const validateForm = (): boolean => {
    const errs: FormErrors = {}
    if (!nome.trim()) {
      errs.nome = 'O nome do cliente é obrigatório.'
    }
    if (!email.trim()) {
      errs.email = 'O e-mail é obrigatório.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Digite um e-mail válido (ex: nome@dominio.com).'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    if (!user?.id) return

    setSubmitting(true)
    try {
      if (editingClient) {
        await clientesService.atualizar(editingClient.id, {
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim(),
          empresa: empresa.trim(),
          endereco: endereco.trim(),
        })
        toast({
          title: 'Cliente atualizado',
          description: 'Os dados do cliente foram salvos com sucesso.',
        })
      } else {
        await clientesService.criar({
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim(),
          empresa: empresa.trim(),
          endereco: endereco.trim(),
          user_id: user.id,
        })
        toast({
          title: 'Cliente cadastrado',
          description: 'Novo cliente adicionado com sucesso à sua base.',
        })
      }
      setModalOpen(false)
      fetchClientes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar cliente.'
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: msg,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      await clientesService.excluir(deleteTarget.id)
      toast({
        title: 'Cliente excluído',
        description: `O cliente "${deleteTarget.nome}" foi removido com sucesso.`,
      })
      setDeleteTarget(null)
      fetchClientes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao tentar excluir cliente.'
      toast({
        variant: 'destructive',
        title: 'Não foi possível excluir',
        description: msg,
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Clientes</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {clientes.length}{' '}
            {clientes.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'} na sua base
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-medium rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Cliente
        </Button>
      </div>

      {/* CONTENT: TABLE DESKTOP / CARDS MOBILE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Nenhum cliente cadastrado ainda</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Cadastre seus clientes manualmente ou por áudio WhatsApp para associá-los a orçamentos
              gerados com inteligência artificial.
            </p>
            <Button
              onClick={handleOpenCreate}
              className="bg-gradient-to-r from-blue-600 to-violet-600 text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar primeiro cliente
            </Button>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="py-3 px-6">Nome</th>
                    <th className="py-3 px-6">Email</th>
                    <th className="py-3 px-6">Telefone</th>
                    <th className="py-3 px-6">Empresa</th>
                    <th className="py-3 px-6">Criado em</th>
                    <th className="py-3 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-slate-900">{c.nome}</td>
                      <td className="py-3.5 px-6 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.email}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-slate-600">
                        {c.telefone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.telefone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600">
                        {c.empresa ? (
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.empresa}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-slate-500 tabular-nums">
                        {formatarData(c.created)}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Editar cliente"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Excluir cliente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="md:hidden divide-y divide-slate-100">
              {clientes.map((c) => (
                <div key={c.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm">{c.nome}</h4>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 text-slate-500 hover:text-blue-600"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 text-slate-500 hover:text-red-600"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{c.email}</span>
                    </div>
                    {c.telefone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{c.telefone}</span>
                      </div>
                    )}
                    {c.empresa && (
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{c.empresa}</span>
                      </div>
                    )}
                    {c.endereco && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.endereco}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL NOVO / EDITAR CLIENTE */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[540px] rounded-2xl bg-white text-slate-900 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center justify-between">
              <span>{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha os dados ou grave um áudio WhatsApp com as informações do cliente.
            </DialogDescription>
          </DialogHeader>

          {/* ATALHO DE ÁUDIO ESTILO WHATSAPP PARA PREENCHER CLIENTE */}
          <div className="mt-1 mb-2">
            <VoiceRecorder
              compact
              isProcessing={voiceInterpreting}
              placeholder="Fale: 'Cliente novo Maria Souza, fone 11 98888-7777, empresa Padaria Real...'"
              onSendTranscript={handleVoiceClientTranscript}
            />
            {voiceInterpreting && (
              <div className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5 font-medium animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Assimulando áudio e preenchendo os dados do cliente...</span>
              </div>
            )}
            {lastVoiceTranscript && !voiceInterpreting && (
              <p className="mt-1 text-[11px] text-slate-500 italic">
                Último áudio: &ldquo;{lastVoiceTranscript}&rdquo;
              </p>
            )}
          </div>

          <form onSubmit={handleSaveClient} className="space-y-3.5 mt-2">
            <div className="space-y-1">
              <Label htmlFor="c-nome" className="text-xs font-semibold">
                Nome completo *
              </Label>
              <Input
                id="c-nome"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value)
                  if (errors.nome) setErrors((prev) => ({ ...prev, nome: undefined }))
                }}
                placeholder="Ex: Maria Oliveira"
                className={`h-10 text-sm ${errors.nome ? 'border-red-500' : ''}`}
              />
              {errors.nome && <p className="text-[11px] text-red-600">{errors.nome}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="c-email" className="text-xs font-semibold">
                E-mail *
              </Label>
              <Input
                id="c-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                }}
                placeholder="cliente@exemplo.com"
                className={`h-10 text-sm ${errors.email ? 'border-red-500' : ''}`}
              />
              {errors.email && <p className="text-[11px] text-red-600">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="c-telefone" className="text-xs font-semibold">
                  Telefone
                </Label>
                <Input
                  id="c-telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="c-empresa" className="text-xs font-semibold">
                  Empresa
                </Label>
                <Input
                  id="c-empresa"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Nome da empresa"
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="c-endereco" className="text-xs font-semibold">
                Endereço
              </Label>
              <Input
                id="c-endereco"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro, cidade - UF"
                className="h-10 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="h-9 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || voiceInterpreting}
                className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Cliente'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO CONFIRMAÇÃO EXCLUSÃO */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[420px] rounded-2xl bg-white text-slate-900 p-6">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Excluir Cliente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir o cliente <strong>{deleteTarget?.nome}</strong>? Se
              houver orçamentos vinculados a ele, a exclusão será bloqueada pelo sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel disabled={deleting} className="h-9 text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
