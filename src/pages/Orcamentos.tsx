import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Search, Filter, ArrowUpDown, Sparkles } from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { orcamentosService } from '@/services/orcamentos'
import { Orçamento, formatarMoedaBRL, formatarData } from '@/types'
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

export default function Orcamentos() {
  const navigate = useNavigate()

  const [orcamentos, setOrcamentos] = useState<Orçamento[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [ordenacao, setOrdenacao] = useState('recentes')

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

        <Button
          onClick={() => navigate('/orcamentos/novo')}
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-medium rounded-lg shadow-sm"
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          Novo Orçamento com IA
        </Button>
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
    </div>
  )
}
