import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  CheckCircle,
  DollarSign,
  Users,
  Sparkles,
  UserPlus,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { orcamentosService } from '@/services/orcamentos'
import { clientesService } from '@/services/clientes'
import { Orçamento, Cliente, formatarMoedaBRL, formatarData } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import { FollowUpProativo } from '@/components/FollowUpProativo'
import { ResumoManhaCard } from '@/components/ResumoManhaCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [orcamentos, setOrcamentos] = useState<Orçamento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)

  // Carregar dados
  const fetchData = async () => {
    try {
      const [listaOrcamentos, listaClientes] = await Promise.all([
        orcamentosService.listar(),
        clientesService.listar(),
      ])
      setOrcamentos(listaOrcamentos)
      setClientes(listaClientes)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Realtime updates
  useRealtime('orcamentos', () => {
    fetchData()
  })

  useRealtime('clientes', () => {
    fetchData()
  })

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const totalOrcamentos = orcamentos.length
    const aprovados = orcamentos.filter((o) => o.status === 'aprovado')
    const totalAprovados = aprovados.length
    const valorAprovado = aprovados.reduce((acc, cur) => acc + (cur.valor_total || 0), 0)
    const totalClientes = clientes.length

    return {
      totalOrcamentos,
      totalAprovados,
      valorAprovado,
      totalClientes,
    }
  }, [orcamentos, clientes])

  const ultimosOrcamentos = useMemo(() => {
    return orcamentos.slice(0, 5)
  }, [orcamentos])

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in-up">
      {/* SAUDAÇÃO HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Olá, {user?.name || 'Gestor(a)'}! 👋
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Aqui está o resumo do seu negócio e o desempenho de suas propostas hoje.
          </p>
        </div>

        {/* QUICK ACTIONS ROW */}
        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => navigate('/clientes')}
            variant="outline"
            size="sm"
            className="h-10 border-slate-300 text-slate-700 hover:bg-slate-100 font-medium rounded-lg"
          >
            <UserPlus className="w-4 h-4 mr-1.5 text-slate-500" />
            Adicionar Cliente
          </Button>

          <Button
            onClick={() => navigate('/orcamentos/novo')}
            size="sm"
            className="h-10 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-medium rounded-lg shadow-sm"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Criar Orçamento com IA
          </Button>
        </div>
      </div>

      {/* MELHORIA 3 — RESUMO DA MANHÃ (NO TOPO DO DASHBOARD) */}
      {!loading && (
        <ResumoManhaCard
          orcamentos={orcamentos}
          userName={user?.name || 'Gestor(a)'}
          onVerAguardando={() => navigate('/orcamentos')}
          onVerReceber={() => navigate('/orcamentos')}
        />
      )}

      {/* MELHORIA 2 — FOLLOW-UP PROATIVO DE ORÇAMENTOS PENDENTES HÁ 5+ DIAS */}
      {!loading && <FollowUpProativo orcamentos={orcamentos} clientes={clientes} diasLimite={5} />}

      {/* 4 STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Orçamentos Totais */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Orçamentos Totais
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {stats.totalOrcamentos}
              </span>
            )}
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Propostas registradas
            </p>
          </div>
        </div>

        {/* Card 2: Orçamentos Aprovados */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Orçamentos Aprovados
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {stats.totalAprovados}
              </span>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {stats.totalOrcamentos > 0
                ? `${Math.round((stats.totalAprovados / stats.totalOrcamentos) * 100)}% taxa de conversão`
                : 'Aguardando propostas'}
            </p>
          </div>
        </div>

        {/* Card 3: Valor Aprovado BRL */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Valor Aprovado
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums truncate block">
                {formatarMoedaBRL(stats.valorAprovado)}
              </span>
            )}
            <p className="text-xs text-slate-500 mt-1">Total em receitas confirmadas</p>
          </div>
        </div>

        {/* Card 4: Clientes Ativos */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Clientes Ativos
            </span>
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {stats.totalClientes}
              </span>
            )}
            <p className="text-xs text-slate-500 mt-1">Base comercial cadastrada</p>
          </div>
        </div>
      </div>

      {/* RECENT ORÇAMENTOS SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Últimos Orçamentos</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhe as propostas comerciais mais recentes geradas na plataforma
            </p>
          </div>
          <Link
            to="/orcamentos"
            className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
          >
            <span>Ver todos</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : ultimosOrcamentos.length === 0 ? (
          /* EMPTY STATE */
          <div className="py-14 px-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <FileText className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-800">Nenhum orçamento cadastrado</h4>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Comece agora mesmo a acelerar seu negócio criando seu primeiro orçamento com apoio de
              IA.
            </p>
            <Button
              onClick={() => navigate('/orcamentos/novo')}
              className="bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Criar primeiro orçamento
            </Button>
          </div>
        ) : (
          /* TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100">
                  <th className="py-3 px-4 sm:px-6">Nº</th>
                  <th className="py-3 px-4 sm:px-6">Cliente</th>
                  <th className="py-3 px-4 sm:px-6 hidden md:table-cell">Descrição</th>
                  <th className="py-3 px-4 sm:px-6">Valor Total</th>
                  <th className="py-3 px-4 sm:px-6">Status</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ultimosOrcamentos.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/orcamentos/${item.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-blue-600">
                      {item.numero || '#---'}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                      {item.expand?.cliente_id?.nome || 'Cliente não identificado'}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600 hidden md:table-cell max-w-[280px] truncate">
                      {item.descricao}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900 tabular-nums">
                      {formatarMoedaBRL(item.valor_total)}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right text-slate-500 tabular-nums">
                      {formatarData(item.created)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
