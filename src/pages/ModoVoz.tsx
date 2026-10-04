import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic,
  Square,
  Sparkles,
  ArrowLeft,
  Loader2,
  Check,
  RotateCcw,
  AlertCircle,
  FileText,
  UserPlus,
  RefreshCw,
  HelpCircle,
  Volume2,
  Send,
  Radio,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { aiInterpretarService, InterpretacaoResultado } from '@/services/aiInterpretar'
import { orcamentosService } from '@/services/orcamentos'
import { clientesService } from '@/services/clientes'
import { acoesVozService } from '@/services/acoesVoz'
import { formatarMoedaBRL, OrçamentoStatus, AcaoVozRegistro } from '@/types'
import { ReciboAcaoVoz } from '@/components/ReciboAcaoVoz'
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
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function ModoVoz() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  // Estados de escuta
  const [isListening, setIsListening] = useState(false)
  const [duration, setDuration] = useState(0)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null)

  // Estados de IA
  const [isProcessing, setIsProcessing] = useState(false)
  const [resultado, setResultado] = useState<InterpretacaoResultado | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [appliedSuccess, setAppliedSuccess] = useState<string | null>(null)

  // Recibo mais recente gerado e lista de ações dos últimos 24h (Melhoria 1)
  const [ultimoRecibo, setUltimoRecibo] = useState<AcaoVozRegistro | null>(null)
  const [acoesUltimas24h, setAcoesUltimas24h] = useState<AcaoVozRegistro[]>([])
  const [loadingAcoes, setLoadingAcoes] = useState(false)
  const [undoingId, setUndoingId] = useState<string | null>(null)

  // Confirmação para comando de voz "desfaz aquilo"
  const [confirmarDesfazerVozAcao, setConfirmarDesfazerVozAcao] = useState<AcaoVozRegistro | null>(
    null,
  )

  // Refs de gravação
  const mediaStreamRef = useRef<MediaStream | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<number | null>(null)

  const isMountedRef = useRef<boolean>(true)

  const stopAllMedia = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (recognitionRef.current) {
      try {
        if (typeof recognitionRef.current.abort === 'function') {
          recognitionRef.current.abort()
        } else {
          recognitionRef.current.stop()
        }
      } catch {
        /* noop */
      }
      recognitionRef.current = null
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      } catch {
        /* noop */
      }
      mediaStreamRef.current = null
    }

    if (isMountedRef.current) {
      setIsListening(false)
    }
  }, [])

  const carregarAcoesUltimas24h = useCallback(async () => {
    if (!user?.id) return
    setLoadingAcoes(true)
    try {
      const lista = await acoesVozService.listarUltimas24Horas(user.id)
      if (isMountedRef.current) {
        setAcoesUltimas24h(lista)
      }
    } catch (err) {
      console.warn('Erro ao carregar ações das 24h:', err)
    } finally {
      if (isMountedRef.current) {
        setLoadingAcoes(false)
      }
    }
  }, [user?.id])

  useEffect(() => {
    isMountedRef.current = true
    carregarAcoesUltimas24h()
    return () => {
      isMountedRef.current = false
      stopAllMedia()
    }
  }, [stopAllMedia, carregarAcoesUltimas24h])

  // Iniciar escuta contínua com microfone
  const startListening = async () => {
    if (isProcessing) return
    setMicPermissionError(null)
    setLiveTranscript('')
    setFinalTranscript('')
    setDuration(0)
    setResultado(null)
    setAppliedSuccess(null)

    // 1. Solicita permissão do microfone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream
      setIsListening(true)

      const startTime = Date.now()
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000))
      }, 100)

      // 2. Inicia Web Speech API
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
          console.warn('SpeechRecognition erro:', e)
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            setMicPermissionError(
              'Permissão do microfone negada. Clique no ícone de cadeado na barra de endereços para permitir.',
            )
          }
        }

        recognition.onend = () => {
          // Se ainda montado e marcado como ouvindo, mantém ativo
          if (isMountedRef.current && mediaStreamRef.current) {
            try {
              recognition.start()
            } catch {
              /* noop */
            }
          }
        }

        recognition.start()
        recognitionRef.current = recognition
      }
    } catch (err: unknown) {
      console.error('Erro de microfone:', err)
      const errName = (err as { name?: string })?.name
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setMicPermissionError(
          'Permissão de microfone bloqueada pelo navegador. Conceda permissão para usar o Modo Só Falar.',
        )
      } else {
        setMicPermissionError(
          'Não foi possível iniciar o microfone neste dispositivo. Verifique as configurações de áudio.',
        )
      }
      stopAllMedia()
    }
  }

  // Finalizar fala e enviar para a IA
  const stopAndProcess = async () => {
    const fullText = `${finalTranscript} ${liveTranscript}`.trim()
    stopAllMedia()

    if (!fullText) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma fala detectada',
        description: 'Pressione o microfone novamente e fale o que você deseja realizar.',
      })
      return
    }

    setIsProcessing(true)
    try {
      const resp = await aiInterpretarService.interpretar({
        transcricao: fullText,
        contexto: 'geral',
        userId: user?.id,
      })

      // Caso especial: Comando falado para Desfazer a última ação ("desfaz aquilo", "desfaz o último")
      if (
        resp.interpretacao?.comando_desfazer ||
        resp.interpretacao?.intencao_detectada === 'desfazer'
      ) {
        const ultimaAcao = await acoesVozService.obterUltimaAcaoAtiva24h(user?.id)
        if (ultimaAcao) {
          setConfirmarDesfazerVozAcao(ultimaAcao)
          toast({
            title: 'Comando de desfazer identificado',
            description: `Deseja desfazer "${ultimaAcao.titulo}"? Confirme abaixo.`,
          })
        } else {
          toast({
            title: 'Nenhuma ação para desfazer',
            description:
              'Não foram encontradas ações ativas de voz realizadas nas últimas 24 horas.',
          })
        }
        return
      }

      setResultado(resp.interpretacao)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na inteligência artificial'
      toast({
        variant: 'destructive',
        title: 'Erro ao interpretar fala',
        description: msg,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Cancelar gravação
  const handleCancel = () => {
    stopAllMedia()
    setLiveTranscript('')
    setFinalTranscript('')
    setDuration(0)
    setResultado(null)
  }

  // Aplicar resultado com 1 toque
  const handleApplyResult = async () => {
    if (!resultado || !user?.id) return

    setIsApplying(true)
    try {
      // Caso 1: Comando de alterar status de orçamento
      if (resultado.comando_status?.orcamento_id && resultado.comando_status?.novo_status) {
        const orcId = resultado.comando_status.orcamento_id
        const novoStatus = resultado.comando_status.novo_status as OrçamentoStatus
        const statusAnterior = resultado.comando_status.status_anterior || 'rascunho'
        const numOrc = resultado.comando_status.orcamento_numero || ''

        await orcamentosService.atualizarStatus(orcId, novoStatus)

        // Registrar recibo na coleção acoes_voz
        const recibo = await acoesVozService.registrar({
          tipo_acao: 'mudanca_status',
          titulo: `Status alterado: Orçamento ${numOrc} para "${novoStatus}"`,
          descricao_resumo: `Status anterior: "${statusAnterior}". Reversão restaura o status prévio.`,
          registro_id: orcId,
          dados_aplicados: {
            orcamento_id: orcId,
            orcamento_numero: numOrc,
            status_anterior: statusAnterior,
            novo_status: novoStatus,
          },
          user_id: user.id,
        })

        setUltimoRecibo(recibo)
        await carregarAcoesUltimas24h()
        setAppliedSuccess(
          `Status do orçamento ${numOrc} atualizado para "${novoStatus}" com sucesso!`,
        )
        toast({
          title: 'Status alterado com sucesso!',
          description: resultado.comando_status.mensagem_confirmacao,
        })
        return
      }

      // Caso 2: Criação de novo cliente ditado
      if (resultado.intencao_detectada === 'cliente' && resultado.cliente_novo?.nome) {
        const c = resultado.cliente_novo
        const nomeCli = String(c.nome || '').trim()
        const emailCli =
          c.email && String(c.email).trim()
            ? String(c.email).trim()
            : `${nomeCli.toLowerCase().replace(/\s+/g, '.')}@cliente.com`

        const novoCliente = await clientesService.criar({
          nome: nomeCli,
          email: emailCli,
          telefone: c.telefone ? String(c.telefone).trim() : '',
          empresa: c.empresa ? String(c.empresa).trim() : '',
          endereco: c.endereco ? String(c.endereco).trim() : '',
          user_id: user.id,
        })

        // Registrar recibo na coleção acoes_voz
        const recibo = await acoesVozService.registrar({
          tipo_acao: 'criacao_cliente',
          titulo: `Cliente criado: ${nomeCli}`,
          descricao_resumo:
            `${novoCliente.telefone ? `Tel: ${novoCliente.telefone}` : ''} ${novoCliente.empresa ? `· Empresa: ${novoCliente.empresa}` : ''}`.trim() ||
            'Cadastrado via voz',
          registro_id: novoCliente.id,
          dados_aplicados: {
            cliente_id: novoCliente.id,
            nome: nomeCli,
            email: emailCli,
            telefone: novoCliente.telefone || '',
            empresa: novoCliente.empresa || '',
            endereco: novoCliente.endereco || '',
          },
          user_id: user.id,
        })

        setUltimoRecibo(recibo)
        await carregarAcoesUltimas24h()
        setAppliedSuccess(`Cliente "${nomeCli}" cadastrado com sucesso na base!`)
        toast({
          title: 'Cliente cadastrado!',
          description: `"${nomeCli}" salvo com sucesso.`,
        })
        return
      }

      // Caso 3: Orçamento estruturado
      // Cria cliente antes se for cliente novo
      let cliId = resultado.cliente_sugerido_id
      let clienteCriadoJuntoId: string | undefined = undefined

      if (!cliId && resultado.cliente_novo?.nome) {
        const c = resultado.cliente_novo
        const nomeCli = String(c.nome || '').trim()
        const emailCli =
          c.email && String(c.email).trim()
            ? String(c.email).trim()
            : `${nomeCli.toLowerCase().replace(/\s+/g, '.')}@cliente.com`

        const criado = await clientesService.criar({
          nome: nomeCli,
          email: emailCli,
          telefone: c.telefone ? String(c.telefone).trim() : '',
          empresa: c.empresa ? String(c.empresa).trim() : '',
          endereco: c.endereco ? String(c.endereco).trim() : '',
          user_id: user.id,
        })
        cliId = criado.id
        clienteCriadoJuntoId = criado.id
      }

      if (!cliId) {
        // Redireciona para o formulário para escolher cliente
        navigate('/orcamentos/novo', {
          state: {
            textoReaproveitado: resultado.transcricao_corrigida,
            interpretacaoSalva: resultado,
          },
        })
        toast({
          title: 'Quase lá!',
          description: 'Selecione um cliente para finalizar o orçamento.',
        })
        return
      }

      const itensValidos =
        Array.isArray(resultado.itens) && resultado.itens.length > 0
          ? resultado.itens
          : [
              {
                descricao: resultado.descricao_servico || 'Serviço prestado',
                quantidade: 1,
                valor_unitario: 300,
              },
            ]

      const subtotal = itensValidos.reduce(
        (acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
        0,
      )

      const proxNum = await orcamentosService.obterProximoNumero(user.id)
      const novoOrc = await orcamentosService.criar({
        cliente_id: cliId,
        descricao: resultado.descricao_servico || resultado.transcricao_corrigida,
        itens: itensValidos,
        impostos: 0,
        subtotal: Number(subtotal.toFixed(2)),
        valor_total: Number(subtotal.toFixed(2)),
        status: 'rascunho',
        numero: proxNum,
        user_id: user.id,
      })

      // Registrar recibo na coleção acoes_voz
      const recibo = await acoesVozService.registrar({
        tipo_acao: 'criacao_orcamento',
        titulo: `Orçamento criado: ${novoOrc.numero}`,
        descricao_resumo: `${resultado.descricao_servico || 'Serviço'} · Total: ${formatarMoedaBRL(novoOrc.valor_total)}`,
        registro_id: novoOrc.id,
        dados_aplicados: {
          orcamento_id: novoOrc.id,
          cliente_id: cliId,
          cliente_criado_junto_id: clienteCriadoJuntoId,
          descricao: novoOrc.descricao,
          itens: novoOrc.itens,
          valor_total: novoOrc.valor_total,
          numero: novoOrc.numero,
          transcricao_original: resultado.transcricao_corrigida,
        },
        user_id: user.id,
      })

      setUltimoRecibo(recibo)
      await carregarAcoesUltimas24h()
      setAppliedSuccess(`Orçamento ${novoOrc.numero} gerado e salvo com sucesso!`)
      toast({
        title: 'Orçamento Criado!',
        description: `Orçamento ${novoOrc.numero} salvo na sua conta.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao aplicar ação'
      toast({
        variant: 'destructive',
        title: 'Erro ao aplicar',
        description: msg,
      })
    } finally {
      setIsApplying(false)
    }
  }

  // Executar Desfazer de uma ação
  const handleDesfazerAcao = async (acao: AcaoVozRegistro) => {
    setUndoingId(acao.id)
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
        await carregarAcoesUltimas24h()
      } else {
        toast({
          variant: 'destructive',
          title: 'Não foi possível desfazer',
          description: res.mensagem,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao reverter'
      toast({
        variant: 'destructive',
        title: 'Erro ao desfazer',
        description: msg,
      })
    } finally {
      setUndoingId(null)
    }
  }

  // Reabrir tela/formulário para "Editar" com dados já preenchidos
  const handleEditarAcao = (acao: AcaoVozRegistro) => {
    const dados = (acao.dados_aplicados || {}) as Record<string, unknown>
    if (acao.tipo_acao === 'criacao_orcamento' && acao.registro_id) {
      navigate(`/orcamentos/${acao.registro_id}/editar`)
    } else if (acao.tipo_acao === 'criacao_cliente') {
      navigate('/clientes', {
        state: {
          textoReaproveitado: acao.titulo,
          interpretacaoSalva: {
            cliente_novo: {
              nome: dados.nome,
              email: dados.email,
              telefone: dados.telefone,
              empresa: dados.empresa,
              endereco: dados.endereco,
            },
          },
        },
      })
    } else if (acao.tipo_acao === 'mudanca_status' && acao.registro_id) {
      navigate(`/orcamentos/${acao.registro_id}`)
    }
  }

  const currentSpeech = `${finalTranscript} ${liveTranscript}`.trim()

  return (
    <div className="min-h-[85vh] flex flex-col justify-between max-w-lg mx-auto py-2 sm:py-6 animate-fade-in">
      {/* TOPO: VOLTAR & TÍTULO */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orcamentos')}
          className="text-slate-600 hover:text-slate-900 -ml-2 h-9"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>

        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Modo Só Falar
            </span>
          </div>
          <span className="text-[10px] text-slate-500">Otimizado para Celular</span>
        </div>
      </div>

      {/* ÁREA CENTRAL INTERATIVA */}
      <div className="my-auto py-6 flex flex-col items-center justify-center text-center space-y-6">
        {/* MENSAGEM DE ERRO DE MICROFONE */}
        {micPermissionError && (
          <div className="w-full p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm text-left space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Acesso ao Microfone Necessário</span>
            </div>
            <p>{micPermissionError}</p>
            <Button
              type="button"
              size="sm"
              onClick={startListening}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* RECIBO APÓS APLICAR AÇÃO DE VOZ (MELHORIA 1) */}
        {appliedSuccess && ultimoRecibo && (
          <div className="w-full space-y-3 animate-scale-in text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                Recibo do Comando Aplicado
              </span>
              <span className="text-[11px] text-slate-500">Válido por 24h</span>
            </div>

            <ReciboAcaoVoz
              acao={ultimoRecibo}
              onDesfazer={handleDesfazerAcao}
              onEditar={handleEditarAcao}
              isUndoing={undoingId === ultimoRecibo.id}
            />

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setAppliedSuccess(null)
                  setResultado(null)
                  startListening()
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-semibold"
              >
                <Mic className="w-3.5 h-3.5 mr-1.5" />
                Falar Novo Comando
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigate('/orcamentos')}
                className="text-xs h-9 border-slate-300"
              >
                Ver Orçamentos
              </Button>
            </div>
          </div>
        )}

        {/* RESULTADO INTERPRETADO PELA IA (SE PRONTO) */}
        {!appliedSuccess && resultado && (
          <div className="w-full bg-white rounded-3xl border-2 border-emerald-500 shadow-xl p-5 sm:p-6 text-left space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Revisão do que Você Falou</h4>
                  <span className="text-[10px] text-emerald-700 uppercase font-bold tracking-wide">
                    Confiança: {resultado.confianca}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResultado(null)
                  startListening()
                }}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Regravar
              </button>
            </div>

            {/* Fala corrigida */}
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-0.5 border border-slate-200">
              <span className="text-slate-500 font-semibold block text-[11px]">Você disse:</span>
              <p className="text-slate-900 font-medium italic">
                &ldquo;{resultado.transcricao_corrigida}&rdquo;
              </p>
            </div>

            {/* Ação mapeada */}
            <div className="space-y-2 text-xs">
              {resultado.comando_status?.novo_status ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                    Comando de Status Identificado:
                  </span>
                  <p className="text-amber-950 font-medium">
                    {resultado.comando_status.mensagem_confirmacao}
                  </p>
                </div>
              ) : resultado.intencao_detectada === 'cliente' && resultado.cliente_novo?.nome ? (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-1.5">
                  <span className="font-bold text-purple-900 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                    Novo Cliente Identificado:
                  </span>
                  <p className="text-purple-950 font-semibold">{resultado.cliente_novo.nome}</p>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <p>
                      <span className="text-slate-500">Telefone:</span>{' '}
                      {resultado.cliente_novo.telefone || (
                        <span className="text-slate-400 italic">não informado</span>
                      )}
                    </p>
                    <p>
                      <span className="text-slate-500">E-mail:</span>{' '}
                      {resultado.cliente_novo.email || (
                        <span className="text-slate-400 italic">não informado (será gerado)</span>
                      )}
                    </p>
                    {resultado.cliente_novo.empresa && (
                      <p>
                        <span className="text-slate-500">Empresa:</span>{' '}
                        {resultado.cliente_novo.empresa}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 space-y-1">
                    <span className="font-bold text-blue-900 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      Orçamento Identificado:
                    </span>
                    <p className="text-blue-950 font-medium">
                      {resultado.descricao_servico || resultado.transcricao_corrigida}
                    </p>
                    {resultado.cliente_sugerido_nome && (
                      <p className="text-xs text-blue-800">
                        Cliente: <strong>{resultado.cliente_sugerido_nome}</strong>
                      </p>
                    )}
                  </div>

                  {Array.isArray(resultado.itens) && resultado.itens.length > 0 && (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        Itens extraídos ({resultado.itens.length}):
                      </span>
                      {resultado.itens.map((it, idx) => {
                        const qtd = Number(it.quantidade) || 1
                        const val = Number(it.valor_unitario) || 0
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-0.5"
                          >
                            <span className="text-slate-800 truncate mr-2">
                              {qtd}x {it.descricao || 'Item de serviço'}
                            </span>
                            <span className="font-semibold text-slate-900 shrink-0">
                              {formatarMoedaBRL(val * qtd)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BOTÃO GIGANTE DE CONFIRMAÇÃO */}
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleApplyResult}
                disabled={isApplying}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg transition-transform active:scale-[0.98]"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aplicando no sistema...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2 stroke-[3]" />
                    Confirmar e Aplicar Agora
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ESTADO CENTRAL: MICROFONE GIGANTE DE ESCUTA */}
        {!appliedSuccess && !resultado && (
          <div className="flex flex-col items-center justify-center space-y-6 w-full">
            {/* ONDAS SONORAS AO REDOR DO BOTÃO */}
            <div className="relative flex items-center justify-center">
              {isListening && (
                <>
                  <span className="absolute w-44 h-44 rounded-full bg-rose-500/20 animate-ping" />
                  <span className="absolute w-36 h-36 rounded-full bg-rose-500/30 animate-pulse" />
                </>
              )}

              {/* BOTÃO GIGANTE CENTRAL */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  if (isListening) {
                    stopAndProcess()
                  } else {
                    startListening()
                  }
                }}
                className={cn(
                  'relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all duration-300 transform active:scale-95 focus:outline-none',
                  isListening
                    ? 'bg-gradient-to-tr from-rose-600 to-red-500 ring-8 ring-rose-300/40'
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 hover:scale-105',
                  isProcessing && 'opacity-60 cursor-not-allowed',
                )}
                aria-label={isListening ? 'Parar e Processar' : 'Toque para Falar'}
              >
                {isListening ? (
                  <>
                    <Square className="w-10 h-10 fill-current mb-1" />
                    <span className="text-[11px] font-bold tracking-wider uppercase">Concluir</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-10 h-10 mb-1 animate-bounce-subtle" />
                    <span className="text-[11px] font-bold tracking-wider uppercase">
                      Tocar p/ Falar
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* STATUS E CONTADOR */}
            <div className="space-y-1 max-w-sm px-4">
              {isListening ? (
                <>
                  <div className="flex items-center justify-center gap-2 text-rose-600 font-mono text-base font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                    <span>Ouvindo sua voz ({duration}s)</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Fale à vontade: orçamentos, novos clientes ou comandos de status. Quando
                    terminar, toque no botão central.
                  </p>
                </>
              ) : isProcessing ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>A IA está estruturando o que você disse...</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Corrigindo erros fonéticos, identificando valores e clientes.
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="text-base font-bold text-slate-800">
                    Toque no microfone e comece a falar
                  </h3>
                  <p className="text-xs text-slate-500">
                    O sistema escuta tudo, estrutura no formato ideal e você aprova em 1 toque sem
                    digitar nada.
                  </p>
                </>
              )}
            </div>

            {/* TRANSCRIÇÃO EM TEMPO REAL NA TELA */}
            {isListening && currentSpeech && (
              <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left shadow-inner max-h-36 overflow-y-auto animate-fade-in">
                <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider flex items-center gap-1 mb-1">
                  <Volume2 className="w-3 h-3" /> Transcrevendo ao vivo:
                </span>
                <p className="text-sm text-slate-800 font-medium italic leading-relaxed">
                  &ldquo;{currentSpeech}&rdquo;
                </p>
              </div>
            )}

            {isListening && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="text-xs text-slate-500 hover:text-rose-600 h-8"
              >
                Cancelar gravação
              </Button>
            )}
          </div>
        )}
      </div>

      {/* LISTA DE AÇÕES DOS ÚLTIMOS 24H (MELHORIA 1) */}
      <div className="w-full pt-6 border-t border-slate-200 space-y-3 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Ações dos Últimos 24h
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
              {acoesUltimas24h.length}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Diga &ldquo;desfaz aquilo&rdquo; para reverter a mais recente
          </span>
        </div>

        {loadingAcoes ? (
          <div className="space-y-2">
            <div className="h-16 bg-slate-100 animate-pulse rounded-xl" />
            <div className="h-16 bg-slate-100 animate-pulse rounded-xl" />
          </div>
        ) : acoesUltimas24h.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-center text-xs text-slate-500">
            Nenhuma ação registrada nas últimas 24 horas. Fale um comando acima para testar.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {acoesUltimas24h.map((acao) => (
              <ReciboAcaoVoz
                key={acao.id}
                acao={acao}
                onDesfazer={handleDesfazerAcao}
                onEditar={handleEditarAcao}
                isUndoing={undoingId === acao.id}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {/* RODAPÉ INFORMATIVO: EXEMPLOS DE FRASES QUE A IA ENTENDE */}
      <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-1.5">
        <span className="font-semibold text-slate-700 flex items-center justify-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-emerald-600" /> Exemplos que você pode ditar:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60">
            <strong>Orçamento:</strong> &ldquo;Faz um orçamento pro João Carlos de cabeamento de
            rede por 450 reais&rdquo;
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60">
            <strong>Comando de status:</strong> &ldquo;Marcar o orçamento 3 como aprovado&rdquo;
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60">
            <strong>Cliente:</strong> &ldquo;Cadastra o cliente Marcos Souza, fone 11 98888-0000 da
            empresa Alfa&rdquo;
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60">
            <strong>Desfazer por voz:</strong> &ldquo;Desfaz aquilo&rdquo; ou &ldquo;Desfaz o
            último&rdquo;
          </div>
        </div>
      </div>

      {/* CONFIRMAÇÃO DO COMANDO DE VOZ PARA DESFAZER */}
      <AlertDialog
        open={!!confirmarDesfazerVozAcao}
        onOpenChange={(open) => !open && setConfirmarDesfazerVozAcao(null)}
      >
        <AlertDialogContent className="max-w-[420px] rounded-2xl bg-white text-slate-900 p-6">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
              <RotateCcw className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Desfazer Última Ação por Voz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>
                Você pediu para desfazer:{' '}
                <strong className="text-slate-900">
                  &ldquo;{confirmarDesfazerVozAcao?.titulo}&rdquo;
                </strong>
                .
              </p>
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                {confirmarDesfazerVozAcao?.tipo_acao === 'criacao_cliente' &&
                  'O cliente criado por voz será excluído da base.'}
                {confirmarDesfazerVozAcao?.tipo_acao === 'criacao_orcamento' &&
                  'O orçamento gerado por voz será excluído do sistema.'}
                {confirmarDesfazerVozAcao?.tipo_acao === 'mudanca_status' &&
                  'O orçamento retornará ao status anterior.'}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="h-9 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmarDesfazerVozAcao) {
                  const target = confirmarDesfazerVozAcao
                  setConfirmarDesfazerVozAcao(null)
                  await handleDesfazerAcao(target)
                }
              }}
              className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              Sim, Desfazer Agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
