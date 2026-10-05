import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Users,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Ban,
  RotateCcw,
  QrCode,
  Barcode,
  Sparkles,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { gatewayPagamentoService } from '@/services/gatewayPagamento'
import { useAuth } from '@/contexts/AuthContext'
import {
  PagamentoRegistro,
  VendasMetricas,
  PagamentoStatus,
  formatarMoedaBRL,
  formatarData,
  formatarDataHora,
} from '@/types'
import { useToast } from '@/hooks/use-toast'
import { PLANO_CONFIG } from '@/config/plans'

export default function AdminVendas() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isMountedRef = useRef(true)

  const [loading, setLoading] = useState<boolean>(true)
  const [metricas, setMetricas] = useState<VendasMetricas | null>(null)
  const [vendas, setVendas] = useState<PagamentoRegistro[]>([])

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pago' | 'pendente' | 'cancelado'>(
    'todos',
  )
  const [filtroForma, setFiltroForma] = useState<'todos' | 'pix' | 'cartao' | 'boleto'>('todos')

  // Modal de Ação Manual de Assinatura (Cancelar / Reativar)
  const [modalAcaoOpen, setModalAcaoOpen] = useState<boolean>(false)
  const [vendaSelecionada, setVendaSelecionada] = useState<PagamentoRegistro | null>(null)
  const [acaoTipo, setAcaoTipo] = useState<'cancelar' | 'reativar'>('cancelar')
  const [executandoAcao, setExecutandoAcao] = useState<boolean>(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const carregarVendas = async () => {
    setLoading(true)
    try {
      const res = await gatewayPagamentoService.listarTodasVendasAdmin()
      if (isMountedRef.current) {
        setMetricas(res.metricas)
        setVendas(res.vendas)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao buscar histórico de vendas'
        toast({
          title: 'Erro ao carregar vendas',
          description: msg,
          variant: 'destructive',
        })
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    carregarVendas()
  }, [])

  // Proteção em nível de renderização além da rota
  const isDono = user?.email?.toLowerCase().trim() === 'jaocarloss@gmail.com'

  const vendasFiltradas = useMemo(() => {
    return vendas.filter((item) => {
      const nomeCliente = (item.expand?.user_id?.name || '').toLowerCase()
      const emailCliente = (item.expand?.user_id?.email || '').toLowerCase()
      const ref = (item.referencia_transacao || '').toLowerCase()
      const term = searchTerm.toLowerCase().trim()

      const matchesSearch =
        !term || nomeCliente.includes(term) || emailCliente.includes(term) || ref.includes(term)

      const matchesStatus = filtroStatus === 'todos' ? true : item.status === filtroStatus
      const matchesForma = filtroForma === 'todos' ? true : item.forma_pagamento === filtroForma

      return matchesSearch && matchesStatus && matchesForma
    })
  }, [vendas, searchTerm, filtroStatus, filtroForma])

  const abrirModalAcao = (venda: PagamentoRegistro, tipo: 'cancelar' | 'reativar') => {
    setVendaSelecionada(venda)
    setAcaoTipo(tipo)
    setModalAcaoOpen(true)
  }

  const handleConfirmarAcaoManual = async () => {
    if (!vendaSelecionada) return
    setExecutandoAcao(true)

    try {
      const novoStatus: PagamentoStatus = acaoTipo === 'cancelar' ? 'cancelado' : 'pago'
      await gatewayPagamentoService.alterarStatusVendaManual(vendaSelecionada.id, novoStatus)

      if (isMountedRef.current) {
        toast({
          title:
            acaoTipo === 'cancelar'
              ? 'Assinatura cancelada com sucesso'
              : 'Assinatura reativada com sucesso',
          description: `O status da venda ${vendaSelecionada.referencia_transacao} foi alterado para "${novoStatus}" e o acesso do usuário foi sincronizado.`,
        })
        setModalAcaoOpen(false)
        setVendaSelecionada(null)
      }

      await carregarVendas()
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao aplicar alteração manual'
        toast({
          title: 'Erro ao processar alteração',
          description: msg,
          variant: 'destructive',
        })
      }
    } finally {
      if (isMountedRef.current) {
        setExecutandoAcao(false)
      }
    }
  }

  const renderFormaBadge = (forma: string) => {
    if (forma === 'pix') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-semibold">
          <QrCode className="w-3 h-3 text-teal-600" /> PIX
        </span>
      )
    }
    if (forma === 'cartao') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
          <CreditCard className="w-3 h-3 text-blue-600" /> Cartão
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-semibold">
        <Barcode className="w-3 h-3 text-slate-600" /> Boleto
      </span>
    )
  }

  const renderStatusBadge = (status: PagamentoStatus) => {
    if (status === 'pago') {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 font-semibold flex items-center gap-1 w-fit">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Pago / Ativo
        </Badge>
      )
    }
    if (status === 'pendente') {
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 font-semibold flex items-center gap-1 w-fit">
          <Clock className="w-3 h-3 text-amber-600" /> Pendente
        </Badge>
      )
    }
    return (
      <Badge className="bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 font-semibold flex items-center gap-1 w-fit">
        <XCircle className="w-3 h-3 text-rose-600" /> Cancelado
      </Badge>
    )
  }

  if (!isDono) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Acesso Restrito ao Dono</h2>
        <p className="text-sm text-slate-500 max-w-md mt-1">
          Esta área é restrita exclusivamente ao proprietário do sistema (jaocarloss@gmail.com).
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Controle de Vendas & Faturamento
            </h2>
            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs font-bold">
              👑 Exclusivo: jaocarloss@gmail.com
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestão financeira de assinaturas do plano {PLANO_CONFIG.nome} (
            {PLANO_CONFIG.precoMensalExtenso}). Controle de vendas, receita mensal acumulada e ações
            manuais de liberação/cancelamento.
          </p>
        </div>

        <Button
          onClick={carregarVendas}
          disabled={loading}
          variant="outline"
          className="border-slate-300 hover:bg-slate-100 self-start sm:self-auto gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Vendas
        </Button>
      </div>

      {/* CARD DE AVISO DO GATEWAY / HOMOLOGAÇÃO */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-200/80 text-blue-950 text-xs sm:text-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 mt-0.5 md:mt-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">
                Gateway de Pagamento Unificado: Modo{' '}
                {gatewayPagamentoService.modo === 'simulado'
                  ? 'Simulado / Homologado'
                  : 'Real (Mercado Pago / Stripe)'}
              </span>
              <Badge
                variant="outline"
                className="border-blue-300 bg-white text-blue-700 text-[10px]"
              >
                {gatewayPagamentoService.modo === 'simulado'
                  ? 'Pronto para Produção'
                  : 'Produção Ativa'}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Toda nova contratação via PIX, Cartão ou Boleto gera um registro com data de compra,
              vencimento (+30 dias) e referência única. Quando você receber as credenciais do
              Mercado Pago ou Stripe, a troca é pontual no service{' '}
              <code className="font-mono bg-blue-100/70 px-1 py-0.5 rounded text-blue-900">
                src/services/gatewayPagamento.ts
              </code>{' '}
              sem necessidade de refazer telas.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 bg-white/90 p-2.5 rounded-xl border border-blue-200">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <div className="text-[11px] leading-tight text-slate-700">
            <strong>Plano Único Oficial:</strong> {PLANO_CONFIG.precoFormatado}/mês
          </div>
        </div>
      </div>

      {/* 5 CARDS DE MÉTRICAS NO TOPO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. TOTAL VENDIDO */}
        <Card className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Vendido
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {loading ? '...' : metricas?.totalVendido || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Assinaturas contratadas</p>
          </CardContent>
        </Card>

        {/* 2. ASSINANTES ATIVOS AGORA */}
        <Card className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ativos Agora
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600">
              {loading ? '...' : metricas?.ativosAgora || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Acesso liberado (30 dias)</p>
          </CardContent>
        </Card>

        {/* 3. CANCELADOS OU EXPIRADOS */}
        <Card className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cancelados / Expirados
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <Ban className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-rose-600">
              {loading ? '...' : metricas?.canceladosOuExpirados || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Paywall bloqueado</p>
          </CardContent>
        </Card>

        {/* 4. RECEITA MENSAL ATUAL (ATIVOS x 49,90) */}
        <Card className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Receita Mensal (MRR)
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-indigo-600">
              {loading ? '...' : formatarMoedaBRL(metricas?.receitaMensalAtual || 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Ativos × {PLANO_CONFIG.precoFormatado}</p>
          </CardContent>
        </Card>

        {/* 5. RECEITA TOTAL ACUMULADA */}
        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-slate-900 to-indigo-950 text-white hover:brightness-105 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
              Receita Acumulada
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-white">
              {loading ? '...' : formatarMoedaBRL(metricas?.receitaTotalAcumulada || 0)}
            </div>
            <p className="text-xs text-blue-200/80 mt-1">Soma de todas as vendas</p>
          </CardContent>
        </Card>
      </div>

      {/* TABELA DE VENDAS COM BUSCA E FILTROS */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Histórico Completo de Vendas</span>
                <Badge variant="outline" className="border-slate-300 text-slate-700 text-xs">
                  {vendasFiltradas.length} {vendasFiltradas.length === 1 ? 'registro' : 'registros'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Acompanhe compras, formas de pagamento, vencimentos e gerencie o status das
                assinaturas individualmente.
              </CardDescription>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
              {/* Campo de Busca */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                <Input
                  placeholder="Buscar cliente, e-mail ou ref..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-xs h-9 w-full sm:w-60 border-slate-200"
                />
              </div>

              {/* Filtro Forma de Pagamento */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {(['todos', 'pix', 'cartao', 'boleto'] as const).map((forma) => (
                  <button
                    key={forma}
                    type="button"
                    onClick={() => setFiltroForma(forma)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      filtroForma === forma
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {forma === 'todos'
                      ? 'Todas Formas'
                      : forma === 'pix'
                        ? 'PIX'
                        : forma === 'cartao'
                          ? 'Cartão'
                          : 'Boleto'}
                  </button>
                ))}
              </div>

              {/* Filtro Status */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {(['todos', 'pago', 'pendente', 'cancelado'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFiltroStatus(st)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      filtroStatus === st
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'todos'
                      ? 'Todos'
                      : st === 'pago'
                        ? 'Pagos'
                        : st === 'pendente'
                          ? 'Pendentes'
                          : 'Cancelados'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-sm">Carregando lista de vendas...</p>
            </div>
          ) : vendasFiltradas.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <p className="text-sm font-medium text-slate-700">Nenhuma venda encontrada</p>
              <p className="text-xs text-slate-400 mt-1">
                Tente ajustar os filtros ou pesquisar por outro cliente/e-mail.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4">Forma</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Data Compra</th>
                    <th className="py-3 px-4">Vencimento (+30d)</th>
                    <th className="py-3 px-4">Ref. Transação</th>
                    <th className="py-3 px-4 text-right">Ação do Dono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {vendasFiltradas.map((item) => {
                    const nome = item.expand?.user_id?.name || 'Cliente Sem Nome'
                    const email = item.expand?.user_id?.email || 'Sem e-mail'

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* CLIENTE */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{nome}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{email}</div>
                        </td>

                        {/* VALOR */}
                        <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                          {formatarMoedaBRL(item.valor)}
                        </td>

                        {/* FORMA */}
                        <td className="py-3 px-4">{renderFormaBadge(item.forma_pagamento)}</td>

                        {/* STATUS */}
                        <td className="py-3 px-4">{renderStatusBadge(item.status)}</td>

                        {/* DATA DA COMPRA */}
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          {formatarDataHora(item.data_compra)}
                        </td>

                        {/* DATA DE VENCIMENTO */}
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          {formatarData(item.data_vencimento)}
                        </td>

                        {/* REFERÊNCIA */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {item.referencia_transacao}
                          </span>
                        </td>

                        {/* AÇÃO DO DONO */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {item.status === 'pago' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => abrirModalAcao(item, 'cancelar')}
                              className="h-7 px-2.5 text-xs text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300 gap-1"
                              title="Cancela a assinatura e bloqueia o paywall para este usuário"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-600" />
                              Cancelar Assinatura
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => abrirModalAcao(item, 'reativar')}
                              className="h-7 px-2.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 gap-1"
                              title="Reativa a assinatura e renova o acesso por 30 dias"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                              Reativar Assinatura
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE CONFIRMAÇÃO DA AÇÃO MANUAL */}
      <Dialog open={modalAcaoOpen} onOpenChange={setModalAcaoOpen}>
        <DialogContent className="max-w-[480px] rounded-3xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
              {acaoTipo === 'cancelar' ? (
                <>
                  <Ban className="w-5 h-5 text-rose-600" /> Confirmar Cancelamento da Assinatura
                </>
              ) : (
                <>
                  <RotateCcw className="w-5 h-5 text-emerald-600" /> Confirmar Reativação da
                  Assinatura
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Esta ação manual é exclusiva do dono do sistema e altera diretamente a permissão de
              acesso do cliente.
            </DialogDescription>
          </DialogHeader>

          {vendaSelecionada && (
            <div className="my-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <strong className="text-slate-900">
                  {vendaSelecionada.expand?.user_id?.name || 'Cliente Sem Nome'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">E-mail:</span>
                <span className="font-mono text-slate-700">
                  {vendaSelecionada.expand?.user_id?.email || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transação:</span>
                <span className="font-mono text-slate-700">
                  {vendaSelecionada.referencia_transacao}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valor do Plano:</span>
                <strong className="text-slate-900">
                  {formatarMoedaBRL(vendaSelecionada.valor)}
                </strong>
              </div>

              <div
                className={`p-3 rounded-xl mt-3 text-xs leading-relaxed ${
                  acaoTipo === 'cancelar'
                    ? 'bg-rose-50 border border-rose-200 text-rose-900'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                }`}
              >
                {acaoTipo === 'cancelar' ? (
                  <p>
                    ⚠️ <strong>Atenção:</strong> Ao cancelar, o status da venda será alterado para{' '}
                    <strong>"cancelado"</strong> e o plano do usuário será marcado como{' '}
                    <strong>"expirado"</strong>, ativando a tela de bloqueio (paywall) na próxima
                    navegação dele.
                  </p>
                ) : (
                  <p>
                    ✅ Ao reativar, o status da venda será alterado para <strong>"pago"</strong> e a
                    assinatura do usuário será estendida por <strong>+30 dias</strong> de acesso
                    total e ilimitado.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={executandoAcao}
              onClick={() => setModalAcaoOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={executandoAcao}
              onClick={handleConfirmarAcaoManual}
              className={
                acaoTipo === 'cancelar'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white font-bold'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
              }
            >
              {executandoAcao ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : acaoTipo === 'cancelar' ? (
                'Sim, Cancelar Assinatura'
              ) : (
                'Sim, Reativar Assinatura'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
