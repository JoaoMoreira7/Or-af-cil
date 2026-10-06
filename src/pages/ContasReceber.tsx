import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  MessageCircle,
  FileText,
  Search,
  Filter,
  ArrowUpDown,
  Sparkles,
  Loader2,
  AlertCircle,
  Send,
  Calendar,
  Building,
  User,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { orcamentosService } from '@/services/orcamentos'
import { cobrancasService } from '@/services/cobrancas'
import { clientesService } from '@/services/clientes'
import {
  Orçamento,
  Cobranca,
  Cliente,
  formatarMoedaBRL,
  formatarData,
  formatarDataHora,
} from '@/types'
import { COMPANY_LEGAL } from '@/config/company'
import { ModalCobrancaSimulada } from '@/components/ModalCobrancaSimulada'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export interface ItemReceber {
  orcamento: Orçamento
  cobranca: Cobranca | null
  cliente: Cliente | null
  diasPendente: number
  isPago: boolean
}

export interface GrupoClienteReceber {
  clienteId: string
  clienteNome: string
  clienteEmpresa?: string
  clienteTelefone?: string
  clienteEmail?: string
  itens: ItemReceber[]
  totalDevido: number
  totalPago: number
  qtdPendentes: number
}

import { useSubscription } from '@/contexts/SubscriptionContext'

export default function ContasReceber() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const { temAcessoRecurso } = useSubscription()
  const temAcessoWhatsAppCobranca = temAcessoRecurso('profissional')

  const [loading, setLoading] = useState(true)
  const [orcamentosAprovados, setOrcamentosAprovados] = useState<Orçamento[]>([])
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendentes' | 'pagos'>('pendentes')

  // Modal de cobrança PIX
  const [cobrancaModal, setCobrancaModal] = useState<Cobranca | null>(null)
  const [cobrancaModalTel, setCobrancaModalTel] = useState<string | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const [registrandoBaixaId, setRegistrandoBaixaId] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const [todosOrc, todasCob, todosCli] = await Promise.all([
        orcamentosService.listar({ filtroStatus: 'aprovado' }),
        cobrancasService.listar(),
        clientesService.listar(),
      ])

      setOrcamentosAprovados(todosOrc)
      setCobrancas(todasCob)
      setClientes(todosCli)
    } catch (err) {
      console.error('Erro ao carregar contas a receber:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar contas a receber',
        description: 'Não foi possível buscar as informações.',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Consolidação dos dados: une orçamentos aprovados com suas cobranças
  const gruposClientes = useMemo(() => {
    // Mapa de cobranças por orcamento_id
    const cobMap = new Map<string, Cobranca>()
    for (const cob of cobrancas) {
      cobMap.set(cob.orcamento_id, cob)
    }

    // Mapa de clientes por id
    const cliMap = new Map<string, Cliente>()
    for (const cli of clientes) {
      cliMap.set(cli.id, cli)
    }

    // Mapa de grupos por cliente
    const gruposMap = new Map<string, GrupoClienteReceber>()

    const agora = Date.now()

    for (const orc of orcamentosAprovados) {
      const cob = cobMap.get(orc.id) || null
      const cli =
        (orc.cliente_id ? cliMap.get(orc.cliente_id) : null) || orc.expand?.cliente_id || null

      const createdTime = new Date(orc.created).getTime()
      const diasPendente = Math.max(0, Math.floor((agora - createdTime) / (1000 * 60 * 60 * 24)))
      const isPago = cob?.status === 'pago'

      const item: ItemReceber = {
        orcamento: orc,
        cobranca: cob,
        cliente: cli || null,
        diasPendente,
        isPago,
      }

      const chaveCliente =
        cli?.id || orc.cliente_id || `nome_${orc.expand?.cliente_id?.nome || 'Avulso'}`
      const nomeCliente = cli?.nome || orc.expand?.cliente_id?.nome || 'Cliente não identificado'

      if (!gruposMap.has(chaveCliente)) {
        gruposMap.set(chaveCliente, {
          clienteId: chaveCliente,
          clienteNome: nomeCliente,
          clienteEmpresa: cli?.empresa,
          clienteTelefone: cli?.telefone,
          clienteEmail: cli?.email,
          itens: [],
          totalDevido: 0,
          totalPago: 0,
          qtdPendentes: 0,
        })
      }

      const grupo = gruposMap.get(chaveCliente)!
      grupo.itens.push(item)
      if (isPago) {
        grupo.totalPago += orc.valor_total
      } else {
        grupo.totalDevido += orc.valor_total
        grupo.qtdPendentes += 1
      }
    }

    const lista = Array.from(gruposMap.values())

    // Aplica busca
    const buscaNorm = busca.toLowerCase().trim()
    return lista
      .map((g) => {
        const itensFiltrados = g.itens.filter((it) => {
          if (filtroStatus === 'pendentes' && it.isPago) return false
          if (filtroStatus === 'pagos' && !it.isPago) return false

          if (buscaNorm) {
            const num = it.orcamento.numero?.toLowerCase() || ''
            const desc = it.orcamento.descricao?.toLowerCase() || ''
            const cliNome = g.clienteNome.toLowerCase()
            return (
              num.includes(buscaNorm) || desc.includes(buscaNorm) || cliNome.includes(buscaNorm)
            )
          }
          return true
        })

        return {
          ...g,
          itens: itensFiltrados,
        }
      })
      .filter((g) => g.itens.length > 0)
  }, [orcamentosAprovados, cobrancas, clientes, busca, filtroStatus])

  // Totais gerais no topo
  const totaisGerais = useMemo(() => {
    let geralPendente = 0
    let geralPago = 0
    let qtdPropostasPendentes = 0
    let qtdClientesDevedores = 0

    // Mapa de cobranças por orcamento_id
    const cobMap = new Map<string, Cobranca>()
    for (const cob of cobrancas) {
      cobMap.set(cob.orcamento_id, cob)
    }

    const clientesComDebito = new Set<string>()

    for (const orc of orcamentosAprovados) {
      const cob = cobMap.get(orc.id)
      const isPago = cob?.status === 'pago'
      if (isPago) {
        geralPago += orc.valor_total
      } else {
        geralPendente += orc.valor_total
        qtdPropostasPendentes += 1
        if (orc.cliente_id) clientesComDebito.add(orc.cliente_id)
      }
    }

    qtdClientesDevedores = clientesComDebito.size

    return {
      geralPendente,
      geralPago,
      qtdPropostasPendentes,
      qtdClientesDevedores,
    }
  }, [orcamentosAprovados, cobrancas])

  // Ação: Registrar pagamento / Dar Baixa (manual)
  const handleRegistrarPagamento = async (item: ItemReceber) => {
    setRegistrandoBaixaId(item.orcamento.id)
    try {
      let cob = item.cobranca
      if (!cob) {
        // Se ainda não tinha registro de cobrança, cria primeiro
        cob = await cobrancasService.criar({
          orcamento_id: item.orcamento.id,
          cliente_id: item.cliente?.id || undefined,
          cliente_nome: item.cliente?.nome || 'Cliente',
          orcamento_numero: item.orcamento.numero,
          valor: item.orcamento.valor_total,
        })
      }

      await cobrancasService.marcarComoPago(cob.id)

      toast({
        title: 'Pagamento registrado com sucesso!',
        description: `Orçamento ${item.orcamento.numero} (${formatarMoedaBRL(item.orcamento.valor_total)}) marcado como pago.`,
      })

      await carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao registrar pagamento'
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar baixa',
        description: msg,
      })
    } finally {
      setRegistrandoBaixaId(null)
    }
  }

  // Ação: Abrir modal de cobrança / PIX
  const handleAbrirCobranca = async (item: ItemReceber) => {
    try {
      let cob = item.cobranca
      if (!cob) {
        cob = await cobrancasService.criar({
          orcamento_id: item.orcamento.id,
          cliente_id: item.cliente?.id || undefined,
          cliente_nome: item.cliente?.nome || 'Cliente',
          orcamento_numero: item.orcamento.numero,
          valor: item.orcamento.valor_total,
        })
      }
      setCobrancaModal(cob)
      setCobrancaModalTel(item.cliente?.telefone)
      setModalOpen(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar cobrança'
      toast({
        variant: 'destructive',
        title: 'Erro na cobrança',
        description: msg,
      })
    }
  }

  // Ação: Cobrar pelo WhatsApp com mensagem pré-preenchida cordial
  const handleCobrarWhatsApp = (item: ItemReceber) => {
    if (!temAcessoWhatsAppCobranca) {
      toast({
        title: 'Recurso do Plano Profissional',
        description:
          'A cobrança direta pelo WhatsApp está disponível no plano Profissional — faça upgrade!',
      })
      navigate('/planos')
      return
    }

    const tel = item.cliente?.telefone?.replace(/\D/g, '') || ''
    const nome = item.cliente?.nome ? ` ${item.cliente.nome}` : ''
    const num = item.orcamento.numero || ''
    const valor = formatarMoedaBRL(item.orcamento.valor_total)

    const msg =
      `Olá${nome}! Tudo bem?\n\n` +
      `Passando para lembrar sobre a proposta aprovada *${num}* (${item.orcamento.descricao.slice(0, 45)}...) no valor de *${valor}* com a *${COMPANY_LEGAL.nomeFantasia}*.\n\n` +
      `Caso precise do código PIX para efetuar o pagamento ou queira combinar outra forma, estamos à disposição!\n\n` +
      `Agradecemos a parceria!`

    const encoded = encodeURIComponent(msg)
    const url = tel ? `https://wa.me/55${tel}?text=${encoded}` : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Contas a Receber
            </h2>
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs"
            >
              Financeiro
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Acompanhe orçamentos aprovados pendentes de pagamento, devedores agrupados por cliente e
            emita cobranças instantâneas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/modo-voz')}
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs sm:text-sm font-semibold"
          >
            <Sparkles className="w-4 h-4 mr-1.5 text-emerald-600" />
            Perguntar por Voz (&ldquo;Quem está me devendo?&rdquo;)
          </Button>
        </div>
      </div>

      {/* AVISO DO AMBIENTE DE HOMOLOGAÇÃO / DEMO */}
      <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs flex items-center gap-2.5 shadow-2xs">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>Ambiente de Demonstração:</strong> As cobranças e baixas geradas nesta tela são
          simuladas, permitindo testar o fluxo completo de recebíveis e envio por WhatsApp sem
          envolvimento de gateways bancários reais.
        </span>
      </div>

      {/* CARDS COM TOTAL GERAL NO TOPO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Total a Receber Geral */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl p-5 shadow-md border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
              Total Geral a Receber
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-8 w-32 bg-slate-800" />
            ) : (
              <span className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums block">
                {formatarMoedaBRL(totaisGerais.geralPendente)}
              </span>
            )}
            <p className="text-xs text-blue-200/80 mt-1">
              {totaisGerais.qtdPropostasPendentes === 1
                ? '1 proposta aprovada pendente'
                : `${totaisGerais.qtdPropostasPendentes} propostas aprovadas pendentes`}
            </p>
          </div>
        </div>

        {/* 2. Clientes com Débito */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Clientes Devedores
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums block">
                {totaisGerais.qtdClientesDevedores}
              </span>
            )}
            <p className="text-xs text-slate-500 mt-1">Clientes com propostas aprovadas a quitar</p>
          </div>
        </div>

        {/* 3. Total Quitado / Baixado */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Já Recebido
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums block">
                {formatarMoedaBRL(totaisGerais.geralPago)}
              </span>
            )}
            <p className="text-xs text-emerald-600 mt-1">Recebimentos com baixa confirmada</p>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, número (#001) ou descrição..."
            className="h-9 pl-9 text-xs sm:text-sm bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setFiltroStatus('pendentes')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filtroStatus === 'pendentes'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendentes ({totaisGerais.qtdPropostasPendentes})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('pagos')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filtroStatus === 'pagos'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Já Pagos
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('todos')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filtroStatus === 'todos'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
          </div>
        </div>
      </div>

      {/* LISTA DE CLIENTES E SUAS CONTAS A RECEBER */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : gruposClientes.length === 0 ? (
          /* EMPTY STATE */
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Nenhuma conta pendente encontrada
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Não encontramos orçamentos aprovados pendentes com os filtros atuais.
            </p>
            <Button
              onClick={() => navigate('/orcamentos')}
              variant="outline"
              className="text-xs font-semibold"
            >
              Ver todos os orçamentos
            </Button>
          </div>
        ) : (
          gruposClientes.map((grupo) => (
            <div
              key={grupo.clienteId}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all hover:border-slate-300"
            >
              {/* CABEÇALHO DO CLIENTE (AGRUPADOR) */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-slate-50/60 to-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
                    {grupo.clienteNome.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{grupo.clienteNome}</h3>
                      {grupo.clienteEmpresa && (
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          • {grupo.clienteEmpresa}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                      {grupo.clienteTelefone && <span>Tel: {grupo.clienteTelefone}</span>}
                      {grupo.clienteEmail && <span>E-mail: {grupo.clienteEmail}</span>}
                    </div>
                  </div>
                </div>

                {/* Resumo do Débito deste Cliente */}
                <div className="flex items-baseline gap-3 sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                      Total Devido pelo Cliente:
                    </span>
                    <span className="text-xl font-extrabold text-blue-700 tabular-nums">
                      {formatarMoedaBRL(grupo.totalDevido)}
                    </span>
                  </div>
                  {grupo.totalPago > 0 && (
                    <div className="text-xs text-slate-400">
                      <span>(Já pago: {formatarMoedaBRL(grupo.totalPago)})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* LISTA DE PROPOSTAS DESTE CLIENTE */}
              <div className="divide-y divide-slate-100">
                {grupo.itens.map((item) => {
                  const isItemPago = item.isPago
                  const dias = item.diasPendente

                  return (
                    <div
                      key={item.orcamento.id}
                      className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* DADOS DO ORÇAMENTO E TEMPO PENDENTE */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            onClick={() => navigate(`/orcamentos/${item.orcamento.id}`)}
                            className="text-sm font-bold text-blue-600 hover:underline cursor-pointer tabular-nums flex items-center gap-1"
                          >
                            {item.orcamento.numero}
                            <ExternalLink className="w-3 h-3 text-blue-500" />
                          </span>

                          <Badge
                            variant="outline"
                            className={
                              isItemPago
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[10px]'
                                : 'bg-amber-50 text-amber-700 border-amber-300 font-bold text-[10px]'
                            }
                          >
                            {isItemPago ? 'Pago' : 'Pendente'}
                          </Badge>

                          {/* HÁ QUANTO TEMPO ESTÁ PENDENTE */}
                          {!isItemPago && (
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                dias >= 15
                                  ? 'bg-rose-100 text-rose-800'
                                  : dias >= 7
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {dias === 0
                                ? 'Aprovado hoje'
                                : dias === 1
                                  ? 'Pendente há 1 dia'
                                  : `Pendente há ${dias} dias`}
                            </span>
                          )}

                          {isItemPago && item.cobranca?.pago_em && (
                            <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Pago em {formatarDataHora(item.cobranca.pago_em)}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-1 max-w-xl">
                          {item.orcamento.descricao}
                        </p>

                        <div className="text-[11px] text-slate-400">
                          Emitido em: {formatarData(item.orcamento.created)}
                        </div>
                      </div>

                      {/* VALOR DO ITEM */}
                      <div className="lg:text-right shrink-0">
                        <span className="text-xs text-slate-500 block">Valor:</span>
                        <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                          {formatarMoedaBRL(item.orcamento.valor_total)}
                        </span>
                      </div>

                      {/* AÇÕES: COBRAR WHATSAPP / REGISTRAR PAGAMENTO / VER PIX */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                        {/* 1. Cobrar pelo WhatsApp */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleCobrarWhatsApp(item)}
                          className="h-8 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-semibold"
                          title="Enviar mensagem cordial de cobrança pré-preenchida no WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Cobrar pelo WhatsApp
                        </Button>

                        {/* 2. Gerar / Ver PIX */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleAbrirCobranca(item)}
                          className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold"
                          title="Exibir código PIX Copia-e-Cola simulado"
                        >
                          <DollarSign className="w-3.5 h-3.5 mr-1 text-blue-600" />
                          {item.cobranca ? 'Ver PIX' : 'Gerar PIX'}
                        </Button>

                        {/* 3. Registrar Pagamento (Dar Baixa Manual) */}
                        {!isItemPago ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={registrandoBaixaId === item.orcamento.id}
                            onClick={() => handleRegistrarPagamento(item)}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs"
                            title="Dar baixa no valor recebido"
                          >
                            {registrandoBaixaId === item.orcamento.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                Baixando...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Registrar pagamento
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-emerald-700 font-bold px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                            Quitado
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL COBRANÇA PIX SIMULADA */}
      <ModalCobrancaSimulada
        open={modalOpen}
        onOpenChange={setModalOpen}
        cobranca={cobrancaModal}
        clienteTelefone={cobrancaModalTel}
        onStatusChange={() => {
          carregarDados()
        }}
      />
    </div>
  )
}
