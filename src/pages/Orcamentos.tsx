import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Sparkles,
  Mic,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
} from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { orcamentosService } from '@/services/orcamentos'
import { aiInterpretarService } from '@/services/aiInterpretar'
import {
  Orçamento,
  formatarMoedaBRL,
  formatarData,
  ComandoStatusExtraido,
  OrçamentoStatus,
} from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useToast } from '@/hooks/use-toast'

export default function Orcamentos() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [orcamentos, setOrcamentos] = useState<Orçamento[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [ordenacao, setOrdenacao] = useState('recentes')

  // Controle de comando de voz para alteração de status
  const [voiceInterpreting, setVoiceInterpreting] = useState(false)
  const [comandoPendente, setComandoPendente] = useState<ComandoStatusExtraido | null>(null)
  const [applyingStatus, setApplyingStatus] = useState(false)

  const fetchOrcamentos = async () => {
    try {
      const lista = await orcamentosService.listar({
        filtroStatus: statusFiltro,
        busca,
        ordenacao,
      })
      setOrcamentos(lista)
    } catch (err) {
      console.error('Erro ao listar orçamentos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrcamentos()
  }, [statusFiltro, ordenacao])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrcamentos()
    }, 250)
    return () => clearTimeout(timer)
  }, [busca])

  useRealtime('orcamentos', () => {
    fetchOrcamentos()
  })

  // Interpretar comando de voz de alteração de status
  const handleVoiceCommand = async (transcript: string) => {
    if (!transcript.trim()) return

    setVoiceInterpreting(true)
    try {
      const res = await aiInterpretarService.interpretar({
        transcricao: transcript,
        contexto: 'comando_status',
      })

      const comando = res.interpretacao?.comando_status

      if (comando && comando.orcamento_id && comando.novo_status) {
        setComandoPendente(comando)
      } else if (res.interpretacao?.intencao_detectada === 'orcamento') {
        // Se a fala era de criação de orçamento, oferece ir pro formulário
        toast({
          title: 'Detectado pedido de orçamento',
          description: 'Redirecionando para preenchimento com IA...',
        })
        navigate('/orcamentos/novo', {
          state: {
            textoReaproveitado: transcript,
            interpretacaoSalva: res.interpretacao,
          },
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Não foi possível identificar o orçamento ou o status',
          description:
            'Tente dizer algo como: "marcar o orçamento 3 como aprovado" ou "mudar proposta #001 para enviado".',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao interpretar comando'
      toast({
        variant: 'destructive',
        title: 'Erro de voz',
        description: msg,
      })
    } finally {
      setVoiceInterpreting(false)
    }
  }

  // Executar a alteração de status confirmada
  const handleConfirmStatusChange = async () => {
    if (!comandoPendente?.orcamento_id || !comandoPendente?.novo_status) return

    setApplyingStatus(true)
    try {
      await orcamentosService.atualizarStatus(
        comandoPendente.orcamento_id,
        comandoPendente.novo_status as OrçamentoStatus,
      )
      toast({
        title: 'Status atualizado com sucesso!',
        description: `O orçamento ${comandoPendente.orcamento_numero || ''} agora está como "${comandoPendente.novo_status}".`,
      })
      setComandoPendente(null)
      fetchOrcamentos()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar status'
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar status',
        description: msg,
      })
    } finally {
      setApplyingStatus(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Orçamentos</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gerencie propostas comerciais, emita propostas com IA e acompanhe conversões
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/modo-voz')}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 text-xs sm:text-sm"
          >
            <Smartphone className="w-4 h-4 mr-1.5" />
            Modo Só Falar
          </Button>

          <Button
            onClick={() => navigate('/orcamentos/novo')}
            className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-medium rounded-lg shadow-sm text-xs sm:text-sm"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Novo Orçamento com IA
          </Button>
        </div>
      </div>

      {/* BARRA DE COMANDO DE VOZ RÁPIDO PARA ORÇAMENTOS (STATUS E AÇÕES) */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/80 rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                Comando de Voz Rápido: Mudar Status por Voz
              </h4>
              <p className="text-[11px] text-slate-500">
                Fale comandos como: &ldquo;marcar o orçamento 3 como aprovado&rdquo; ou
                &ldquo;colocar o orçamento da Maria como enviado&rdquo;.
              </p>
            </div>
          </div>

          {voiceInterpreting && (
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-100/80 px-3 py-1 rounded-full self-start sm:self-auto">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Identificando orçamento e status...</span>
            </div>
          )}
        </div>

        <VoiceRecorder
          compact
          isProcessing={voiceInterpreting}
          placeholder="Ex: 'Marcar o orçamento #001 como aprovado' ou 'Cancelar orçamento 2'..."
          onSendTranscript={handleVoiceCommand}
        />
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, número (#001) ou descrição..."
            className="h-9 pl-9 text-xs sm:text-sm bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2.5">
          {/* Status Select */}
          <div className="w-[150px] shrink-0">
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="h-9 text-xs">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ordenação Select */}
          <div className="w-[160px] shrink-0">
            <Select value={ordenacao} onValueChange={setOrdenacao}>
              <SelectTrigger className="h-9 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <SelectValue placeholder="Ordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="antigos">Mais antigos</SelectItem>
                <SelectItem value="maior_valor">Maior valor</SelectItem>
                <SelectItem value="menor_valor">Menor valor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* LIST SECTION: TABLE (DESKTOP) / CARDS (MOBILE) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : orcamentos.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Nenhum orçamento encontrado</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Não encontramos orçamentos com os critérios selecionados. Crie uma nova proposta agora
              mesmo.
            </p>
            <Button
              onClick={() => navigate('/orcamentos/novo')}
              className="bg-gradient-to-r from-blue-600 to-violet-600 text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Criar primeiro orçamento
            </Button>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="py-3 px-6">Nº</th>
                    <th className="py-3 px-6">Cliente</th>
                    <th className="py-3 px-6">Descrição</th>
                    <th className="py-3 px-6">Valor Total</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orcamentos.map((orc) => (
                    <tr
                      key={orc.id}
                      onClick={() => navigate(`/orcamentos/${orc.id}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-6 font-semibold text-blue-600 tabular-nums">
                        {orc.numero || '#---'}
                      </td>
                      <td className="py-3.5 px-6 font-medium text-slate-900">
                        {orc.expand?.cliente_id?.nome || 'Cliente não associado'}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 max-w-[280px] truncate">
                        {orc.descricao}
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-slate-900 tabular-nums">
                        {formatarMoedaBRL(orc.valor_total)}
                      </td>
                      <td className="py-3.5 px-6">
                        <StatusBadge status={orc.status} />
                      </td>
                      <td className="py-3.5 px-6 text-right text-slate-500 tabular-nums">
                        {formatarData(orc.created)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="md:hidden divide-y divide-slate-100">
              {orcamentos.map((orc) => (
                <div
                  key={orc.id}
                  onClick={() => navigate(`/orcamentos/${orc.id}`)}
                  className="p-4 space-y-2.5 active:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600">{orc.numero || '#---'}</span>
                    <StatusBadge status={orc.status} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">
                      {orc.expand?.cliente_id?.nome || 'Cliente não associado'}
                    </h4>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{orc.descricao}</p>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-xs text-slate-500">{formatarData(orc.created)}</span>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatarMoedaBRL(orc.valor_total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE ALTERAÇÃO DE STATUS POR VOZ */}
      <AlertDialog
        open={!!comandoPendente}
        onOpenChange={(open) => !open && setComandoPendente(null)}
      >
        <AlertDialogContent className="max-w-[460px] rounded-2xl bg-white text-slate-900 p-6">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Confirmar Alteração de Status por Voz
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2 pt-1">
              <p className="text-sm font-medium text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {comandoPendente?.mensagem_confirmacao ||
                  `Deseja mudar o orçamento ${comandoPendente?.orcamento_numero} para o status "${comandoPendente?.novo_status}"?`}
              </p>
              <div className="text-xs text-slate-500 pt-1 space-y-0.5">
                <p>
                  • Orçamento:{' '}
                  <strong className="text-slate-800">
                    {comandoPendente?.orcamento_numero || 'Identificado'}
                  </strong>
                  {comandoPendente?.cliente_nome ? ` (${comandoPendente.cliente_nome})` : ''}
                </p>
                <p>
                  • Status atual:{' '}
                  <span className="capitalize">{comandoPendente?.status_anterior || '-'}</span>
                </p>
                <p>
                  • Novo status:{' '}
                  <strong className="text-blue-700 capitalize">
                    {comandoPendente?.novo_status}
                  </strong>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel disabled={applyingStatus} className="h-9 text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStatusChange}
              disabled={applyingStatus}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {applyingStatus ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Aplicando...
                </>
              ) : (
                'Sim, Confirmar e Mudar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
