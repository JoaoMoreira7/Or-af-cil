import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Layers,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  FileText,
  Volume2,
  Wrench,
  Fuel,
  Utensils,
  Home,
  Users,
  Receipt,
  HelpCircle,
  X,
  Check,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { gastosService } from '@/services/gastos'
import { orcamentosService } from '@/services/orcamentos'
import { aiInterpretarService } from '@/services/aiInterpretar'
import { acoesVozService } from '@/services/acoesVoz'
import { preferenciasIaService } from '@/services/preferenciasIa'
import { VoiceRecorder } from '@/components/VoiceRecorder'
import { ReciboAcaoVoz } from '@/components/ReciboAcaoVoz'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Gasto,
  CategoriaGasto,
  OrigemGasto,
  AcaoVozRegistro,
  PreferenciasIa,
  Orçamento,
  formatarMoedaBRL,
  formatarData,
} from '@/types'

const CATEGORIAS: CategoriaGasto[] = [
  'Material',
  'Transporte',
  'Alimentação',
  'Moradia/Aluguel',
  'Ferramentas',
  'Serviços terceirizados',
  'Impostos/Taxas',
  'Outros',
]

interface CategoriaConfig {
  label: string
  icon: React.ReactNode
  color: string
  bg: string
  border: string
}

const CATEGORIA_CONFIG: Record<CategoriaGasto, CategoriaConfig> = {
  Material: {
    label: 'Material',
    icon: <Layers className="w-3.5 h-3.5" />,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  Transporte: {
    label: 'Transporte',
    icon: <Fuel className="w-3.5 h-3.5" />,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  Alimentação: {
    label: 'Alimentação',
    icon: <Utensils className="w-3.5 h-3.5" />,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  'Moradia/Aluguel': {
    label: 'Moradia / Aluguel',
    icon: <Home className="w-3.5 h-3.5" />,
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  Ferramentas: {
    label: 'Ferramentas',
    icon: <Wrench className="w-3.5 h-3.5" />,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  'Serviços terceirizados': {
    label: 'Serviços Terceirizados',
    icon: <Users className="w-3.5 h-3.5" />,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
  'Impostos/Taxas': {
    label: 'Impostos / Taxas',
    icon: <Receipt className="w-3.5 h-3.5" />,
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  Outros: {
    label: 'Outros',
    icon: <HelpCircle className="w-3.5 h-3.5" />,
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
  },
}

export function Gastos() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isMountedRef = useRef<boolean>(true)

  // Estados principais
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [orcamentos, setOrcamentos] = useState<Orçamento[]>([])
  const [preferenciasIa, setPreferenciasIa] = useState<PreferenciasIa | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [ultimoRecibo, setUltimoRecibo] = useState<AcaoVozRegistro | null>(null)
  const [undoingAcaoId, setUndoingAcaoId] = useState<string | null>(null)

  // Filtros
  const mesAtualPadrao = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const [mesFiltro, setMesFiltro] = useState<string>(mesAtualPadrao)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [contextoFiltro, setContextoFiltro] = useState<'todos' | 'empresa' | 'pessoal'>('todos')

  // Card "O que a IA entendeu" (Pós-gravação de voz)
  const [reviewCardOpen, setReviewCardOpen] = useState<boolean>(false)
  const [reviewDescricao, setReviewDescricao] = useState<string>('')
  const [reviewValor, setReviewValor] = useState<number>(0)
  const [reviewCategoria, setReviewCategoria] = useState<CategoriaGasto>('Outros')
  const [reviewContexto, setReviewContexto] = useState<'empresa' | 'pessoal'>('empresa')
  const [reviewData, setReviewData] = useState<string>(new Date().toISOString().slice(0, 10))
  const [reviewOrcamentoId, setReviewOrcamentoId] = useState<string>('')
  const [reviewMensagemIa, setReviewMensagemIa] = useState<string>('')
  const [reviewDuvidas, setReviewDuvidas] = useState<string[]>([])
  const [isApplyingVoiceGasto, setIsApplyingVoiceGasto] = useState<boolean>(false)

  // Resposta em voz falada / consulta de gastos
  const [respostaConsultaGastos, setRespostaConsultaGastos] = useState<string | null>(null)

  // Modais de Edição e Exclusão manual
  const [modalManualOpen, setModalManualOpen] = useState<boolean>(false)
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null)
  const [manualDescricao, setManualDescricao] = useState<string>('')
  const [manualValor, setManualValor] = useState<string>('')
  const [manualCategoria, setManualCategoria] = useState<CategoriaGasto>('Outros')
  const [manualContexto, setManualContexto] = useState<'empresa' | 'pessoal'>('empresa')
  const [manualData, setManualData] = useState<string>(new Date().toISOString().slice(0, 10))
  const [manualOrcamentoId, setManualOrcamentoId] = useState<string>('')
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false)

  // Modal de Exclusão com confirmação
  const [gastoExcluir, setGastoExcluir] = useState<Gasto | null>(null)
  const [isExcluindo, setIsExcluindo] = useState<boolean>(false)

  // Modal para confirmar comando falado "desfaz aquilo"
  const [confirmarDesfazerVozAcao, setConfirmarDesfazerVozAcao] = useState<AcaoVozRegistro | null>(
    null,
  )

  // REGRA CRÍTICA DE BUGS: isMountedRef para evitar bugs pós-unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Carregar gastos e orçamentos
  const carregarDados = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [gastosData, orcsData, ultAcao, pref] = await Promise.all([
        gastosService.listar({
          mesAno: mesFiltro || undefined,
          categoria: categoriaFiltro !== 'todas' ? categoriaFiltro : undefined,
          contexto: contextoFiltro,
        }),
        orcamentosService.listar(),
        acoesVozService.obterUltimaAcaoAtiva24h(user.id),
        preferenciasIaService.obter(user.id),
      ])

      if (isMountedRef.current) {
        setGastos(gastosData)
        setOrcamentos(orcsData)
        setUltimoRecibo(ultAcao)
        setPreferenciasIa(pref)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao carregar gastos'
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar dados',
          description: msg,
        })
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [user?.id, mesFiltro, categoriaFiltro, contextoFiltro, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Processamento do áudio ditado pelo usuário
  const handleVoiceTranscribed = async (transcricao: string) => {
    if (!transcricao.trim() || !user?.id) return
    setRespostaConsultaGastos(null)

    try {
      const resp = await aiInterpretarService.interpretar({
        transcricao: transcricao.trim(),
        contexto: 'gasto',
        userId: user.id,
        preferencias: preferenciasIa
          ? {
              nome_preferido: preferenciasIa.nome_preferido,
              tom_resposta: preferenciasIa.tom_resposta,
              usar_emojis: preferenciasIa.usar_emojis,
            }
          : undefined,
      })

      if (!isMountedRef.current) return

      // Caso 1: Comando de desfazer ("desfaz aquilo", "desfazer o último")
      if (
        resp.interpretacao?.comando_desfazer ||
        resp.interpretacao?.intencao_detectada === 'desfazer'
      ) {
        const ultimaAcao = await acoesVozService.obterUltimaAcaoAtiva24h(user.id)
        if (ultimaAcao) {
          setConfirmarDesfazerVozAcao(ultimaAcao)
          toast({
            title: 'Comando de desfazer reconhecido',
            description: `Deseja desfazer "${ultimaAcao.titulo}"?`,
          })
        } else {
          toast({
            title: 'Nenhuma ação recente',
            description: 'Não encontramos ações de voz ativas nas últimas 24 horas.',
          })
        }
        return
      }

      // Caso 2: Consulta "quanto gastei esse mês?"
      if (
        resp.interpretacao?.intencao_detectada === 'consulta_gastos' ||
        resp.interpretacao?.comando_consulta_gastos
      ) {
        const msg =
          resp.interpretacao?.comando_consulta_gastos?.mensagem_resposta ||
          'Consulta de gastos realizada!'
        setRespostaConsultaGastos(msg)
        toast({
          title: 'Resumo de Gastos',
          description: msg,
        })
        return
      }

      // Caso 3: Registro de Gasto identificado
      const gExt = resp.interpretacao?.gasto_extraido
      if (gExt) {
        setReviewDescricao(gExt.descricao || transcricao.trim())
        setReviewValor(gExt.valor || 0)
        setReviewCategoria(gExt.categoria || 'Outros')
        setReviewContexto(
          gExt.contexto === 'pessoal'
            ? 'pessoal'
            : preferenciasIa?.contexto_gasto_padrao || 'empresa',
        )
        setReviewData(gExt.data || new Date().toISOString().slice(0, 10))
        setReviewOrcamentoId(gExt.orcamento_vinculado_id || '')
        setReviewMensagemIa(gExt.mensagem_resposta || '')
        setReviewDuvidas(resp.interpretacao.duvidas || [])
        setReviewCardOpen(true)

        toast({
          title: 'Gasto interpretado pela IA!',
          description: gExt.mensagem_resposta || 'Confira os dados abaixo e confirme para gravar.',
        })
      } else {
        // Fallback genérico caso não tenha vindo objeto de gasto
        setReviewDescricao(transcricao.trim())
        setReviewValor(0)
        setReviewCategoria('Outros')
        setReviewContexto(preferenciasIa?.contexto_gasto_padrao || 'empresa')
        setReviewData(new Date().toISOString().slice(0, 10))
        setReviewOrcamentoId('')
        setReviewMensagemIa(
          'Não consegui identificar o valor com exatidão. Por favor, ajuste abaixo.',
        )
        setReviewDuvidas(['Qual o valor exato gasto?'])
        setReviewCardOpen(true)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao processar áudio'
        toast({
          variant: 'destructive',
          title: 'Erro na IA de Voz',
          description: msg,
        })
      }
    }
  }

  // Confirmar e aplicar o card de gasto por voz
  const handleConfirmarGastoVoz = async () => {
    if (!user?.id) return
    if (!reviewDescricao.trim()) {
      toast({
        variant: 'destructive',
        title: 'Descrição necessária',
        description: 'Informe o que foi comprado ou pago.',
      })
      return
    }

    if (reviewValor <= 0) {
      toast({
        variant: 'destructive',
        title: 'Valor inválido',
        description: 'O valor do gasto deve ser maior que zero.',
      })
      return
    }

    setIsApplyingVoiceGasto(true)
    try {
      const novoGasto = await gastosService.criar({
        descricao: reviewDescricao.trim(),
        valor: reviewValor,
        categoria: reviewCategoria,
        contexto: reviewContexto,
        data: reviewData || new Date().toISOString().slice(0, 10),
        origem: 'voz',
        orcamento_vinculado: reviewOrcamentoId || null,
      })

      // Gerar recibo em acoes_voz com validade 24h para Desfazer
      const recibo = await acoesVozService.registrar({
        tipo_acao: 'registro_gasto',
        titulo: `Gasto registrado (${reviewContexto === 'pessoal' ? '🏠 Pessoal' : '🏢 Empresa'}): ${formatarMoedaBRL(novoGasto.valor)}`,
        descricao_resumo: `${novoGasto.descricao} · Categoria: ${novoGasto.categoria} · Contexto: ${reviewContexto === 'pessoal' ? 'Pessoal' : 'Empresa'}`,
        registro_id: novoGasto.id,
        dados_aplicados: {
          gasto_id: novoGasto.id,
          descricao: novoGasto.descricao,
          valor: novoGasto.valor,
          categoria: novoGasto.categoria,
          contexto: reviewContexto,
          data: novoGasto.data,
          origem: 'voz',
          orcamento_vinculado: reviewOrcamentoId || null,
        },
        user_id: user.id,
      })

      if (isMountedRef.current) {
        setUltimoRecibo(recibo)
        setReviewCardOpen(false)
        await carregarDados()
        toast({
          title: 'Gasto Gravado com Sucesso!',
          description: `${novoGasto.descricao} · ${formatarMoedaBRL(novoGasto.valor)} salvo no mês.`,
        })
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao salvar gasto'
        toast({
          variant: 'destructive',
          title: 'Erro ao gravar',
          description: msg,
        })
      }
    } finally {
      if (isMountedRef.current) {
        setIsApplyingVoiceGasto(false)
      }
    }
  }

  // Desfazer Ação (Recibo 24h)
  const handleDesfazerAcao = async (acao: AcaoVozRegistro) => {
    setUndoingAcaoId(acao.id)
    try {
      const res = await acoesVozService.desfazer(acao)
      if (res.sucesso) {
        toast({
          title: 'Ação desfeita com sucesso!',
          description: res.mensagem,
        })
        if (ultimoRecibo?.id === acao.id) {
          setUltimoRecibo((prev) => (prev ? { ...prev, status: 'desfeito' } : null))
        }
        await carregarDados()
      } else {
        toast({
          variant: 'destructive',
          title: 'Não foi possível desfazer',
          description: res.mensagem,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao desfazer'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    } finally {
      setUndoingAcaoId(null)
      setConfirmarDesfazerVozAcao(null)
    }
  }

  // Abrir modal de criação manual
  const handleNovoGastoManual = () => {
    setGastoEditando(null)
    setManualDescricao('')
    setManualValor('')
    setManualCategoria('Outros')
    setManualContexto(preferenciasIa?.contexto_gasto_padrao || 'empresa')
    setManualData(new Date().toISOString().slice(0, 10))
    setManualOrcamentoId('')
    setModalManualOpen(true)
  }

  // Abrir modal de edição manual
  const handleEditarGasto = (g: Gasto) => {
    setGastoEditando(g)
    setManualDescricao(g.descricao)
    setManualValor(String(g.valor))
    setManualCategoria(g.categoria)
    setManualContexto(g.contexto === 'pessoal' ? 'pessoal' : 'empresa')
    setManualData(g.data ? g.data.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setManualOrcamentoId(g.orcamento_vinculado || '')
    setModalManualOpen(true)
  }

  // Salvar manual (criação ou edição)
  const handleSalvarManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    const valNum = parseFloat(manualValor.replace(',', '.'))
    if (isNaN(valNum) || valNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero.',
      })
      return
    }

    if (!manualDescricao.trim()) {
      toast({
        variant: 'destructive',
        title: 'Descrição necessária',
        description: 'Informe o detalhe do gasto.',
      })
      return
    }

    setIsSavingManual(true)
    try {
      if (gastoEditando) {
        await gastosService.atualizar(gastoEditando.id, {
          descricao: manualDescricao.trim(),
          valor: valNum,
          categoria: manualCategoria,
          contexto: manualContexto,
          data: manualData,
          orcamento_vinculado: manualOrcamentoId || null,
        })
        toast({
          title: 'Gasto atualizado!',
          description: 'Alterações gravadas com sucesso.',
        })
      } else {
        const novo = await gastosService.criar({
          descricao: manualDescricao.trim(),
          valor: valNum,
          categoria: manualCategoria,
          contexto: manualContexto,
          data: manualData,
          origem: 'manual',
          orcamento_vinculado: manualOrcamentoId || null,
        })

        // Recibo acoes_voz para permitir desfazer
        const recibo = await acoesVozService.registrar({
          tipo_acao: 'registro_gasto',
          titulo: `Gasto manual (${manualContexto === 'pessoal' ? '🏠 Pessoal' : '🏢 Empresa'}): ${formatarMoedaBRL(novo.valor)}`,
          descricao_resumo: `${novo.descricao} · Categoria: ${novo.categoria} · Contexto: ${manualContexto === 'pessoal' ? 'Pessoal' : 'Empresa'}`,
          registro_id: novo.id,
          dados_aplicados: {
            gasto_id: novo.id,
            descricao: novo.descricao,
            valor: novo.valor,
            categoria: novo.categoria,
            contexto: manualContexto,
            data: novo.data,
            origem: 'manual',
          },
          user_id: user.id,
        })
        setUltimoRecibo(recibo)

        toast({
          title: 'Gasto adicionado!',
          description: `${formatarMoedaBRL(valNum)} registrado com sucesso.`,
        })
      }

      setModalManualOpen(false)
      await carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    } finally {
      setIsSavingManual(false)
    }
  }

  // Excluir gasto manualmente
  const handleConfirmarExclusao = async () => {
    if (!gastoExcluir) return
    setIsExcluindo(true)
    try {
      await gastosService.excluir(gastoExcluir.id)
      toast({
        title: 'Gasto excluído',
        description: `O registro "${gastoExcluir.descricao}" foi removido.`,
      })
      setGastoExcluir(null)
      await carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    } finally {
      setIsExcluindo(false)
    }
  }

  // Cálculos de totais da listagem atual (separados por empresa e pessoal)
  const totalGasto = gastos.reduce((acc, g) => acc + (Number(g.valor) || 0), 0)
  const totalGastoEmpresa = gastos
    .filter((g) => (g.contexto || 'empresa') === 'empresa')
    .reduce((acc, g) => acc + (Number(g.valor) || 0), 0)
  const totalGastoPessoal = gastos
    .filter((g) => g.contexto === 'pessoal')
    .reduce((acc, g) => acc + (Number(g.valor) || 0), 0)

  const qtdEmpresa = gastos.filter((g) => (g.contexto || 'empresa') === 'empresa').length
  const qtdPessoal = gastos.filter((g) => g.contexto === 'pessoal').length

  const gastosPorCategoria = CATEGORIAS.map((cat) => {
    const totalCat = gastos
      .filter((g) => g.categoria === cat)
      .reduce((acc, g) => acc + (Number(g.valor) || 0), 0)
    return {
      categoria: cat,
      total: totalCat,
      quantidade: gastos.filter((g) => g.categoria === cat).length,
    }
  }).filter((c) => c.total > 0)

  // Meses para dropdown de filtro (últimos 12 meses)
  const mesesOpcoes = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const val = d.toISOString().slice(0, 7)
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d)
    return {
      valor: val,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    }
  })

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-6xl mx-auto">
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Gastos & Despesas
            </h2>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-semibold">
              Registro por Voz com IA
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Dite seus gastos no estilo WhatsApp e a IA organiza tudo automaticamente: valor,
            categoria, data e vínculo com obras.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleNovoGastoManual}
            variant="outline"
            size="sm"
            className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Gasto Manual
          </Button>
        </div>
      </div>

      {/* ÁREA DE GRAVAÇÃO DE VOZ ESTILO WHATSAPP (RECURSO PRINCIPAL) */}
      <Card className="border-2 border-emerald-400/80 bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 shadow-md overflow-hidden">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-600" />
                  Ditar Gasto por Voz
                </h3>
              </div>
              <p className="text-xs text-slate-600">
                Fale naturalmente: <em>&ldquo;Gastei 150 reais de gasolina hoje&rdquo;</em>,{' '}
                <em>&ldquo;Comprei 340 de material elétrico da obra 2&rdquo;</em> ou pergunte{' '}
                <em>&ldquo;Quanto gastei esse mês?&rdquo;</em>
              </p>
            </div>
            <Badge
              variant="outline"
              className="self-start sm:self-auto text-[11px] bg-white border-emerald-300 text-emerald-800"
            >
              <Sparkles className="w-3 h-3 mr-1 text-emerald-600" />
              IA Financeira Ativa
            </Badge>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl border border-emerald-200/80 shadow-xs">
            <VoiceRecorder
              onSendTranscript={handleVoiceTranscribed}
              placeholder="Segure ou clique no microfone para falar o que gastou..."
              compact={false}
            />
          </div>

          {/* RESPOSTA FALADA DE CONSULTA DE GASTOS SE HOUVER */}
          {respostaConsultaGastos && (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-start gap-3 animate-fade-in">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h5 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                  Resposta da IA
                </h5>
                <p className="text-xs text-emerald-900 mt-0.5 leading-relaxed">
                  {respostaConsultaGastos}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRespostaConsultaGastos(null)}
                className="text-emerald-700 hover:text-emerald-900 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CARD "O QUE A IA ENTENDEU" (EDITÁVEL ANTES DE APLICAR) */}
      {reviewCardOpen && (
        <Card className="border-2 border-emerald-600 bg-white shadow-xl animate-scale-in">
          <CardHeader className="pb-3 border-b border-slate-100 bg-emerald-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    O que a IA entendeu do seu gasto
                  </CardTitle>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {reviewMensagemIa ||
                      'Revise e ajuste os dados antes de gravar no seu controle.'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReviewCardOpen(false)}
                className="text-slate-400 hover:text-slate-700 h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            {reviewDuvidas.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Atenção da IA:</span>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {reviewDuvidas.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-700">Descrição do Gasto *</label>
                <Input
                  value={reviewDescricao}
                  onChange={(e) => setReviewDescricao(e.target.value)}
                  placeholder="Ex: Gasolina, Almoço da equipe..."
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Valor (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={reviewValor || ''}
                  onChange={(e) => setReviewValor(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 h-9 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Contexto / Destino *</label>
                <Select
                  value={reviewContexto}
                  onValueChange={(v) => setReviewContexto(v as 'empresa' | 'pessoal')}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs font-semibold">
                    <SelectValue placeholder="Contexto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empresa" className="text-xs font-medium">
                      🏢 Empresa (PJ / Negócio)
                    </SelectItem>
                    <SelectItem value="pessoal" className="text-xs font-medium">
                      🏠 Pessoal (PF / Casa)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Categoria</label>
                <Select
                  value={reviewCategoria}
                  onValueChange={(v) => setReviewCategoria(v as CategoriaGasto)}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Selecione categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {CATEGORIA_CONFIG[cat].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Data do Gasto</label>
                <Input
                  type="date"
                  value={reviewData}
                  onChange={(e) => setReviewData(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            {/* Vínculo opcional com Orçamento */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Vincular a um Orçamento / Obra (opcional)
              </label>
              <Select
                value={reviewOrcamentoId || 'nenhum'}
                onValueChange={(v) => setReviewOrcamentoId(v === 'nenhum' ? '' : v)}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Nenhum vínculo (gasto geral)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum" className="text-xs">
                    Nenhum vínculo (gasto geral)
                  </SelectItem>
                  {orcamentos.map((orc) => (
                    <SelectItem key={orc.id} value={orc.id} className="text-xs">
                      {orc.numero} - {orc.descricao?.slice(0, 45) || 'Orçamento'} (
                      {formatarMoedaBRL(orc.valor_total)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReviewCardOpen(false)}
                className="h-9 text-xs text-slate-600"
              >
                Descartar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmarGastoVoz}
                disabled={isApplyingVoiceGasto}
                className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
              >
                {isApplyingVoiceGasto ? 'Gravando...' : 'Gravar Gasto & Gerar Recibo'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RECIBO DA ÚLTIMA AÇÃO APLICADA (24h com suporte a DESFAZER e EDITAR) */}
      {ultimoRecibo && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Recibo da Última Ação do Assistente
            </h4>
            <span className="text-[11px] text-slate-400">Desfizável nas últimas 24h</span>
          </div>
          <ReciboAcaoVoz
            acao={ultimoRecibo}
            onDesfazer={handleDesfazerAcao}
            onEditar={(acao) => {
              const dados = acao.dados_aplicados as Record<string, unknown>
              if (acao.tipo_acao === 'registro_gasto' && (acao.registro_id || dados?.gasto_id)) {
                const gId = (acao.registro_id || dados.gasto_id) as string
                const g = gastos.find((item) => item.id === gId)
                if (g) handleEditarGasto(g)
              }
            }}
            isUndoing={undoingAcaoId === ultimoRecibo.id}
          />
        </div>
      )}

      {/* SEGMENTADOR NO TOPO: TODOS / EMPRESA / PESSOAL */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 max-w-fit">
        <button
          type="button"
          onClick={() => setContextoFiltro('todos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            contextoFiltro === 'todos'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Todos os Gastos</span>
          <Badge
            variant="secondary"
            className="text-[10px] py-0 px-1.5 bg-slate-100 text-slate-700"
          >
            {gastos.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setContextoFiltro('empresa')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            contextoFiltro === 'empresa'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-white/60'
          }`}
        >
          <span>🏢 Empresa</span>
          <Badge
            variant="secondary"
            className={`text-[10px] py-0 px-1.5 ${
              contextoFiltro === 'empresa'
                ? 'bg-indigo-700 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {qtdEmpresa}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setContextoFiltro('pessoal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            contextoFiltro === 'pessoal'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-emerald-900 hover:bg-white/60'
          }`}
        >
          <span>🏠 Pessoal</span>
          <Badge
            variant="secondary"
            className={`text-[10px] py-0 px-1.5 ${
              contextoFiltro === 'pessoal'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {qtdPessoal}
          </Badge>
        </button>
      </div>

      {/* CARDS DE TOTAIS DO MÊS (SEPARADOS EMPRESA × PESSOAL) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Empresa */}
        <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-none shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">🏢 Gastos da Empresa</span>
              <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-400/30 text-[10px]">
                Dedutível
              </Badge>
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-black text-white tabular-nums">
              {formatarMoedaBRL(totalGastoEmpresa)}
            </div>
            <p className="text-xs text-indigo-200/80 mt-1">
              {qtdEmpresa} registro(s) da operação comercial
            </p>
          </CardContent>
        </Card>

        {/* Total Pessoal */}
        <Card className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white border-none shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <CardHeader className="pb-2">
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">🏠 Gastos Pessoais</span>
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[10px]">
                PF / Casa
              </Badge>
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-black text-white tabular-nums">
              {formatarMoedaBRL(totalGastoPessoal)}
            </div>
            <p className="text-xs text-emerald-200/80 mt-1">
              {qtdPessoal} registro(s) sem misturar no lucro
            </p>
          </CardContent>
        </Card>

        {/* Total Geral / Resumo do Filtro */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-slate-700" />
              Total Geral (
              {contextoFiltro === 'todos'
                ? 'Empresa + Pessoal'
                : contextoFiltro === 'empresa'
                  ? 'Somente Empresa'
                  : 'Somente Pessoal'}
              )
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
              {formatarMoedaBRL(totalGasto)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {gastos.length} registro(s) no período de {mesFiltro || 'todos os meses'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DIVISÃO POR CATEGORIA */}
      {gastosPorCategoria.length > 0 && (
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-violet-600" />
              Divisão por Categoria (
              {contextoFiltro === 'todos'
                ? 'Geral'
                : contextoFiltro === 'empresa'
                  ? 'Empresa'
                  : 'Pessoal'}
              )
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 pt-1">
              {gastosPorCategoria.map((item) => {
                const cfg = CATEGORIA_CONFIG[item.categoria]
                const pct = totalGasto > 0 ? ((item.total / totalGasto) * 100).toFixed(0) : 0
                return (
                  <div
                    key={item.categoria}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${cfg.bg} ${cfg.color} ${cfg.border}`}
                  >
                    {cfg.icon}
                    <span className="font-semibold">{cfg.label}:</span>
                    <span className="tabular-nums font-bold">{formatarMoedaBRL(item.total)}</span>
                    <span className="text-[10px] opacity-75">({pct}%)</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BARRA DE FILTROS E BUSCA */}
      <Card className="border-slate-200/80 shadow-xs bg-white">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Filtros:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Filtro Mês */}
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <Select value={mesFiltro} onValueChange={setMesFiltro}>
                  <SelectTrigger className="h-8 text-xs w-[170px] bg-white border-slate-300">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">
                      Todos os meses
                    </SelectItem>
                    {mesesOpcoes.map((m) => (
                      <SelectItem key={m.valor} value={m.valor} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Categoria */}
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                  <SelectTrigger className="h-8 text-xs w-[160px] bg-white border-slate-300">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-xs">
                      Todas categorias
                    </SelectItem>
                    {CATEGORIAS.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {CATEGORIA_CONFIG[cat].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(mesFiltro !== mesAtualPadrao ||
                categoriaFiltro !== 'todas' ||
                contextoFiltro !== 'todos') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMesFiltro(mesAtualPadrao)
                    setCategoriaFiltro('todas')
                    setContextoFiltro('todos')
                  }}
                  className="h-8 text-xs text-slate-500 hover:text-slate-800"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LISTA DE GASTOS */}
      <Card className="border-slate-200/80 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-500" />
              Lançamentos de Gastos
            </CardTitle>
            <p className="text-xs text-slate-500">Total de {gastos.length} gasto(s) listado(s).</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Carregando seus gastos...
            </div>
          ) : gastos.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <DollarSign className="w-12 h-12 mx-auto text-slate-300" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-700">Nenhum gasto encontrado</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Grave um áudio no microfone acima ou adicione um gasto manual para começar a
                  controlar suas finanças.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleNovoGastoManual}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Registrar Primeiro Gasto
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {gastos.map((gasto) => {
                const cfg = CATEGORIA_CONFIG[gasto.categoria] || CATEGORIA_CONFIG.Outros
                const orcVinc = gasto.expand?.orcamento_vinculado

                return (
                  <div
                    key={gasto.id}
                    className="p-3.5 sm:p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {/* Lado Esquerdo: Ícone da categoria + dados */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${cfg.bg} ${cfg.color} ${cfg.border}`}
                      >
                        {cfg.icon}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{gasto.descricao}</h4>

                          {/* Badge de Contexto (Empresa × Pessoal) */}
                          <Badge
                            className={`text-[10px] font-bold py-0.5 px-2 ${
                              gasto.contexto === 'pessoal'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                            }`}
                            variant="outline"
                          >
                            {gasto.contexto === 'pessoal' ? '🏠 Pessoal' : '🏢 Empresa'}
                          </Badge>

                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold py-0.5 px-2 ${cfg.bg} ${cfg.color} ${cfg.border}`}
                          >
                            {cfg.label}
                          </Badge>

                          {/* Origem badge */}
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase font-bold py-0.2 px-1.5 bg-slate-100 text-slate-600"
                          >
                            {gasto.origem === 'voz'
                              ? '🎙️ Voz'
                              : gasto.origem === 'documento'
                                ? '📸 Foto'
                                : 'Manual'}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formatarData(gasto.data)}
                          </span>

                          {orcVinc && (
                            <span className="flex items-center gap-1 text-blue-700 font-medium">
                              • <FileText className="w-3 h-3 text-blue-500" />
                              Obra: {orcVinc.numero}
                            </span>
                          )}

                          {gasto.observacoes && (
                            <span className="text-slate-400 truncate max-w-xs">
                              • {gasto.observacoes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Valor + Ações */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-base sm:text-lg font-black text-slate-900 tabular-nums">
                          {formatarMoedaBRL(gasto.valor)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditarGasto(gasto)}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="Editar gasto"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setGastoExcluir(gasto)}
                          className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          title="Excluir gasto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO MANUAL */}
      <Dialog open={modalManualOpen} onOpenChange={setModalManualOpen}>
        <DialogContent className="max-w-md bg-white text-slate-900 rounded-2xl">
          <form onSubmit={handleSalvarManual}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {gastoEditando ? 'Editar Gasto' : 'Novo Gasto'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Preencha os dados do gasto para atualizar seu controle de custos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Descrição *</label>
                <Input
                  value={manualDescricao}
                  onChange={(e) => setManualDescricao(e.target.value)}
                  placeholder="Ex: Combustível do carro, tintas..."
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Valor (R$) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualValor}
                    onChange={(e) => setManualValor(e.target.value)}
                    placeholder="0,00"
                    className="mt-1 h-9 text-xs font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Data *</label>
                  <Input
                    type="date"
                    value={manualData}
                    onChange={(e) => setManualData(e.target.value)}
                    className="mt-1 h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Contexto *</label>
                  <Select
                    value={manualContexto}
                    onValueChange={(v) => setManualContexto(v as 'empresa' | 'pessoal')}
                  >
                    <SelectTrigger className="mt-1 h-9 text-xs font-semibold">
                      <SelectValue placeholder="Contexto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empresa" className="text-xs font-medium">
                        🏢 Empresa
                      </SelectItem>
                      <SelectItem value="pessoal" className="text-xs font-medium">
                        🏠 Pessoal
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Categoria *</label>
                  <Select
                    value={manualCategoria}
                    onValueChange={(v) => setManualCategoria(v as CategoriaGasto)}
                  >
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-xs">
                          {CATEGORIA_CONFIG[cat].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">
                  Vincular a Orçamento / Obra (opcional)
                </label>
                <Select
                  value={manualOrcamentoId || 'nenhum'}
                  onValueChange={(v) => setManualOrcamentoId(v === 'nenhum' ? '' : v)}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Nenhum vínculo (gasto geral)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum" className="text-xs">
                      Nenhum vínculo (gasto geral)
                    </SelectItem>
                    {orcamentos.map((orc) => (
                      <SelectItem key={orc.id} value={orc.id} className="text-xs">
                        {orc.numero} - {orc.descricao?.slice(0, 35)} (
                        {formatarMoedaBRL(orc.valor_total)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalManualOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingManual}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                {isSavingManual ? 'Salvando...' : 'Salvar Gasto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO MANUAL */}
      <AlertDialog open={!!gastoExcluir} onOpenChange={(open) => !open && setGastoExcluir(null)}>
        <AlertDialogContent className="max-w-[400px] bg-white text-slate-900 rounded-2xl p-6">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Excluir este gasto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Você está prestes a remover o lançamento{' '}
              <strong>&ldquo;{gastoExcluir?.descricao}&rdquo;</strong> no valor de{' '}
              <strong>{formatarMoedaBRL(gastoExcluir?.valor || 0)}</strong>. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="h-9 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              disabled={isExcluindo}
              className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isExcluindo ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMAÇÃO PARA COMANDO FALADO "DESFAZ AQUILO" */}
      <AlertDialog
        open={!!confirmarDesfazerVozAcao}
        onOpenChange={(open) => !open && setConfirmarDesfazerVozAcao(null)}
      >
        <AlertDialogContent className="max-w-[420px] bg-white text-slate-900 rounded-2xl p-6">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Desfazer última ação por voz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>Identificamos seu comando para desfazer. Ação a reverter:</p>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-medium text-slate-800">
                {confirmarDesfazerVozAcao?.titulo}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="h-9 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmarDesfazerVozAcao && handleDesfazerAcao(confirmarDesfazerVozAcao)
              }
              className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              Confirmar e Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Gastos
