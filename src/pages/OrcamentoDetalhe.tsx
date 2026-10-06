import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Printer,
  Pencil,
  Trash2,
  MessageCircle,
  Clock,
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { orcamentosService } from '@/services/orcamentos'
import { clientesService } from '@/services/clientes'
import { Orçamento, Cliente, formatarMoedaBRL, formatarData, formatarDataHora } from '@/types'
import { COMPANY_LEGAL } from '@/config/company'
import { StatusBadge } from '@/components/StatusBadge'
import { ModalCobrancaSimulada } from '@/components/ModalCobrancaSimulada'
import { cobrancasService } from '@/services/cobrancas'
import { Cobranca } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
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

export default function OrcamentoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [orcamento, setOrcamento] = useState<Orçamento | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Cobrança simulada vinculada (Melhoria 4)
  const [cobranca, setCobranca] = useState<Cobranca | null>(null)
  const [modalCobrancaOpen, setModalCobrancaOpen] = useState(false)
  const [gerandoCobranca, setGerandoCobranca] = useState(false)

  const fetchOrcamento = async () => {
    if (!id) return
    try {
      const data = await orcamentosService.buscarPorId(id)
      setOrcamento(data)
      if (data.cliente_id) {
        try {
          const cli = await clientesService.buscarPorId(data.cliente_id)
          setCliente(cli)
        } catch {
          // fallback
        }
      }

      // Busca cobrança existente vinculada a este orçamento
      try {
        const cob = await cobrancasService.buscarPorOrcamentoId(data.id)
        setCobranca(cob)
      } catch {
        // sem cobrança
      }
    } catch (err) {
      console.error('Erro ao buscar orçamento:', err)
      toast({
        variant: 'destructive',
        title: 'Orçamento não encontrado',
        description: 'Não foi possível carregar os dados desta proposta.',
      })
      navigate('/orcamentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrcamento()
  }, [id])

  const handleStatusChange = async (newStatus: Orçamento['status']) => {
    if (!orcamento) return
    setUpdatingStatus(true)
    try {
      const updated = await orcamentosService.atualizarStatus(orcamento.id, newStatus)
      setOrcamento(updated)
      toast({
        title: 'Status atualizado',
        description: `Orçamento alterado para ${newStatus}.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar status'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDelete = async () => {
    if (!orcamento) return
    setDeleting(true)
    try {
      await orcamentosService.excluir(orcamento.id)
      toast({
        title: 'Orçamento excluído',
        description: `O orçamento ${orcamento.numero} foi removido.`,
      })
      navigate('/orcamentos')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir orçamento'
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: msg,
      })
    } finally {
      setDeleting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleWhatsApp = () => {
    if (!orcamento) return
    const phone = cliente?.telefone?.replace(/\D/g, '') || ''
    const itemsText = (orcamento.itens || [])
      .map((it) => `• ${it.quantidade}x ${it.descricao} - ${formatarMoedaBRL(it.valor_unitario)}`)
      .join('\n')

    const msg =
      `Olá ${cliente?.nome || ''}! Segue a proposta comercial da ${COMPANY_LEGAL.nomeFantasia}:\n\n` +
      `*Orçamento:* ${orcamento.numero}\n` +
      `*Descrição:* ${orcamento.descricao}\n\n` +
      `*Itens:*\n${itemsText}\n\n` +
      `*Valor Total:* ${formatarMoedaBRL(orcamento.valor_total)}\n\n` +
      `Qualquer dúvida estou à disposição!`

    const encoded = encodeURIComponent(msg)
    const url = phone
      ? `https://wa.me/55${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
        <p className="text-sm">Carregando detalhes do orçamento...</p>
      </div>
    )
  }

  if (!orcamento) return null

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ACTION BAR (SCREEN ONLY) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/orcamentos')}
            className="h-9 px-2.5"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Orçamento {orcamento.numero}
              </h2>
              <StatusBadge status={orcamento.status} />
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5" /> Emitido em {formatarDataHora(orcamento.created)}
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Dropdown */}
          <div className="w-[140px]">
            <Select
              value={orcamento.status}
              onValueChange={(val: Orçamento['status']) => handleStatusChange(val)}
              disabled={updatingStatus}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* BOTÃO GERAR COBRANÇA (QUANDO STATUS = APROVADO) (MELHORIA 4) */}
          {orcamento.status === 'aprovado' && (
            <Button
              variant="default"
              size="sm"
              disabled={gerandoCobranca}
              onClick={async () => {
                setGerandoCobranca(true)
                try {
                  const cob = await cobrancasService.criar({
                    orcamento_id: orcamento.id,
                    cliente_id: orcamento.cliente_id || undefined,
                    cliente_nome: cliente?.nome || 'Cliente',
                    orcamento_numero: orcamento.numero,
                    valor: orcamento.valor_total,
                  })
                  setCobranca(cob)
                  setModalCobrancaOpen(true)
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : 'Falha ao gerar cobrança'
                  toast({
                    variant: 'destructive',
                    title: 'Erro ao gerar cobrança',
                    description: msg,
                  })
                } finally {
                  setGerandoCobranca(false)
                }
              }}
              className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              title="Gerar cobrança simulada com PIX"
            >
              {gerandoCobranca ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-1" />
                  {cobranca ? 'Ver Cobrança PIX' : 'Gerar Cobrança'}
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsApp}
            className="h-9 text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-300"
            title="Enviar por WhatsApp"
          >
            <MessageCircle className="w-4 h-4 mr-1 text-emerald-600" />
            WhatsApp
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 text-xs"
            title="Imprimir orçamento"
          >
            <Printer className="w-4 h-4 mr-1" />
            Imprimir
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/orcamentos/${orcamento.id}/editar`)}
            className="h-9 text-xs"
          >
            <Pencil className="w-4 h-4 mr-1" />
            Editar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="h-9 text-xs text-red-600 hover:bg-red-50 border-red-200"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Excluir
          </Button>
        </div>
      </div>

      {/* BANNER DE COBRANÇA PENDENTE / PAGA QUANDO APROVADO */}
      {orcamento.status === 'aprovado' && (
        <div className="no-print p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  {cobranca?.status === 'pago'
                    ? 'Pagamento Confirmado (Baixa realizada)'
                    : 'Orçamento Aprovado — Cobrança disponível'}
                </h4>
                {cobranca && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      cobranca.status === 'pago'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {cobranca.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {cobranca?.status === 'pago'
                  ? 'Esta proposta já foi quitada. Você pode visualizar o comprovante simulado.'
                  : 'Gere o código PIX instantâneo simulado e envie a chave copia-e-cola diretamente pelo WhatsApp.'}
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={async () => {
              if (cobranca) {
                setModalCobrancaOpen(true)
                return
              }
              try {
                const cob = await cobrancasService.criar({
                  orcamento_id: orcamento.id,
                  cliente_id: orcamento.cliente_id || undefined,
                  cliente_nome: cliente?.nome || 'Cliente',
                  orcamento_numero: orcamento.numero,
                  valor: orcamento.valor_total,
                })
                setCobranca(cob)
                setModalCobrancaOpen(true)
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Falha'
                toast({ variant: 'destructive', title: 'Erro', description: msg })
              }
            }}
            className="w-full sm:w-auto shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 shadow-sm"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            {cobranca ? 'Ver Detalhes da Cobrança' : 'Gerar Cobrança'}
          </Button>
        </div>
      )}

      {/* PRINT-FRIENDLY DOCUMENT CONTAINER */}
      <div className="print-area bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-10 space-y-8">
        {/* HEADER EMPRESA (VINDO DE COMPANY_LEGAL) */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-white font-black text-lg">
                OF
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {COMPANY_LEGAL.nomeFantasia}
                </h1>
                <p className="text-xs text-slate-500">{COMPANY_LEGAL.razaoSocial}</p>
              </div>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5 mt-2">
              <p>CNPJ: {COMPANY_LEGAL.cnpj}</p>
              <p>{COMPANY_LEGAL.endereco}</p>
              <p>
                E-mail: {COMPANY_LEGAL.emailContato} | Suporte: {COMPANY_LEGAL.emailSuporte}
                {COMPANY_LEGAL.telefone && ` | Tel: ${COMPANY_LEGAL.telefone}`}
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Proposta Comercial
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-600 tabular-nums">
              {orcamento.numero}
            </h2>
            <p className="text-xs text-slate-500 mt-1">Data: {formatarData(orcamento.created)}</p>
            <div className="mt-2 sm:inline-block">
              <StatusBadge status={orcamento.status} />
            </div>
          </div>
        </div>

        {/* CLIENTE & SERVIÇO CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dados do Cliente */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" /> Dados do Cliente
            </h3>
            <div className="text-sm font-bold text-slate-900">
              {cliente?.nome || 'Não informado'}
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              {cliente?.empresa && (
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cliente.empresa}</span>
                </div>
              )}
              {cliente?.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cliente.email}</span>
                </div>
              )}
              {cliente?.telefone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cliente.telefone}</span>
                </div>
              )}
              {cliente?.endereco && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cliente.endereco}</span>
                </div>
              )}
            </div>
          </div>

          {/* Resumo do Orçamento & Valor Destaque */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Descrição do Escopo
              </h3>
              <p className="text-sm text-slate-800 mt-1 leading-relaxed">{orcamento.descricao}</p>
            </div>
            <div className="pt-4 mt-4 border-t border-blue-100/80 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-600">Valor Total da Proposta:</span>
              <span className="text-2xl font-extrabold text-blue-700 tabular-nums">
                {formatarMoedaBRL(orcamento.valor_total)}
              </span>
            </div>
          </div>
        </div>

        {/* TABELA DE ITENS */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Detalhamento dos Itens e Serviços
          </h3>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Descrição do Serviço / Produto</th>
                  <th className="py-3 px-4 text-center">Qtd.</th>
                  <th className="py-3 px-4 text-right">Valor Unitário</th>
                  <th className="py-3 px-4 text-right">Total do Item</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(orcamento.itens || []).map((it, idx) => {
                  const itemTotal = (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0)
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-slate-400 tabular-nums">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{it.descricao}</td>
                      <td className="py-3 px-4 text-center tabular-nums">{it.quantidade}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                        {formatarMoedaBRL(it.valor_unitario)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                        {formatarMoedaBRL(itemTotal)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* FECHAMENTO DE VALORES (SUBTOTAL, IMPOSTOS, TOTAL) */}
        <div className="flex flex-col items-end space-y-2 pt-2 border-t border-slate-200 text-xs sm:text-sm">
          <div className="flex items-center justify-between w-64 text-slate-600">
            <span>Subtotal:</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatarMoedaBRL(orcamento.subtotal)}
            </span>
          </div>

          <div className="flex items-center justify-between w-64 text-slate-600">
            <span>Impostos ({orcamento.impostos || 0}%):</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              +{formatarMoedaBRL(((orcamento.subtotal || 0) * (orcamento.impostos || 0)) / 100)}
            </span>
          </div>

          <div className="flex items-center justify-between w-64 pt-2 border-t-2 border-slate-900 text-base font-bold text-slate-900">
            <span>Valor Total:</span>
            <span className="text-xl font-extrabold text-blue-600 tabular-nums">
              {formatarMoedaBRL(orcamento.valor_total)}
            </span>
          </div>
        </div>

        {/* NOTA DE RODAPÉ LEGAL */}
        <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">Condições Gerais:</p>
          <p>• Validade desta proposta: 15 (quinze) dias a contar da data de emissão.</p>
          <p>
            • Proposta emitida através da plataforma oficial{' '}
            <strong>{COMPANY_LEGAL.nomeFantasia}</strong>.
          </p>
          <p className="text-[11px] text-slate-400 mt-2">
            Documento gerado eletronicamente em conformidade com as diretrizes comerciais vigentes.
          </p>
        </div>
      </div>

      {/* DIÁLOGO CONFIRMAÇÃO EXCLUSÃO */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[420px] rounded-2xl bg-white text-slate-900 p-6">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Excluir Orçamento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja remover o orçamento <strong>{orcamento.numero}</strong>? Esta
              ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel disabled={deleting} className="h-9 text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL DE COBRANÇA SIMULADA (MELHORIA 4) */}
      <ModalCobrancaSimulada
        open={modalCobrancaOpen}
        onOpenChange={setModalCobrancaOpen}
        cobranca={cobranca}
        clienteTelefone={cliente?.telefone}
        onStatusChange={(nova) => setCobranca(nova)}
      />
    </div>
  )
}
