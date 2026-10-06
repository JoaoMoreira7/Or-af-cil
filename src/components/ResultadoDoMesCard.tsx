import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, DollarSign, ArrowRight, HelpCircle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cobrancasService } from '@/services/cobrancas'
import { gastosService } from '@/services/gastos'
import { Cobranca, Gasto, formatarMoedaBRL } from '@/types'

export interface ResultadoDoMesCardProps {
  userId?: string
}

interface MesMetrica {
  chave: string // "YYYY-MM"
  rotulo: string // "Mai/25"
  rotuloCompleto: string // "Maio de 2025"
  receita: number // cobranças pagas no mês
  gastosEmpresa: number // gastos de empresa
  gastosPessoal: number // gastos pessoais
  lucro: number // receita - gastosEmpresa
}

export const ResultadoDoMesCard: React.FC<ResultadoDoMesCardProps> = ({ userId }) => {
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState<'mes_atual' | 'ultimos_3_meses'>('mes_atual')
  const [loading, setLoading] = useState(true)
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])

  useEffect(() => {
    let isMounted = true

    const carregar = async () => {
      try {
        setLoading(true)
        const [listaCob, listaGastos] = await Promise.all([
          cobrancasService.listar(),
          gastosService.listar(),
        ])
        if (isMounted) {
          setCobrancas(listaCob)
          setGastos(listaGastos)
        }
      } catch (err) {
        console.error('Erro ao carregar dados do Resultado do Mês:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    carregar()

    return () => {
      isMounted = false
    }
  }, [userId])

  // Gera dados dos últimos 3 meses cronológicos (do mais antigo para o mais recente)
  const mesesHistorico = useMemo<MesMetrica[]>(() => {
    const hoje = new Date()
    const meses: MesMetrica[] = []

    for (let i = 2; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const ano = d.getFullYear()
      const mesNum = String(d.getMonth() + 1).padStart(2, '0')
      const chave = `${ano}-${mesNum}`

      const nomesMes = [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
      ]
      const rotulo = `${nomesMes[d.getMonth()].slice(0, 3)}/${String(ano).slice(2)}`
      const rotuloCompleto = `${nomesMes[d.getMonth()]} de ${ano}`

      // Cobranças pagas neste mês (status 'pago' conforme CobrancaStatus)
      const cobMes = cobrancas.filter((c) => {
        if (c.status !== 'pago') return false
        const dataRef = c.pago_em || c.updated || c.created
        return dataRef && dataRef.startsWith(chave)
      })
      const receita = cobMes.reduce((acc, c) => acc + (Number(c.valor) || 0), 0)

      // Gastos deste mês
      const gastosMes = gastos.filter((g) => {
        const dataRef = g.data || g.created
        return dataRef && dataRef.startsWith(chave)
      })

      const gastosEmpresa = gastosMes
        .filter((g) => (g.contexto || 'empresa') === 'empresa')
        .reduce((acc, g) => acc + (Number(g.valor) || 0), 0)

      const gastosPessoal = gastosMes
        .filter((g) => g.contexto === 'pessoal')
        .reduce((acc, g) => acc + (Number(g.valor) || 0), 0)

      const lucro = receita - gastosEmpresa

      meses.push({
        chave,
        rotulo,
        rotuloCompleto,
        receita,
        gastosEmpresa,
        gastosPessoal,
        lucro,
      })
    }

    return meses
  }, [cobrancas, gastos])

  // Mês atual é o último da lista
  const mesAtual = mesesHistorico[mesesHistorico.length - 1] || {
    chave: '',
    rotulo: '',
    rotuloCompleto: 'Mês Atual',
    receita: 0,
    gastosEmpresa: 0,
    gastosPessoal: 0,
    lucro: 0,
  }

  // Totais agregados para o período selecionado
  const metricasExibidas = useMemo(() => {
    if (periodo === 'mes_atual') {
      return {
        tituloPeriodo: mesAtual.rotuloCompleto,
        receita: mesAtual.receita,
        gastosEmpresa: mesAtual.gastosEmpresa,
        gastosPessoal: mesAtual.gastosPessoal,
        lucro: mesAtual.lucro,
      }
    }

    const receita3m = mesesHistorico.reduce((acc, m) => acc + m.receita, 0)
    const gastosEmpresa3m = mesesHistorico.reduce((acc, m) => acc + m.gastosEmpresa, 0)
    const gastosPessoal3m = mesesHistorico.reduce((acc, m) => acc + m.gastosPessoal, 0)
    const lucro3m = receita3m - gastosEmpresa3m

    return {
      tituloPeriodo: 'Últimos 3 Meses',
      receita: receita3m,
      gastosEmpresa: gastosEmpresa3m,
      gastosPessoal: gastosPessoal3m,
      lucro: lucro3m,
    }
  }, [periodo, mesAtual, mesesHistorico])

  const lucroPositivo = metricasExibidas.lucro >= 0
  const maxValorGrafico = useMemo(() => {
    let max = 100
    for (const m of mesesHistorico) {
      if (m.receita > max) max = m.receita
      if (m.gastosEmpresa > max) max = m.gastosEmpresa
    }
    return max
  }, [mesesHistorico])

  return (
    <Card className="border-slate-200/80 shadow-sm bg-white overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Resultado do Mês (Receita × Gastos)
            </h3>
            <Badge
              variant="outline"
              className={
                lucroPositivo
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px] font-bold'
                  : 'bg-rose-50 text-rose-700 border-rose-300 text-[11px] font-bold'
              }
            >
              {lucroPositivo ? 'Lucro no Azul' : 'Atenção ao Fluxo'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Lucro apurado: cobranças pagas recebidas menos despesas da empresa. Gastos pessoais não
            diminuem seu lucro empresarial.
          </p>
        </div>

        {/* Botão para alternar o período: mês atual / últimos 3 meses */}
        <div className="flex items-center p-1 bg-slate-200/70 rounded-xl text-xs font-semibold self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setPeriodo('mes_atual')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodo === 'mes_atual'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mês Atual
          </button>
          <button
            type="button"
            onClick={() => setPeriodo('ultimos_3_meses')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              periodo === 'ultimos_3_meses'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Últimos 3 Meses
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* GRID PRINCIPAL DE MÉTRICAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* CARD 1: RECEITA DO MÊS */}
              <div
                onClick={() => navigate('/contas-a-receber')}
                className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group"
                title="Ver cobranças quitadas"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                  <span>Receita ({periodo === 'mes_atual' ? 'Mês' : '3 Meses'})</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
                  {formatarMoedaBRL(metricasExibidas.receita)}
                </div>
                <p className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center justify-between">
                  <span>Cobranças pagas</span>
                  <span className="group-hover:underline text-[10px]">Ver detalhes →</span>
                </p>
              </div>

              {/* CARD 2: GASTOS DA EMPRESA */}
              <div
                onClick={() => navigate('/gastos')}
                className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
                title="Ver gastos da empresa"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                  <span>Gastos da Empresa 🏢</span>
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
                  {formatarMoedaBRL(metricasExibidas.gastosEmpresa)}
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-1 flex items-center justify-between">
                  <span>Despesas operacionais</span>
                  <span className="group-hover:underline text-[10px]">Ver gastos →</span>
                </p>
              </div>

              {/* CARD 3: LUCRO / RESULTADO (DESTAQUE VISUAL VERDE/VERMELHO) */}
              <div
                className={`p-4 rounded-xl border-2 transition-all shadow-xs ${
                  lucroPositivo
                    ? 'border-emerald-500 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30'
                    : 'border-rose-500 bg-gradient-to-br from-rose-50/80 via-white to-rose-50/30'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className={lucroPositivo ? 'text-emerald-900' : 'text-rose-900'}>
                    {lucroPositivo ? 'Lucro do Negócio' : 'Déficit / Prejuízo'}
                  </span>
                  {lucroPositivo ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                  )}
                </div>
                <div
                  className={`text-xl sm:text-2xl font-black tabular-nums ${
                    lucroPositivo ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatarMoedaBRL(metricasExibidas.lucro)}
                </div>
                <p
                  className={`text-[11px] font-semibold mt-1 ${
                    lucroPositivo ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                >
                  {lucroPositivo
                    ? 'Receita supera despesas da empresa'
                    : 'Gastos de empresa superiores à receita'}
                </p>
              </div>

              {/* CARD 4: GASTOS PESSOAIS SEPARADOS */}
              <div
                onClick={() => navigate('/gastos')}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group"
                title="Ver gastos pessoais"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                  <span>Gastos Pessoais 🏠</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                    Separado
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-800 tabular-nums">
                  {formatarMoedaBRL(metricasExibidas.gastosPessoal)}
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-1 flex items-center justify-between">
                  <span>Sem abater do lucro da PJ</span>
                  <span className="group-hover:underline text-[10px]">Acessar →</span>
                </p>
              </div>
            </div>

            {/* MINI-GRÁFICO DE BARRAS DOS ÚLTIMOS 3 MESES (RECEITA VS. GASTOS DE EMPRESA) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Comparativo dos Últimos 3 Meses
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Evolução lado a lado da receita recebida versus despesas de empresa.
                  </p>
                </div>
                {/* LEGENDA */}
                <div className="flex items-center gap-3 text-xs font-medium self-start sm:self-auto">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
                    Receita
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-3 h-3 rounded bg-indigo-600 inline-block" />
                    Gastos Empresa
                  </span>
                </div>
              </div>

              {/* BARRAS COMPARATIVAS */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2">
                {mesesHistorico.map((mes) => {
                  const pctReceita = maxValorGrafico > 0 ? (mes.receita / maxValorGrafico) * 100 : 0
                  const pctGastos =
                    maxValorGrafico > 0 ? (mes.gastosEmpresa / maxValorGrafico) * 100 : 0

                  return (
                    <div
                      key={mes.chave}
                      className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between"
                    >
                      <div className="text-center pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800">{mes.rotulo}</span>
                        <div
                          className={`text-[11px] font-bold tabular-nums mt-0.5 ${
                            mes.lucro >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          Lucro: {formatarMoedaBRL(mes.lucro)}
                        </div>
                      </div>

                      {/* Visual das Barras com altura de 80px */}
                      <div className="h-24 sm:h-28 flex items-end justify-center gap-2 sm:gap-3 py-2">
                        {/* Barra Receita */}
                        <div className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="text-[9px] font-bold text-slate-500 tabular-nums mb-1 hidden sm:block">
                            {formatarMoedaBRL(mes.receita)}
                          </span>
                          <div
                            style={{ height: `${Math.max(6, pctReceita)}%` }}
                            className="w-full max-w-[28px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-500 shadow-xs"
                            title={`Receita: ${formatarMoedaBRL(mes.receita)}`}
                          />
                        </div>

                        {/* Barra Gastos Empresa */}
                        <div className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="text-[9px] font-bold text-slate-500 tabular-nums mb-1 hidden sm:block">
                            {formatarMoedaBRL(mes.gastosEmpresa)}
                          </span>
                          <div
                            style={{ height: `${Math.max(6, pctGastos)}%` }}
                            className="w-full max-w-[28px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all duration-500 shadow-xs"
                            title={`Gastos Empresa: ${formatarMoedaBRL(mes.gastosEmpresa)}`}
                          />
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-700 font-semibold">Rec:</span>
                          <span className="font-bold tabular-nums text-slate-800">
                            {formatarMoedaBRL(mes.receita)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-indigo-700 font-semibold">Emp:</span>
                          <span className="font-bold tabular-nums text-slate-800">
                            {formatarMoedaBRL(mes.gastosEmpresa)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* RODAPÉ EXPLICATIVO */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  Dica: Para manter o fluxo saudável, registre abastecimentos, peças e notas assim
                  que efetuar o pagamento.
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/gastos')}
                  className="h-7 text-xs text-indigo-600 hover:text-indigo-800 p-0 self-start sm:self-auto font-semibold"
                >
                  Abrir Gestão Completa de Gastos
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
export default ResultadoDoMesCard
