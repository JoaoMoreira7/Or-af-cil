import React from 'react'
import {
  Sparkles,
  Clock,
  Calendar,
  DollarSign,
  ArrowRight,
  TrendingUp,
  FileText,
  CheckCircle,
} from 'lucide-react'
import { Orçamento, formatarMoedaBRL } from '@/types'
import { Badge } from '@/components/ui/badge'

export interface ResumoManhaCardProps {
  orcamentos: Orçamento[]
  userName?: string
  onVerAguardando?: () => void
  onVerReceber?: () => void
}

/**
 * Normaliza e compara se uma data ISO ou string de prazo cai no dia de hoje (considerando timezone local)
 */
export function ehPrazoHoje(dataPrazoStr?: string | null): boolean {
  if (!dataPrazoStr || typeof dataPrazoStr !== 'string') return false

  try {
    const hoje = new Date()
    const hojeAno = hoje.getFullYear()
    const hojeMes = hoje.getMonth()
    const hojeDia = hoje.getDate()

    // 1. Tenta formato YYYY-MM-DD ou ISO
    const d = new Date(dataPrazoStr)
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() === hojeAno && d.getMonth() === hojeMes && d.getDate() === hojeDia) {
        return true
      }
    }

    // 2. Tenta formato DD/MM/YYYY
    const partes = dataPrazoStr.split('/')
    if (partes.length === 3) {
      const dia = parseInt(partes[0], 10)
      const mes = parseInt(partes[1], 10) - 1
      const ano = parseInt(partes[2], 10)
      if (dia === hojeDia && mes === hojeMes && ano === hojeAno) {
        return true
      }
    }

    // 3. Menção textual "hoje"
    if (dataPrazoStr.toLowerCase().includes('hoje')) {
      return true
    }
  } catch {
    return false
  }

  return false
}

export function ResumoManhaCard({
  orcamentos,
  userName = 'Gestor(a)',
  onVerAguardando,
  onVerReceber,
}: ResumoManhaCardProps) {
  // Saudação de acordo com o horário do dia
  const saudacaoHorario = React.useMemo(() => {
    const hora = new Date().getHours()
    if (hora >= 5 && hora < 12) return 'Bom dia'
    if (hora >= 12 && hora < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  // 1. Orçamentos aguardando aprovação (enviados e rascunhos ativos): quantidade e valor
  const orcamentosAguardando = React.useMemo(() => {
    return orcamentos.filter((o) => o.status === 'enviado' || o.status === 'rascunho')
  }, [orcamentos])

  const qtdAguardando = orcamentosAguardando.length
  const valorAguardando = React.useMemo(() => {
    return orcamentosAguardando.reduce((acc, cur) => acc + (Number(cur.valor_total) || 0), 0)
  }, [orcamentosAguardando])

  // 2. Serviços com prazo para hoje (itens ou orçamentos com data de entrega / prazo hoje)
  const servicosPrazoHoje = React.useMemo(() => {
    const hoje = new Date()
    const hojeIsoInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()
    const hojeIsoFim = hojeIsoInicio + 24 * 60 * 60 * 1000

    return orcamentos.filter((o) => {
      // Ignora cancelados ou rejeitados
      if (o.status === 'cancelado' || o.status === 'rejeitado') return false

      // Verifica no texto da descrição se há indicação de prazo para hoje
      if (ehPrazoHoje(o.descricao)) return true

      // Verifica nos itens
      if (Array.isArray(o.itens)) {
        for (const it of o.itens) {
          if (it.descricao && ehPrazoHoje(it.descricao)) return true
        }
      }

      // Se a data de atualização ou emissão for de hoje em orçamento aprovado em execução
      const dataEmissao = new Date(o.created).getTime()
      if (o.status === 'aprovado' && dataEmissao >= hojeIsoInicio && dataEmissao < hojeIsoFim) {
        return true
      }

      return false
    })
  }, [orcamentos])

  const qtdServicosPrazoHoje = servicosPrazoHoje.length

  // 3. Total a receber dos orçamentos aprovados ainda não pagos / em aberto
  // No modelo atual de dados, orçamentos com status 'aprovado' representam receitas confirmadas a receber
  const orcamentosAprovados = React.useMemo(() => {
    return orcamentos.filter((o) => o.status === 'aprovado')
  }, [orcamentos])

  const qtdAprovados = orcamentosAprovados.length
  const totalAReceber = React.useMemo(() => {
    return orcamentosAprovados.reduce((acc, cur) => acc + (Number(cur.valor_total) || 0), 0)
  }, [orcamentosAprovados])

  // Frase em tom de assistente
  const textoAssistente = React.useMemo(() => {
    const partes: string[] = []

    if (qtdAguardando > 0) {
      partes.push(
        `${qtdAguardando} ${
          qtdAguardando === 1 ? 'orçamento aguardando resposta' : 'orçamentos aguardando resposta'
        } (${formatarMoedaBRL(valorAguardando)})`,
      )
    } else {
      partes.push('nenhum orçamento pendente de aprovação')
    }

    if (qtdServicosPrazoHoje > 0) {
      partes.push(
        `${qtdServicosPrazoHoje} ${
          qtdServicosPrazoHoje === 1
            ? 'serviço com prazo para hoje'
            : 'serviços com prazo para hoje'
        }`,
      )
    } else {
      partes.push('nenhum prazo imediato para hoje')
    }

    if (totalAReceber > 0) {
      partes.push(`${formatarMoedaBRL(totalAReceber)} a receber`)
    } else {
      partes.push('nenhum saldo a receber pendente')
    }

    return `${saudacaoHorario}, ${userName}! Você tem ${partes[0]}, ${partes[1]} e ${partes[2]}.`
  }, [
    saudacaoHorario,
    userName,
    qtdAguardando,
    valorAguardando,
    qtdServicosPrazoHoje,
    totalAReceber,
  ])

  return (
    <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 rounded-3xl p-5 sm:p-7 text-white shadow-lg relative overflow-hidden animate-fade-in">
      {/* BACKGROUND ACCENTS */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-violet-400/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 space-y-5">
        {/* TOPO: BADGE ASSISTENTE & DATA DE HOJE */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-300 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-blue-200">
                Assistente de Voz IA · Resumo de Hoje
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                Resumo da Manhã & Operações
              </h3>
            </div>
          </div>

          <Badge className="bg-white/15 hover:bg-white/20 text-white border-white/20 text-xs font-semibold px-3 py-1">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-200" />
            {new Intl.DateTimeFormat('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(new Date())}
          </Badge>
        </div>
        {/* MENSAGEM DO ASSISTENTE */}
        <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
          <p className="text-sm sm:text-base font-medium text-white/95 leading-relaxed">
            &ldquo;{textoAssistente}&rdquo;
          </p>
        </div>
        {/* 3 INDICADORES RESUMIDOS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* 1. Aguardando Aprovação */}
          <div
            onClick={onVerAguardando}
            className={`p-3.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 transition-transform hover:-translate-y-0.5 ${
              onVerAguardando ? 'cursor-pointer hover:bg-white/15' : ''
            }`}
          >
            <div className="flex items-center justify-between text-blue-200 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                Aguardando Resposta
              </span>
              <span className="text-white font-bold">{qtdAguardando}</span>
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-black text-white tabular-nums block">
                {formatarMoedaBRL(valorAguardando)}
              </span>
              <span className="text-[11px] text-blue-200/80">
                {qtdAguardando === 1 ? '1 proposta aberta' : `${qtdAguardando} propostas abertas`}
              </span>
            </div>
          </div>

          {/* 2. Serviços com Prazo Hoje */}
          <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15">
            <div className="flex items-center justify-between text-blue-200 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                Prazo para Hoje
              </span>
              <span className="text-white font-bold">{qtdServicosPrazoHoje}</span>
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-black text-white tabular-nums block">
                {qtdServicosPrazoHoje}{' '}
                <span className="text-sm font-semibold text-blue-200">
                  {qtdServicosPrazoHoje === 1 ? 'serviço' : 'serviços'}
                </span>
              </span>
              <span className="text-[11px] text-blue-200/80">Entregas e cronograma de hoje</span>
            </div>
          </div>

          {/* 3. Total a Receber (Atalho para Contas a Receber) */}
          <div
            onClick={onVerReceber}
            className={`p-3.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 transition-transform hover:-translate-y-0.5 ${
              onVerReceber ? 'cursor-pointer hover:bg-white/15' : ''
            }`}
            title="Ver página Contas a Receber"
          >
            <div className="flex items-center justify-between text-blue-200 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
                Total a Receber
              </span>
              <span className="text-white font-bold">{qtdAprovados}</span>
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-black text-white tabular-nums block">
                {formatarMoedaBRL(totalAReceber)}
              </span>
              <span className="text-[11px] text-blue-200/80 flex items-center justify-between">
                <span>
                  De {qtdAprovados}{' '}
                  {qtdAprovados === 1 ? 'orçamento aprovado' : 'orçamentos aprovados'}
                </span>
                <span className="font-bold underline text-white/90">Abrir lista →</span>
              </span>
            </div>
          </div>
        </div>{' '}
      </div>
    </div>
  )
}
