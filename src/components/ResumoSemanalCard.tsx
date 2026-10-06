import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Radio,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  TrendingUp,
  Clock,
  DollarSign,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Mail,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ResumoSemanalData, formatarMoedaBRL } from '@/types'
import { resumoSemanalService } from '@/services/resumoSemanal'
import { toast } from '@/hooks/use-toast'

export interface ResumoSemanalCardProps {
  userName?: string
  onAbrirOrcamentos?: () => void
  onAbrirContasReceber?: () => void
  className?: string
}

export const ResumoSemanalCard: React.FC<ResumoSemanalCardProps> = ({
  userName = 'Gestor(a)',
  onAbrirOrcamentos,
  onAbrirContasReceber,
  className = '',
}) => {
  // Estados de dados
  const [data, setData] = useState<ResumoSemanalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Estados de reprodução de voz nativa (SpeechSynthesis)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [vozPtBr, setVozPtBr] = useState<SpeechSynthesisVoice | null>(null)
  const [progressoEstimado, setProgressoEstimado] = useState(0)

  // Ciclo de vida blindado com isMountedRef
  const isMountedRef = useRef<boolean>(true)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const progressoIntervalRef = useRef<number | null>(null)

  // Carrega as vozes disponíveis no navegador e seleciona a melhor pt-BR
  const carregarVozes = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (isMountedRef.current) setSpeechSupported(false)
      return
    }

    try {
      const vozes = window.speechSynthesis.getVoices()
      if (!vozes || vozes.length === 0) return

      // Prioriza vozes pt-BR de qualidade conhecida
      const vozBr =
        vozes.find(
          (v) =>
            v.lang === 'pt-BR' &&
            (v.name.includes('Google') ||
              v.name.includes('Luciana') ||
              v.name.includes('Natural') ||
              v.name.includes('Francisca')),
        ) ||
        vozes.find((v) => v.lang === 'pt-BR') ||
        vozes.find((v) => v.lang.startsWith('pt')) ||
        null

      if (isMountedRef.current && vozBr) {
        setVozPtBr(vozBr)
      }
    } catch {
      /* noop */
    }
  }, [])

  // Inicialização e limpeza defensiva (SpeechSynthesis cleanup)
  useEffect(() => {
    isMountedRef.current = true

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeechSupported(false)
    } else {
      carregarVozes()
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = carregarVozes
      }
    }

    // Carrega o resumo da semana (usa cache por semana automaticamente)
    const carregarResumo = async () => {
      try {
        setLoading(true)
        setErro(null)
        const resultado = await resumoSemanalService.obter()
        if (isMountedRef.current) {
          setData(resultado)
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setErro(err instanceof Error ? err.message : 'Falha ao carregar resumo semanal')
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }

    carregarResumo()

    return () => {
      isMountedRef.current = false
      if (progressoIntervalRef.current) {
        clearInterval(progressoIntervalRef.current)
        progressoIntervalRef.current = null
      }
      // OBRIGATÓRIO: Cancela qualquer síntese ativa ao desmontar para evitar bug "insertBefore"
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel()
        } catch {
          /* noop */
        }
      }
    }
  }, [carregarVozes])

  // Limpa o timer de progresso
  const pararProgresso = () => {
    if (progressoIntervalRef.current) {
      clearInterval(progressoIntervalRef.current)
      progressoIntervalRef.current = null
    }
  }

  // Inicia animação estimada de progresso (baseada na quantidade de palavras, média de ~2.2 palavras/segundo)
  const iniciarProgresso = (texto: string) => {
    pararProgresso()
    const palavras = texto.trim().split(/\s+/).length
    const duracaoTotalSecs = Math.max(15, Math.min(120, palavras / 2.3))
    const incrementoPorIntervalo = 100 / (duracaoTotalSecs * 10) // a cada 100ms

    setProgressoEstimado(0)
    progressoIntervalRef.current = window.setInterval(() => {
      if (!isMountedRef.current) return
      setProgressoEstimado((prev) => {
        if (prev >= 98) return 98
        return prev + incrementoPorIntervalo
      })
    }, 100)
  }

  // Reproduzir / Pausar áudio do resumo usando SpeechSynthesis
  const togglePlayAudio = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    const synth = window.speechSynthesis

    // Caso 1: Estava pausado, continuar reprodução
    if (isPlaying && isPaused) {
      try {
        synth.resume()
        if (isMountedRef.current) {
          setIsPaused(false)
        }
        return
      } catch {
        /* fallback para iniciar do zero */
      }
    }

    // Caso 2: Estava tocando, pausar
    if (isPlaying && !isPaused) {
      try {
        synth.pause()
        if (isMountedRef.current) {
          setIsPaused(true)
        }
        pararProgresso()
        return
      } catch {
        /* noop */
      }
    }

    // Caso 3: Iniciar reprodução do início
    const textoParaFalar = data?.resumo_texto
    if (!textoParaFalar) return

    try {
      synth.cancel() // Limpa fila anterior

      const utterance = new SpeechSynthesisUtterance(textoParaFalar)
      utterance.lang = 'pt-BR'
      utterance.rate = 1.05 // velocidade natural de podcast dinâmico
      utterance.pitch = 1.0

      if (vozPtBr) {
        utterance.voice = vozPtBr
      }

      utterance.onstart = () => {
        if (!isMountedRef.current) return
        setIsPlaying(true)
        setIsPaused(false)
        iniciarProgresso(textoParaFalar)
      }

      utterance.onend = () => {
        if (!isMountedRef.current) return
        setIsPlaying(false)
        setIsPaused(false)
        setProgressoEstimado(100)
        pararProgresso()
        setTimeout(() => {
          if (isMountedRef.current) setProgressoEstimado(0)
        }, 1500)
      }

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis aviso ou cancelamento:', e)
        if (!isMountedRef.current) return
        setIsPlaying(false)
        setIsPaused(false)
        pararProgresso()
      }

      utteranceRef.current = utterance
      synth.speak(utterance)
    } catch (err) {
      console.warn('Erro ao disparar SpeechSynthesis:', err)
      if (isMountedRef.current) {
        setIsPlaying(false)
        setIsPaused(false)
        pararProgresso()
      }
    }
  }

  // Parar síntese de voz
  const handleStopAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* noop */
      }
    }
    if (isMountedRef.current) {
      setIsPlaying(false)
      setIsPaused(false)
      setProgressoEstimado(0)
    }
    pararProgresso()
  }

  // Forçar regeneração com IA (novo resumo da semana)
  const handleRegenerar = async () => {
    handleStopAudio()
    try {
      setRegenerating(true)
      setErro(null)
      const novo = await resumoSemanalService.obter({ forcarRegeneracao: true })
      if (isMountedRef.current) {
        setData(novo)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setErro(err instanceof Error ? err.message : 'Falha ao regenerar resumo')
      }
    } finally {
      if (isMountedRef.current) {
        setRegenerating(false)
      }
    }
  }

  // Disparo manual de e-mail de teste/resumo semanal
  const handleEnviarEmail = async () => {
    try {
      setEnviandoEmail(true)
      const res = await resumoSemanalService.dispararEmail({ forcarReenvio: true })
      if (!isMountedRef.current) return

      if (res.sucesso) {
        toast({
          title: 'Resumo enviado por e-mail!',
          description: `E-mail transacional enviado com sucesso para ${res.destinatario || 'sua conta'}.`,
        })
      } else {
        toast({
          title: 'Aviso de envio',
          description: res.error || 'Não foi possível confirmar o envio por e-mail.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      toast({
        title: 'Falha ao enviar e-mail',
        description:
          err instanceof Error ? err.message : 'Erro ao disparar e-mail do resumo semanal',
        variant: 'destructive',
      })
    } finally {
      if (isMountedRef.current) {
        setEnviandoEmail(false)
      }
    }
  }

  const metricas = data?.metricas

  return (
    <div
      className={`relative rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 text-white shadow-xl overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* GLOW DECORATIVO DE FUNDO */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-5 sm:p-7 space-y-5">
        {/* CABEÇALHO COM TÍTULO DO PODCAST SEMANAL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-300">
                  Podcast Semanal IA · 1 Minuto
                </span>
                <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-400/30 text-[10px] font-semibold px-2 py-0.5">
                  Resumo Executivo em Áudio
                </Badge>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                Resumo da Semana em Áudio
              </h3>
            </div>
          </div>

          {/* BOTÕES DE CONTROLE: OUVIR RESUMO & NOVO RESUMO */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* BOTÃO OUVIR / PAUSAR */}
            <Button
              type="button"
              size="sm"
              disabled={loading || regenerating || !data?.resumo_texto}
              onClick={togglePlayAudio}
              className={`h-9 px-4 rounded-xl font-semibold text-xs shadow-md transition-all active:scale-95 ${
                isPlaying && !isPaused
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white'
              }`}
            >
              {isPlaying && !isPaused ? (
                <>
                  <Pause className="w-4 h-4 mr-1.5 fill-current" />
                  Pausar áudio
                </>
              ) : isPaused ? (
                <>
                  <Play className="w-4 h-4 mr-1.5 fill-current" />
                  Continuar ouvindo
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1.5 fill-current" />
                  Ouvir resumo
                </>
              )}
            </Button>

            {/* BOTÃO PARAR (EXIBE SE ESTIVER TOCANDO) */}
            {isPlaying && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleStopAudio}
                className="h-9 px-3 rounded-xl border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs"
                title="Parar áudio"
              >
                <VolumeX className="w-4 h-4" />
              </Button>
            )}

            {/* BOTÃO NOVO RESUMO (REGENERAR COM IA) */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading || regenerating}
                    onClick={handleRegenerar}
                    className="h-9 px-3 rounded-xl border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-medium"
                  >
                    <RotateCcw
                      className={`w-3.5 h-3.5 mr-1.5 ${regenerating ? 'animate-spin' : ''}`}
                    />
                    {regenerating ? 'Gerando...' : 'Novo resumo'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">
                    Recalcular métricas dos últimos 7 dias e pedir um novo roteiro para a IA
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* BOTÃO TESTAR/ENVIAR E-MAIL AGORA */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading || enviandoEmail}
                    onClick={handleEnviarEmail}
                    className="h-9 px-3 rounded-xl border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-medium"
                  >
                    <Mail
                      className={`w-3.5 h-3.5 mr-1.5 ${enviandoEmail ? 'animate-pulse text-amber-300' : ''}`}
                    />
                    {enviandoEmail ? 'Enviando...' : 'Receber por e-mail'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">
                    Disparar o e-mail HTML do resumo semanal para o seu endereço agora (teste
                    manual)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* BARRA DE ONDAS / STATUS DO ÁUDIO */}
        {isPlaying && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 animate-fade-in">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-300">
                {isPaused ? 'Áudio pausado' : 'Reproduzindo resumo em voz alta (pt-BR)...'}
              </span>
            </div>
            {/* ONDAS SONORAS ANIMADAS */}
            <div className="flex items-center gap-1 h-4">
              {[40, 80, 50, 95, 65, 100, 45, 85, 60, 90, 50].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isPaused ? 'bg-white/40' : 'bg-emerald-400 animate-pulse'
                  }`}
                  style={{
                    height: isPaused ? '40%' : `${h}%`,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* PROGRESSO ESTIMADO QUANDO EM REPRODUÇÃO */}
        {progressoEstimado > 0 && (
          <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
            <div
              className="bg-emerald-400 h-1 transition-all duration-200"
              style={{ width: `${progressoEstimado}%` }}
            />
          </div>
        )}

        {/* TEXTO DO RESUMO (ACIBILIDADE & LEITURA VISUAL) */}
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 sm:p-5">
          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-full bg-white/20" />
              <Skeleton className="h-4 w-5/6 bg-white/20" />
              <Skeleton className="h-4 w-4/6 bg-white/20" />
            </div>
          ) : erro ? (
            <div className="flex items-center gap-2 text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-indigo-200 font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Roteiro de Áudio da IA (Persona:{' '}
                  {data?.preferencias_aplicadas?.nome_preferido || userName} · Tom:{' '}
                  {data?.preferencias_aplicadas?.tom_resposta || 'amigável'})
                </span>
                <span className="text-white/60 text-[10px]">~1 min de fala</span>
              </div>
              <p className="text-sm sm:text-base font-normal text-white/95 leading-relaxed italic select-text">
                &ldquo;{data?.resumo_texto}&rdquo;
              </p>

              {metricas && metricas.total_gastos !== undefined && metricas.total_gastos > 0 && (
                <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-xs text-rose-200 font-medium">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span>
                    Você registrou <strong>{formatarMoedaBRL(metricas.total_gastos)}</strong> em
                    gastos esta semana ({metricas.qtd_gastos} lançamentos).
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4 CARDS DE MÉTRICAS CONSOLIDADAS DOS ÚLTIMOS 7 DIAS */}
        {metricas && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {/* 1. Fechados na semana */}
            <div
              onClick={onAbrirOrcamentos}
              className={`p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors ${
                onAbrirOrcamentos ? 'cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center justify-between text-indigo-200 text-xs font-semibold">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Fechados (7d)
                </span>
                <span className="text-white font-bold">{metricas.orcamentos_aprovados}</span>
              </div>
              <div className="mt-1.5">
                <span className="text-base sm:text-lg font-black text-white tabular-nums block truncate">
                  {formatarMoedaBRL(metricas.valor_aprovado)}
                </span>
                <span className="text-[10px] text-indigo-300/80">Propostas aprovadas</span>
              </div>
            </div>

            {/* 2. Criados / Enviados */}
            <div
              onClick={onAbrirOrcamentos}
              className={`p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors ${
                onAbrirOrcamentos ? 'cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center justify-between text-indigo-200 text-xs font-semibold">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  Criados (7d)
                </span>
                <span className="text-white font-bold">{metricas.orcamentos_criados}</span>
              </div>
              <div className="mt-1.5">
                <span className="text-base sm:text-lg font-black text-white tabular-nums block">
                  {metricas.orcamentos_criados}{' '}
                  <span className="text-xs font-medium text-indigo-300">propostas</span>
                </span>
                <span className="text-[10px] text-indigo-300/80">
                  {metricas.orcamentos_enviados} enviadas
                </span>
              </div>
            </div>

            {/* 3. Sem resposta há 5+ dias */}
            <div
              onClick={onAbrirOrcamentos}
              className={`p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors ${
                onAbrirOrcamentos ? 'cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center justify-between text-indigo-200 text-xs font-semibold">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  Sem resposta
                </span>
                <span className="text-white font-bold">
                  {metricas.orcamentos_sem_resposta_5_dias}
                </span>
              </div>
              <div className="mt-1.5">
                <span className="text-base sm:text-lg font-black text-white tabular-nums block">
                  {metricas.orcamentos_sem_resposta_5_dias}{' '}
                  <span className="text-xs font-medium text-amber-300">há 5+ dias</span>
                </span>
                <span className="text-[10px] text-amber-200/80">Follow-up recomendado</span>
              </div>
            </div>

            {/* 4. A receber / Cobranças */}
            <div
              onClick={onAbrirContasReceber}
              className={`p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors ${
                onAbrirContasReceber ? 'cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center justify-between text-indigo-200 text-xs font-semibold">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
                  A receber
                </span>
                {metricas.novos_clientes > 0 && (
                  <span className="text-[10px] bg-indigo-500/30 px-1.5 py-0.5 rounded text-indigo-200">
                    +{metricas.novos_clientes} clientes
                  </span>
                )}
              </div>
              <div className="mt-1.5">
                <span className="text-base sm:text-lg font-black text-white tabular-nums block truncate">
                  {formatarMoedaBRL(metricas.valor_pendente)}
                </span>
                <span className="text-[10px] text-emerald-300/80">Saldo em aberto</span>
              </div>
            </div>
          </div>
        )}

        {/* NOTA SOBRE SUPORTE A SÍNTESE DE VOZ */}
        {!speechSupported && (
          <div className="text-[11px] text-amber-300/80 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>
              A síntese de voz nativa não está disponível neste navegador. O resumo pode ser lido
              normalmente no card acima.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResumoSemanalCard
