import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  X,
  Check,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  UserCheck,
  FileText,
  DollarSign,
  Receipt,
  HelpCircle,
  Maximize2,
  Minimize2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { aiInterpretarService, InterpretacaoResultado } from '@/services/aiInterpretar'
import { preferenciasIaService } from '@/services/preferenciasIa'
import { acoesVozService } from '@/services/acoesVoz'
import { clientesService } from '@/services/clientes'
import { orcamentosService } from '@/services/orcamentos'
import { gastosService } from '@/services/gastos'
import { cobrancasService } from '@/services/cobrancas'
import { PreferenciasIa, formatarMoedaBRL } from '@/types'
import { getPermissionGuide, PlatformPermissionGuide } from '@/lib/audioPermissions'
import { cn } from '@/lib/utils'

export function GlobalVoiceFAB() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  // Guardião contra crashes de montagem/desmonte
  const isMountedRef = useRef<boolean>(true)

  // Estados de escuta e transcrição
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isListening, setIsListening] = useState<boolean>(false)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [liveTranscript, setLiveTranscript] = useState<string>('')
  const [finalTranscript, setFinalTranscript] = useState<string>('')
  const [duration, setDuration] = useState<number>(0)
  const [isMinimized, setIsMinimized] = useState<boolean>(false)

  // Permissões
  const [permissionDeniedGuide, setPermissionDeniedGuide] =
    useState<PlatformPermissionGuide | null>(null)
  const [micError, setMicError] = useState<string | null>(null)

  // Resultado da interpretação
  const [resultado, setResultado] = useState<InterpretacaoResultado | null>(null)
  const [isExecutingDirectAction, setIsExecutingDirectAction] = useState<boolean>(false)
  const [feedbackMensagem, setFeedbackMensagem] = useState<string | null>(null)

  // Preferências do usuário
  const [preferenciasIa, setPreferenciasIa] = useState<PreferenciasIa | null>(null)

  // Refs de hardware e timers
  const mediaStreamRef = useRef<MediaStream | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<number | null>(null)

  // Proteção de desmonte
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopAllMedia()
    }
  }, [])

  // Carrega preferências de IA do usuário autenticado
  useEffect(() => {
    if (!user?.id) return
    let ativo = true
    preferenciasIaService
      .obter(user.id)
      .then((pref) => {
        if (ativo && isMountedRef.current && pref) {
          setPreferenciasIa(pref)
        }
      })
      .catch(() => {})

    return () => {
      ativo = false
    }
  }, [user?.id])

  // Limpeza de mídia com segurança
  const stopAllMedia = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop()
        })
      } catch {
        /* ignore */
      }
      mediaStreamRef.current = null
    }

    if (isMountedRef.current) {
      setIsListening(false)
    }
  }, [])

  // Iniciar escuta (DEVE ser chamado direto do evento de clique para atender iOS/Safari)
  const startListening = async () => {
    if (isListening || isProcessing) return

    setPermissionDeniedGuide(null)
    setMicError(null)
    setLiveTranscript('')
    setFinalTranscript('')
    setDuration(0)
    setResultado(null)
    setFeedbackMensagem(null)
    setIsOpen(true)
    setIsMinimized(false)

    try {
      // 1. Solicita acesso ao microfone (handler de toque)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      mediaStreamRef.current = stream
      setIsListening(true)

      const startTime = Date.now()
      timerRef.current = window.setInterval(() => {
        if (!isMountedRef.current) return
        setDuration(Math.floor((Date.now() - startTime) / 1000))
      }, 100)

      // 2. Inicia Web Speech API (se suportado pelo navegador)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.lang = 'pt-BR'
        recognition.continuous = true
        recognition.interimResults = true

        let accum = ''
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (ev: any) => {
          if (!isMountedRef.current) return
          let interim = ''
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const t = ev.results[i][0].transcript
            if (ev.results[i].isFinal) {
              accum += (accum ? ' ' : '') + t
            } else {
              interim += t
            }
          }
          setLiveTranscript(interim)
          setFinalTranscript(accum)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (e: any) => {
          console.warn('SpeechRecognition erro no assistente universal:', e)
          if (!isMountedRef.current) return
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            const guide = getPermissionGuide()
            setPermissionDeniedGuide(guide)
            stopAllMedia()
          }
        }

        recognition.onend = () => {
          if (isMountedRef.current && mediaStreamRef.current) {
            try {
              recognition.start()
            } catch {
              /* ignore */
            }
          }
        }

        recognition.start()
        recognitionRef.current = recognition
      }
    } catch (err: unknown) {
      console.error('Erro de microfone no assistente universal:', err)
      if (!isMountedRef.current) return

      const errName = (err as { name?: string })?.name
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        const guide = getPermissionGuide()
        setPermissionDeniedGuide(guide)
      } else {
        setMicError('Não foi possível iniciar o microfone. Verifique se está liberado.')
      }
      stopAllMedia()
    }
  }

  // Parar de falar e interpretar com a IA
  const stopAndProcess = async () => {
    const fullText = `${finalTranscript} ${liveTranscript}`.trim()
    stopAllMedia()

    if (permissionDeniedGuide || micError) return

    if (!fullText) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma fala detectada',
        description: 'Toque no microfone novamente e fale com clareza.',
      })
      return
    }

    setIsProcessing(true)
    try {
      const resp = await aiInterpretarService.interpretar({
        transcricao: fullText,
        contexto: 'geral',
        userId: user?.id,
        preferencias: preferenciasIa
          ? {
              nome_preferido: preferenciasIa.nome_preferido,
              tom_resposta: preferenciasIa.tom_resposta,
              usar_emojis: preferenciasIa.usar_emojis,
              contexto_gasto_padrao: preferenciasIa.contexto_gasto_padrao,
            }
          : undefined,
      })

      if (!isMountedRef.current) return
      setResultado(resp.interpretacao)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar com IA'
      toast({
        variant: 'destructive',
        title: 'Erro ao interpretar áudio',
        description: msg,
      })
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false)
      }
    }
  }

  // Cancelar e fechar modal
  const handleClose = () => {
    stopAllMedia()
    setIsOpen(false)
    setLiveTranscript('')
    setFinalTranscript('')
    setDuration(0)
    setResultado(null)
    setFeedbackMensagem(null)
    setPermissionDeniedGuide(null)
    setMicError(null)
  }

  // ROTEAMENTO POR INTENÇÃO: Direcionar para o local correto com preenchimento ou confirmação
  const handleConfirmRoute = async (modo: 'navegar' | 'executar_direto') => {
    if (!resultado || !user?.id) return

    const intencao = resultado.intencao_detectada || 'orcamento'

    // 1. INTENÇÃO: CLIENTE ("cadastrar cliente Maria Silva, telefone 19 99999-9999")
    if (intencao === 'cliente') {
      const cliNovo = resultado.cliente_novo

      if (modo === 'executar_direto' && cliNovo?.nome) {
        setIsExecutingDirectAction(true)
        try {
          const nomeFinal = String(cliNovo.nome).trim()
          const emailFinal = cliNovo.email ? String(cliNovo.email).trim() : ''
          const novoCli = await clientesService.criar({
            nome: nomeFinal,
            email: emailFinal,
            telefone: cliNovo.telefone ? String(cliNovo.telefone).trim() : '',
            empresa: cliNovo.empresa ? String(cliNovo.empresa).trim() : '',
            endereco: cliNovo.endereco ? String(cliNovo.endereco).trim() : '',
            user_id: user.id,
          })

          await acoesVozService.registrar({
            tipo_acao: 'criacao_cliente',
            titulo: `Cliente cadastrado: ${novoCli.nome}`,
            descricao_resumo: `Telefone: ${novoCli.telefone || 'N/A'} · Empresa: ${novoCli.empresa || 'N/A'}`,
            registro_id: novoCli.id,
            dados_aplicados: {
              cliente_id: novoCli.id,
              nome: novoCli.nome,
              telefone: novoCli.telefone,
              empresa: novoCli.empresa,
            },
            user_id: user.id,
          })

          toast({
            title: 'Cliente cadastrado com sucesso!',
            description: `"${novoCli.nome}" foi adicionado à sua base de clientes.`,
          })
          setFeedbackMensagem(`Cliente "${novoCli.nome}" cadastrado com sucesso!`)
          navigate('/clientes')
          handleClose()
        } catch (eCli) {
          const msg = eCli instanceof Error ? eCli.message : 'Falha ao salvar cliente'
          toast({ variant: 'destructive', title: 'Erro ao cadastrar cliente', description: msg })
        } finally {
          setIsExecutingDirectAction(false)
        }
        return
      }

      // Navegar para Clientes com formulário aberto e dados pré-preenchidos
      navigate('/clientes', {
        state: {
          interpretacaoSalva: resultado,
          textoReaproveitado: resultado.transcricao_corrigida,
        },
      })
      toast({
        title: 'Direcionado para Clientes!',
        description: 'Revise os dados assimilados pela IA e confirme o cadastro.',
      })
      handleClose()
      return
    }

    // 2. INTENÇÃO: GASTO ("gastei 50 reais em material de pintura" / "compra pessoal de 30 reais")
    if (intencao === 'registro_gasto' || resultado.gasto_extraido) {
      const gExt = resultado.gasto_extraido
      const ctxGasto =
        gExt?.contexto === 'pessoal'
          ? 'pessoal'
          : preferenciasIa?.contexto_gasto_padrao || 'empresa'

      if (modo === 'executar_direto' && gExt?.valor) {
        setIsExecutingDirectAction(true)
        try {
          const novoGasto = await gastosService.criar({
            descricao: gExt.descricao || 'Despesa via Assistente Universal',
            valor: gExt.valor,
            categoria: gExt.categoria || 'Outros',
            contexto: ctxGasto,
            data: gExt.data || new Date().toISOString().slice(0, 10),
            origem: 'voz',
            orcamento_vinculado: gExt.orcamento_vinculado_id || null,
          })

          await acoesVozService.registrar({
            tipo_acao: 'registro_gasto',
            titulo: `Gasto registrado (${ctxGasto === 'pessoal' ? '🏠 Pessoal' : '🏢 Empresa'}): ${formatarMoedaBRL(novoGasto.valor)}`,
            descricao_resumo: `${novoGasto.descricao} · Categoria: ${novoGasto.categoria}`,
            registro_id: novoGasto.id,
            dados_aplicados: {
              gasto_id: novoGasto.id,
              descricao: novoGasto.descricao,
              valor: novoGasto.valor,
              categoria: novoGasto.categoria,
              contexto: ctxGasto,
            },
            user_id: user.id,
          })

          toast({
            title: 'Gasto registrado com sucesso!',
            description: `${novoGasto.descricao} · ${formatarMoedaBRL(novoGasto.valor)} (${ctxGasto === 'pessoal' ? 'Pessoal' : 'Empresa'})`,
          })
          navigate('/gastos')
          handleClose()
        } catch (eGasto) {
          const msg = eGasto instanceof Error ? eGasto.message : 'Falha ao salvar gasto'
          toast({ variant: 'destructive', title: 'Erro ao registrar gasto', description: msg })
        } finally {
          setIsExecutingDirectAction(false)
        }
        return
      }

      // Navega para Gastos
      navigate('/gastos')
      toast({
        title: 'Direcionado para Gastos!',
        description: gExt?.mensagem_resposta || 'Abra o novo lançamento de gastos.',
      })
      handleClose()
      return
    }

    // 3. INTENÇÃO: CONSULTA DE LUCRO / RESULTADO DO MÊS ("quanto lucrei esse mês")
    if (intencao === 'resultado_mes' || resultado.comando_resultado_mes) {
      navigate('/dashboard')
      toast({
        title: 'Resultado do Mês',
        description:
          resultado.comando_resultado_mes?.mensagem_resposta ||
          'Navegado para o Dashboard com o card Resultado do Mês.',
      })
      handleClose()
      return
    }

    // 4. INTENÇÃO: RESUMO DO DIA ("resumo do dia", "resumo da manhã")
    if (intencao === 'resumo_dia' || resultado.comando_resumo_dia) {
      navigate('/dashboard')
      toast({
        title: 'Resumo do Dia',
        description:
          resultado.comando_resumo_dia?.mensagem_resposta ||
          'Resumo operacional exibido no Dashboard!',
      })
      handleClose()
      return
    }

    // 5. INTENÇÃO: CONSULTA DE GASTOS ("quanto gastei esse mês")
    if (intencao === 'consulta_gastos' || resultado.comando_consulta_gastos) {
      navigate('/gastos')
      toast({
        title: 'Consulta de Gastos',
        description:
          resultado.comando_consulta_gastos?.mensagem_resposta ||
          `Total do mês: ${formatarMoedaBRL(resultado.comando_consulta_gastos?.total_mes || 0)}`,
      })
      handleClose()
      return
    }

    // 6. INTENÇÃO: CONTAS A RECEBER / DEVEDORES ("quem está me devendo")
    if (intencao === 'consulta_devedores' || resultado.comando_consulta_devedores) {
      navigate('/contas-a-receber')
      toast({
        title: 'Contas a Receber',
        description:
          resultado.comando_consulta_devedores?.mensagem_resposta ||
          'Lista de orçamentos pendentes de quitação.',
      })
      handleClose()
      return
    }

    // 7. INTENÇÃO: BAIXA DE PAGAMENTO ("o João pagou o orçamento 3")
    if (intencao === 'baixa_pagamento' && resultado.comando_baixa) {
      const cmd = resultado.comando_baixa
      if (cmd.orcamento_id) {
        setIsExecutingDirectAction(true)
        try {
          let cobId = cmd.cobranca_id
          if (!cobId) {
            const cobCriada = await cobrancasService.criar({
              orcamento_id: cmd.orcamento_id,
              cliente_nome: cmd.cliente_nome || 'Cliente',
              orcamento_numero: cmd.orcamento_numero,
              valor: cmd.valor,
              user_id: user.id,
            })
            cobId = cobCriada.id
          }

          await cobrancasService.marcarComoPago(cobId)
          await acoesVozService.registrar({
            tipo_acao: 'baixa_pagamento',
            titulo: `Baixa confirmada: ${cmd.orcamento_numero} (${formatarMoedaBRL(cmd.valor)})`,
            descricao_resumo: `Pagamento registrado para ${cmd.cliente_nome || 'Cliente'}.`,
            registro_id: cobId,
            dados_aplicados: {
              cobranca_id: cobId,
              orcamento_id: cmd.orcamento_id,
              orcamento_numero: cmd.orcamento_numero,
              cliente_nome: cmd.cliente_nome,
              valor: cmd.valor,
            },
            user_id: user.id,
          })

          toast({
            title: 'Baixa de pagamento confirmada!',
            description: `Orçamento ${cmd.orcamento_numero} quitado.`,
          })
          navigate('/contas-a-receber')
          handleClose()
        } catch (eBaixa) {
          const msg = eBaixa instanceof Error ? eBaixa.message : 'Falha ao baixar'
          toast({ variant: 'destructive', title: 'Erro ao baixar pagamento', description: msg })
        } finally {
          setIsExecutingDirectAction(false)
        }
        return
      }
    }

    // 8. INTENÇÃO: GERAR COBRANÇA PIX ("gerar cobrança pro João")
    if (intencao === 'gerar_cobranca' && resultado.comando_gerar_cobranca?.orcamento_id) {
      navigate('/contas-a-receber')
      toast({
        title: 'Cobrança PIX',
        description: resultado.comando_gerar_cobranca.mensagem_confirmacao,
      })
      handleClose()
      return
    }

    // 9. INTENÇÃO: MUDANÇA DE STATUS DE ORÇAMENTO ("aprovar orçamento 3")
    if (intencao === 'comando_status' && resultado.comando_status?.orcamento_id) {
      const cs = resultado.comando_status
      if (cs.novo_status) {
        setIsExecutingDirectAction(true)
        try {
          await orcamentosService.atualizarStatus(cs.orcamento_id, cs.novo_status)
          await acoesVozService.registrar({
            tipo_acao: 'mudanca_status',
            titulo: `Orçamento ${cs.orcamento_numero} alterado para "${cs.novo_status}"`,
            descricao_resumo: `Status anterior: ${cs.status_anterior || 'rascunho'}`,
            registro_id: cs.orcamento_id,
            dados_aplicados: {
              orcamento_id: cs.orcamento_id,
              orcamento_numero: cs.orcamento_numero,
              novo_status: cs.novo_status,
            },
            user_id: user.id,
          })

          toast({
            title: 'Status atualizado!',
            description: cs.mensagem_confirmacao,
          })
          navigate(`/orcamentos/${cs.orcamento_id}`)
          handleClose()
        } catch (eStatus) {
          const msg = eStatus instanceof Error ? eStatus.message : 'Falha ao atualizar status'
          toast({ variant: 'destructive', title: 'Erro ao atualizar status', description: msg })
        } finally {
          setIsExecutingDirectAction(false)
        }
        return
      }
    }

    // 10. INTENÇÃO PADRÃO: NOVO ORÇAMENTO ("orçamento para João, pintura de sala, R$ 800")
    navigate('/orcamentos/novo', {
      state: {
        interpretacaoSalva: resultado,
        textoReaproveitado: resultado.transcricao_corrigida,
      },
    })
    toast({
      title: 'Direcionado para Novo Orçamento!',
      description: 'Campos preenchidos com os dados da sua fala. Revise e salve.',
    })
    handleClose()
  }

  // Descritor visual da intenção detectada
  const getIntencaoBadge = (intencao?: string) => {
    switch (intencao) {
      case 'cliente':
        return {
          label: 'Cadastro de Cliente',
          cor: 'bg-blue-100 text-blue-800 border-blue-200',
          destino: 'Aba Clientes',
          icon: <UserCheck className="w-4 h-4 text-blue-600" />,
        }
      case 'registro_gasto':
        return {
          label: 'Lançamento de Gasto',
          cor: 'bg-amber-100 text-amber-900 border-amber-200',
          destino: 'Aba Gastos',
          icon: <Receipt className="w-4 h-4 text-amber-600" />,
        }
      case 'consulta_gastos':
        return {
          label: 'Consulta de Despesas',
          cor: 'bg-amber-100 text-amber-900 border-amber-200',
          destino: 'Aba Gastos',
          icon: <Receipt className="w-4 h-4 text-amber-600" />,
        }
      case 'resultado_mes':
        return {
          label: 'Resultado do Mês (Lucro)',
          cor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          destino: 'Dashboard · Resultado do Mês',
          icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
        }
      case 'resumo_dia':
        return {
          label: 'Resumo do Dia',
          cor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          destino: 'Dashboard · Resumo da Manhã',
          icon: <Sparkles className="w-4 h-4 text-indigo-600" />,
        }
      case 'consulta_devedores':
        return {
          label: 'Contas a Receber',
          cor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          destino: 'Aba Contas a Receber',
          icon: <DollarSign className="w-4 h-4 text-emerald-600" />,
        }
      case 'baixa_pagamento':
        return {
          label: 'Baixa de Pagamento',
          cor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          destino: 'Contas a Receber · Marcar Pago',
          icon: <Check className="w-4 h-4 text-emerald-600" />,
        }
      case 'comando_status':
        return {
          label: 'Alterar Status',
          cor: 'bg-violet-100 text-violet-800 border-violet-200',
          destino: 'Orçamento · Atualizar Status',
          icon: <RefreshCw className="w-4 h-4 text-violet-600" />,
        }
      case 'orcamento':
      default:
        return {
          label: 'Novo Orçamento',
          cor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          destino: 'Aba Orçamentos · Novo',
          icon: <FileText className="w-4 h-4 text-emerald-600" />,
        }
    }
  }

  // Se o usuário está em rotas públicas ou não logado, não exibe
  if (!user) return null

  // Se a rota for o próprio /modo-voz dedicado, o FAB pode continuar disponível ou ser discreto
  const isModoVozPage = location.pathname === '/modo-voz'

  return (
    <>
      {/* 1. BOTÃO FLUTUANTE UNIVERSAL (FAB) - Sempre visível em todas as telas */}
      <div
        className={cn(
          'fixed z-50 transition-all duration-300',
          // Posicionamento: no desktop no canto inferior direito; no mobile ligeiramente acima da barra inferior
          'bottom-20 right-4 sm:bottom-6 sm:right-6',
          isOpen && 'opacity-0 pointer-events-none scale-75',
        )}
      >
        <button
          type="button"
          onClick={startListening}
          aria-label="Assistente de Voz Universal"
          title="Falar qualquer comando: orçamento, cliente, gasto, lucro..."
          className={cn(
            'group relative flex items-center justify-center rounded-full shadow-2xl transition-all duration-300',
            'w-14 h-14 sm:w-16 sm:h-16 active:scale-95 hover:scale-105',
            'bg-gradient-to-tr from-emerald-600 via-teal-600 to-blue-600 text-white',
            'ring-4 ring-white/90 shadow-emerald-500/30',
            isListening && 'ring-emerald-400 animate-pulse',
          )}
        >
          {/* Anel pulsante decorativo */}
          <span className="absolute -inset-1 rounded-full bg-emerald-400/40 opacity-75 blur-sm group-hover:opacity-100 animate-pulse pointer-events-none" />

          <Mic className="w-7 h-7 sm:w-8 sm:h-8 relative z-10 transition-transform group-hover:rotate-6" />

          {/* Badge de IA Universal */}
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-900 text-[10px] font-black shadow-md border-2 border-white">
            <Sparkles className="w-3 h-3 fill-slate-900" />
          </span>

          {/* Tooltip flutuante no hover (desktop) */}
          <span className="hidden sm:group-hover:flex absolute right-full mr-3 whitespace-nowrap bg-slate-900/90 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg items-center gap-1.5 pointer-events-none">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            IA Livre: Fale qualquer comando
          </span>
        </button>
      </div>

      {/* 2. OVERLAY MODAL / DRAWER INTERATIVO DO ASSISTENTE UNIVERSAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div
            className={cn(
              'w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col transition-all duration-300 animate-scale-in',
              isMinimized ? 'max-h-32' : 'max-h-[90vh]',
            )}
          >
            {/* TOPO: BARRA DE STATUS E CONTROLE */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tracking-tight">
                      Assistente de Voz Universal
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Livre
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Fale naturalmente: orçamentos, clientes, gastos ou consultas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMinimized((prev) => !prev)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title={isMinimized ? 'Expandir' : 'Minimizar'}
                >
                  {isMinimized ? (
                    <Maximize2 className="w-4 h-4" />
                  ) : (
                    <Minimize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CONTEÚDO PRINCIPAL (SE NÃO MINIMIZADO) */}
            {!isMinimized && (
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
                {/* AVISO DE PERMISSÃO BLOQUEADA (IPHONE / ANDROID / DESKTOP) */}
                {permissionDeniedGuide && (
                  <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-xs sm:text-sm space-y-3 shadow-xs animate-fade-in">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-rose-900">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>Acesso ao Microfone Bloqueado</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 shrink-0">
                        {permissionDeniedGuide.badge}
                      </span>
                    </div>

                    <p className="text-rose-800 text-xs font-medium">
                      {permissionDeniedGuide.subtitle}
                    </p>

                    <div className="bg-white/95 border border-rose-200 rounded-xl p-3 space-y-2 text-xs">
                      <span className="font-bold text-slate-800 block">
                        {permissionDeniedGuide.title}
                      </span>
                      <ol className="list-decimal pl-4 space-y-1.5 text-slate-700">
                        {permissionDeniedGuide.steps.map((st, idx) => (
                          <li key={idx} className="font-medium">
                            {st}
                          </li>
                        ))}
                      </ol>
                      {permissionDeniedGuide.alternativeStep && (
                        <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200 italic">
                          💡 {permissionDeniedGuide.alternativeStep}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={startListening}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold h-9"
                      >
                        Tentar novamente
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleClose}
                        className="text-xs h-9"
                      >
                        Fechar
                      </Button>
                    </div>
                  </div>
                )}

                {/* OUTRO ERRO DE HARDWARE */}
                {!permissionDeniedGuide && micError && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>{micError}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={startListening}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8"
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}

                {/* ESTADO 1: ESCUTANDO EM TEMPO REAL */}
                {isListening && (
                  <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
                    {/* Botão pulsante ativo */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={stopAndProcess}
                        className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shadow-xl active:scale-95 transition-all ring-8 ring-rose-200 animate-pulse"
                      >
                        <Mic className="w-10 h-10" />
                      </button>
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full animate-ping" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-mono text-base font-bold text-rose-600 tabular-nums">
                          {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          Estou ouvindo... Fale livremente
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 max-w-xs">
                        Diga o que deseja e a IA entenderá o contexto automaticamente.
                      </p>
                    </div>

                    {/* Caixa de transcrição ao vivo */}
                    <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left min-h-[72px]">
                      {finalTranscript || liveTranscript ? (
                        <p className="text-sm font-medium text-slate-800 leading-relaxed">
                          <span>{finalTranscript}</span>{' '}
                          <span className="text-blue-600 font-semibold">{liveTranscript}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          Exemplos:
                          <br />• &ldquo;Cadastrar cliente Maria Silva, fone 19 99999-9999&rdquo;
                          <br />• &ldquo;Orçamento para João, pintura de sala, R$ 800&rdquo;
                          <br />• &ldquo;Gastei 50 reais em material de pintura&rdquo;
                          <br />• &ldquo;Quanto lucrei esse mês?&rdquo; ou &ldquo;Resumo do
                          dia&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Botões de Ação na Escuta */}
                    <div className="flex items-center gap-2 pt-2 w-full">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        className="flex-1 text-xs h-10 border-slate-300"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        onClick={stopAndProcess}
                        className="flex-1 text-xs h-10 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md"
                      >
                        <Check className="w-4 h-4 mr-1.5 stroke-[3]" />
                        Concluir e Direcionar
                      </Button>
                    </div>
                  </div>
                )}

                {/* ESTADO 2: PROCESSANDO COM IA */}
                {isProcessing && (
                  <div className="flex flex-col items-center justify-center text-center py-10 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner animate-pulse">
                      <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900">
                        Interpretando a intenção da sua fala...
                      </h4>
                      <p className="text-xs text-slate-500">
                        Identificando contexto, corrigindo português e calculando destino correto.
                      </p>
                    </div>
                  </div>
                )}

                {/* ESTADO 3: FEEDBACK DE CONFIRMAÇÃO E ROTEAMENTO INTELIGENTE */}
                {!isListening && !isProcessing && resultado && (
                  <div className="space-y-4 animate-scale-in">
                    {/* Header do Entendimento */}
                    {(() => {
                      const badge = getIntencaoBadge(resultado.intencao_detectada)
                      return (
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/50 border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-white shadow-xs">
                                {badge.icon}
                              </span>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                  Intenção Identificada
                                </span>
                                <span className="text-sm font-extrabold text-slate-900">
                                  {badge.label}
                                </span>
                              </div>
                            </div>

                            <span
                              className={cn(
                                'text-[11px] font-bold px-2.5 py-1 rounded-full border',
                                badge.cor,
                              )}
                            >
                              Destino: {badge.destino}
                            </span>
                          </div>

                          {/* Transcrição corrigida */}
                          <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                              O que você falou
                            </span>
                            <p className="text-slate-800 font-medium italic">
                              &ldquo;{resultado.transcricao_corrigida}&rdquo;
                            </p>
                          </div>

                          {/* Resumo da Extração */}
                          <div className="text-xs text-slate-700 space-y-1.5">
                            {/* Caso Cliente */}
                            {resultado.intencao_detectada === 'cliente' &&
                              resultado.cliente_novo && (
                                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1 text-blue-950">
                                  <div className="font-bold flex items-center justify-between">
                                    <span>👤 {resultado.cliente_novo.nome}</span>
                                    {resultado.cliente_novo.telefone && (
                                      <span className="font-mono text-[11px]">
                                        📞 {resultado.cliente_novo.telefone}
                                      </span>
                                    )}
                                  </div>
                                  {resultado.cliente_novo.empresa && (
                                    <p className="text-[11px] text-blue-800">
                                      🏢 Empresa: {resultado.cliente_novo.empresa}
                                    </p>
                                  )}
                                </div>
                              )}

                            {/* Caso Gasto */}
                            {(resultado.intencao_detectada === 'registro_gasto' ||
                              resultado.gasto_extraido) &&
                              resultado.gasto_extraido && (
                                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 text-amber-950">
                                  <div className="font-bold flex items-center justify-between">
                                    <span>
                                      {resultado.gasto_extraido.contexto === 'pessoal'
                                        ? '🏠 Pessoal'
                                        : '🏢 Empresa'}{' '}
                                      · {resultado.gasto_extraido.descricao}
                                    </span>
                                    <span className="font-black text-sm text-amber-800 tabular-nums">
                                      {formatarMoedaBRL(resultado.gasto_extraido.valor || 0)}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-amber-800">
                                    Categoria: {resultado.gasto_extraido.categoria || 'Outros'}
                                  </p>
                                  {resultado.gasto_extraido.mensagem_resposta && (
                                    <p className="text-[11px] italic pt-1 border-t border-amber-200/60">
                                      &ldquo;{resultado.gasto_extraido.mensagem_resposta}&rdquo;
                                    </p>
                                  )}
                                </div>
                              )}

                            {/* Caso Resultado do Mês / Lucro */}
                            {resultado.comando_resultado_mes && (
                              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1 text-emerald-950">
                                <div className="font-bold text-sm">
                                  Lucro Estimado:{' '}
                                  <span className="font-black">
                                    {formatarMoedaBRL(resultado.comando_resultado_mes.lucro)}
                                  </span>
                                </div>
                                <p className="text-xs text-emerald-800 leading-relaxed">
                                  {resultado.comando_resultado_mes.mensagem_resposta}
                                </p>
                              </div>
                            )}

                            {/* Caso Resumo do Dia */}
                            {resultado.comando_resumo_dia && (
                              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-1 text-indigo-950">
                                <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                                  {resultado.comando_resumo_dia.mensagem_resposta}
                                </p>
                              </div>
                            )}

                            {/* Caso Consulta de Gastos */}
                            {resultado.comando_consulta_gastos && (
                              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl space-y-1">
                                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                                  {resultado.comando_consulta_gastos.mensagem_resposta}
                                </p>
                              </div>
                            )}

                            {/* Caso Consulta de Devedores */}
                            {resultado.comando_consulta_devedores && (
                              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-950">
                                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                                  {resultado.comando_consulta_devedores.mensagem_resposta}
                                </p>
                              </div>
                            )}

                            {/* Caso Orçamento */}
                            {resultado.intencao_detectada === 'orcamento' && (
                              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-emerald-950">
                                <div className="font-bold flex items-center justify-between">
                                  <span>
                                    {resultado.cliente_sugerido_nome
                                      ? `Cliente: ${resultado.cliente_sugerido_nome}`
                                      : resultado.cliente_novo?.nome
                                        ? `Novo Cliente: ${resultado.cliente_novo.nome}`
                                        : 'Cliente a selecionar'}
                                  </span>
                                  {resultado.itens && resultado.itens.length > 0 && (
                                    <span className="font-black text-sm text-emerald-800 tabular-nums">
                                      {formatarMoedaBRL(
                                        resultado.itens.reduce(
                                          (ac, it) =>
                                            ac +
                                            (Number(it.quantidade) || 0) *
                                              (Number(it.valor_unitario) || 0),
                                          0,
                                        ),
                                      )}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-700">
                                  {resultado.descricao_servico}
                                </p>
                              </div>
                            )}

                            {/* Caso Mudança de Status */}
                            {resultado.comando_status && (
                              <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl space-y-1 text-violet-950">
                                <p className="text-xs font-semibold">
                                  {resultado.comando_status.mensagem_confirmacao}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {/* BOTÕES DE CONFIRMAÇÃO & ROTEAMENTO */}
                    <div className="space-y-2 pt-1">
                      {/* Botão de Ação Direta (Salvar direto se for cliente/gasto/status) */}
                      {(resultado.intencao_detectada === 'cliente' ||
                        resultado.intencao_detectada === 'registro_gasto' ||
                        resultado.intencao_detectada === 'comando_status' ||
                        resultado.intencao_detectada === 'baixa_pagamento') && (
                        <Button
                          type="button"
                          disabled={isExecutingDirectAction}
                          onClick={() => handleConfirmRoute('executar_direto')}
                          className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md text-xs sm:text-sm"
                        >
                          {isExecutingDirectAction ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Gravando dados...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2 stroke-[3]" />
                              Confirmar e Salvar Agora
                            </>
                          )}
                        </Button>
                      )}

                      {/* Botão de Navegar e Preencher na Tela Certa */}
                      <Button
                        type="button"
                        disabled={isExecutingDirectAction}
                        onClick={() => handleConfirmRoute('navegar')}
                        variant={
                          resultado.intencao_detectada === 'cliente' ||
                          resultado.intencao_detectada === 'registro_gasto' ||
                          resultado.intencao_detectada === 'comando_status' ||
                          resultado.intencao_detectada === 'baixa_pagamento'
                            ? 'outline'
                            : 'default'
                        }
                        className={cn(
                          'w-full h-11 font-bold rounded-xl text-xs sm:text-sm',
                          resultado.intencao_detectada !== 'cliente' &&
                            resultado.intencao_detectada !== 'registro_gasto' &&
                            resultado.intencao_detectada !== 'comando_status' &&
                            resultado.intencao_detectada !== 'baixa_pagamento'
                            ? 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-md'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-100',
                        )}
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Abrir e Preencher na Tela Correta
                      </Button>

                      {/* Botão de Tentar de Novo */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={startListening}
                          className="flex-1 text-xs text-slate-600 hover:text-slate-900 h-9"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Falar Novamente
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClose}
                          className="flex-1 text-xs text-slate-500 hover:text-slate-800 h-9"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
export default GlobalVoiceFAB
