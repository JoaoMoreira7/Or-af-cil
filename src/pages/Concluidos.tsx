import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  DollarSign,
  Receipt,
  Sparkles,
  TrendingUp,
  PackageCheck,
  Calendar,
  AlertCircle,
  FileText,
  User,
} from 'lucide-react'
import {
  concluidosService,
  ItemConcluido,
  PeriodoConcluidosFiltro,
  SituacaoConcluidosFiltro,
  MetricasConcluidos,
} from '@/services/concluidos'
import { formatarMoedaBRL, formatarData, formatarDataHora, Cobranca } from '@/types'
import { ModalCobrancaSimulada } from '@/components/ModalCobrancaSimulada'
import { cobrancasService } from '@/services/cobrancas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'

export default function Concluidos() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const isMountedRef = useRef(true)

  const [loading, setLoading] = useState(true)
  const [itens, setItens] = useState<ItemConcluido[]>([])
  const [metricas, setMetricas] = useState<MetricasConcluidos>({
    totalConcluido: 0,
    quantidadeConcluidos: 0,
    totalRecebido: 0,
    totalAReceber: 0,
    ticketMedio: 0,
    quantidadePagos: 0,
    quantidadeAguardando: 0,
  })

  // Filtros
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState<PeriodoConcluidosFiltro>('este_mes')
  const [situacao, setSituacao] = useState<SituacaoConcluidosFiltro>('todos')

  // Modal de Recibo / Cobrança
  const [modalCobrancaOpen, setModalCobrancaOpen] = useState(false)
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<Cobranca | null>(null)
  const [telefoneClienteModal, setTelefoneClienteModal] = useState<string | undefined>(undefined)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const resultado = await concluidosService.listar({
        periodo,
        situacao,
        busca,
      })

      if (isMountedRef.current) {
        setItens(resultado.itens)
        setMetricas(resultado.metricas)
      }
    } catch (err) {
      console.error('Erro ao buscar concluídos:', err)
      if (isMountedRef.current) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar serviços concluídos',
          description: 'Não foi possível carregar a lista neste momento.',
        })
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [periodo, situacao, busca, toast])

  useEffect(() => {
    carregarDados()
  }, [periodo, situacao])

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarDados()
    }, 250)
    return () => clearTimeout(timer)
  }, [busca])

  // Atualização em tempo real quando houver alteração em orcamentos ou cobranças
  useRealtime('orcamentos', () => {
    if (isMountedRef.current) {
      carregarDados()
    }
  })

  useRealtime('cobrancas', () => {
    if (isMountedRef.current) {
      carregarDados()
    }
  })

  // Ação: abrir recibo / comprovante da cobrança
  const handleAbrirRecibo = (item: ItemConcluido, e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.cobranca) {
      setCobrancaSelecionada(item.cobranca)
      setTelefoneClienteModal(item.cliente?.telefone)
      setModalCobrancaOpen(true)
    }
  }

  // Ação: gerar ou abrir cobrança
  const handleGerarOuVerCobranca = async (item: ItemConcluido, e: React.MouseEvent) => {
    e.stopPropagation()
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
      if (isMountedRef.current) {
        setCobrancaSelecionada(cob)
        setTelefoneClienteModal(item.cliente?.telefone)
        setModalCobrancaOpen(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao abrir cobrança'
      toast({
        variant: 'destructive',
        title: 'Erro na cobrança',
        description: msg,
      })
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in-up">
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Concluídos
            </h2>
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs flex items-center gap-1"
            >
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              Serviços Fechados
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Visão unificada de todos os seus serviços e vendas concluídos, com status de quitação e
            recibos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/orcamentos')}
            variant="outline"
            className="text-xs sm:text-sm border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
          >
            <FileText className="w-4 h-4 mr-1.5 text-slate-500" />
            Todos os Orçamentos
          </Button>

          <Button
            onClick={() => navigate('/contas-a-receber')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm"
          >
            <DollarSign className="w-4 h-4 mr-1.5" />
            Contas a Receber
          </Button>
        </div>
      </div>

      {/* CARDS DE RESUMO NO TOPO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Total Concluído */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl p-5 shadow-md border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
              Total Concluído
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-8 w-32 bg-slate-800" />
            ) : (
              <span className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums block">
                {formatarMoedaBRL(metricas.totalConcluido)}
              </span>
            )}
            <p className="text-xs text-blue-200/80 mt-1">
              {metricas.quantidadeConcluidos === 1
                ? '1 serviço/venda concluído'
                : `${metricas.quantidadeConcluidos} serviços/vendas concluídos`}
            </p>
          </div>
        </div>

        {/* CARD 2: Total Já Recebido (Cobranças Pagas) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Já Recebido (Pago)
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
                {formatarMoedaBRL(metricas.totalRecebido)}
              </span>
            )}
            <p className="text-xs text-emerald-600 font-medium mt-1">
              {metricas.quantidadePagos === 1
                ? '1 venda com baixa confirmada'
                : `${metricas.quantidadePagos} vendas com baixa confirmada`}
            </p>
          </div>
        </div>

        {/* CARD 3: A Receber (Aprovados pendentes) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Aguardando Pagamento
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-amber-700 tabular-nums block">
                {formatarMoedaBRL(metricas.totalAReceber)}
              </span>
            )}
            <p className="text-xs text-amber-700 font-medium mt-1">
              {metricas.quantidadeAguardando === 1
                ? '1 serviço aguardando quitação'
                : `${metricas.quantidadeAguardando} serviços aguardando quitação`}
            </p>
          </div>
        </div>

        {/* CARD 4: Ticket Médio */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ticket Médio
            </span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums block">
                {formatarMoedaBRL(metricas.ticketMedio)}
              </span>
            )}
            <p className="text-xs text-slate-500 mt-1">Média por serviço concluído</p>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, número (#001) ou serviço..."
            className="h-9 pl-9 text-xs sm:text-sm bg-slate-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro de Período */}
          <div className="w-[160px] shrink-0">
            <Select
              value={periodo}
              onValueChange={(val: PeriodoConcluidosFiltro) => setPeriodo(val)}
            >
              <SelectTrigger className="h-9 text-xs bg-white">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="este_mes">Este mês</SelectItem>
                <SelectItem value="ultimos_3_meses">Últimos 3 meses</SelectItem>
                <SelectItem value="este_ano">Este ano</SelectItem>
                <SelectItem value="tudo">Todo o histórico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Situação (Tabs pill) */}
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setSituacao('todos')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                situacao === 'todos'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tudo ({metricas.quantidadeConcluidos})
            </button>
            <button
              type="button"
              onClick={() => setSituacao('pagos')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                situacao === 'pagos'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pagos ✅ ({metricas.quantidadePagos})
            </button>
            <button
              type="button"
              onClick={() => setSituacao('aguardando')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                situacao === 'aguardando'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Aguardando ({metricas.quantidadeAguardando})
            </button>
          </div>
        </div>
      </div>

      {/* LISTA UNIFICADA DE CONCLUÍDOS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : itens.length === 0 ? (
          /* ESTADO VAZIO AMIGÁVEL */
          <div className="py-16 px-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Nenhum serviço concluído ainda</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5 leading-relaxed">
              Quando você aprovar um orçamento e receber o pagamento, ele aparece aqui reunido como
              serviço ou venda concluída.
            </p>
            <Button
              onClick={() => navigate('/orcamentos')}
              className="bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium text-xs sm:text-sm"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Ver propostas em andamento
            </Button>
          </div>
        ) : (
          <>
            {/* TABELA DESKTOP */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="py-3 px-6">Nº Orçamento</th>
                    <th className="py-3 px-6">Cliente</th>
                    <th className="py-3 px-6">Serviços / Itens</th>
                    <th className="py-3 px-6">Valor Total</th>
                    <th className="py-3 px-6">Situação</th>
                    <th className="py-3 px-6">Data de Conclusão</th>
                    <th className="py-3 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itens.map((item) => {
                    const nomeCliente =
                      item.cliente?.nome ||
                      item.cobranca?.cliente_nome ||
                      item.orcamento.expand?.cliente_id?.nome ||
                      'Cliente'

                    return (
                      <tr
                        key={item.orcamento.id}
                        onClick={() => navigate(`/orcamentos/${item.orcamento.id}`)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                      >
                        {/* Nº Orçamento */}
                        <td className="py-3.5 px-6 font-bold text-blue-600 tabular-nums">
                          <span className="flex items-center gap-1 group-hover:underline">
                            {item.orcamento.numero || '#---'}
                            <ExternalLink className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </td>

                        {/* Nome do Cliente */}
                        <td className="py-3.5 px-6">
                          <div className="font-semibold text-slate-900">{nomeCliente}</div>
                          {item.cliente?.empresa && (
                            <div className="text-[11px] text-slate-500">{item.cliente.empresa}</div>
                          )}
                        </td>

                        {/* Resumo dos Itens */}
                        <td className="py-3.5 px-6 text-slate-600 max-w-[280px]">
                          <span className="line-clamp-2" title={item.itensDescricao}>
                            {item.itensDescricao}
                          </span>
                        </td>

                        {/* Valor Total */}
                        <td className="py-3.5 px-6 font-bold text-slate-900 tabular-nums">
                          {formatarMoedaBRL(item.valorTotal)}
                        </td>

                        {/* Situação (Pago ✅ / Aguardando pagamento) */}
                        <td className="py-3.5 px-6">
                          {item.isPago ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold text-xs flex items-center gap-1 w-fit"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Pago ✅
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-xs flex items-center gap-1 w-fit"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Aguardando pagamento
                            </Badge>
                          )}
                        </td>

                        {/* Data Conclusão */}
                        <td className="py-3.5 px-6 text-slate-500 tabular-nums text-xs">
                          {formatarDataHora(item.dataConclusao)}
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-6 text-right">
                          <div
                            className="flex items-center justify-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.isPago ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleAbrirRecibo(item, e)}
                                className="h-8 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50 shadow-2xs"
                                title="Visualizar recibo e comprovante de quitação"
                              >
                                <Receipt className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                Ver recibo
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleGerarOuVerCobranca(item, e)}
                                className="h-8 text-xs font-semibold border-blue-300 text-blue-700 hover:bg-blue-50 shadow-2xs"
                                title="Exibir código PIX ou dar baixa"
                              >
                                <DollarSign className="w-3.5 h-3.5 mr-1 text-blue-600" />
                                Cobrança PIX
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* CARDS MOBILE */}
            <div className="md:hidden divide-y divide-slate-100">
              {itens.map((item) => {
                const nomeCliente =
                  item.cliente?.nome ||
                  item.cobranca?.cliente_nome ||
                  item.orcamento.expand?.cliente_id?.nome ||
                  'Cliente'

                return (
                  <div
                    key={item.orcamento.id}
                    onClick={() => navigate(`/orcamentos/${item.orcamento.id}`)}
                    className="p-4 space-y-2.5 active:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-600">
                        {item.orcamento.numero || '#---'}
                      </span>
                      {item.isPago ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold text-[10px] flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Pago ✅
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-[10px] flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3 text-amber-600" />
                          Aguardando
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{nomeCliente}</h4>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                        {item.itensDescricao}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">
                        {formatarData(item.dataConclusao)}
                      </span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatarMoedaBRL(item.valorTotal)}
                      </span>
                    </div>

                    {/* Botão de ação mobile */}
                    <div
                      className="pt-1 flex justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.isPago ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleAbrirRecibo(item, e)}
                          className="h-8 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50 w-full"
                        >
                          <Receipt className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                          Ver recibo
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleGerarOuVerCobranca(item, e)}
                          className="h-8 text-xs font-semibold border-blue-300 text-blue-700 hover:bg-blue-50 w-full"
                        >
                          <DollarSign className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                          Cobrança PIX
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* MODAL DE RECIBO / COBRANÇA */}
      <ModalCobrancaSimulada
        open={modalCobrancaOpen}
        onOpenChange={setModalCobrancaOpen}
        cobranca={cobrancaSelecionada}
        clienteTelefone={telefoneClienteModal}
        onStatusChange={() => {
          carregarDados()
        }}
      />
    </div>
  )
}
