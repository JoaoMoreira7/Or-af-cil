import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Send,
  RotateCcw,
  Volume2,
  Sparkles,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { getPermissionGuide } from '@/lib/audioPermissions'

export interface VoiceRecorderProps {
  onAudioReady?: (blob: Blob, transcript: string) => void
  onSendTranscript: (transcript: string) => void
  isProcessing?: boolean
  placeholder?: string
  compact?: boolean
  className?: string
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onAudioReady,
  onSendTranscript,
  isProcessing = false,
  placeholder = 'Segure ou clique no microfone para gravar como no WhatsApp...',
  compact = false,
  className,
}) => {
  const { toast } = useToast()

  // Estados de gravação
  const [isRecording, setIsRecording] = useState(false)
  const [recordDuration, setRecordDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioDuration, setAudioDuration] = useState(0)

  // Player de áudio
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)

  // Transcrição Web Speech
  const [liveTranscript, setLiveTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [speechSupported, setSpeechSupported] = useState(true)

  // Arrastar para cancelar
  const [dragOffset, setDragOffset] = useState(0)
  const [isDraggingCancel, setIsDraggingCancel] = useState(false)

  // Refs de controle
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const timerIntervalRef = useRef<number | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const startXRef = useRef<number>(0)
  const isHoldModeRef = useRef<boolean>(false)
  const isMountedRef = useRef<boolean>(true)

  // Inicializa suporte a SpeechRecognition e rastreamento de montagem
  useEffect(() => {
    isMountedRef.current = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
    }

    return () => {
      isMountedRef.current = false
      // Cleanup ao desmontar
      stopRecordingCleanup()
      if (audioUrl) {
        try {
          URL.revokeObjectURL(audioUrl)
        } catch {
          /* noop */
        }
      }
    }
  }, [audioUrl])

  const formatSeconds = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60)
    const secs = Math.floor(totalSecs % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  // Cleanup de streams
  const stopRecordingCleanup = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    if (recognitionRef.current) {
      try {
        if (typeof recognitionRef.current.abort === 'function') {
          recognitionRef.current.abort()
        } else {
          recognitionRef.current.stop()
        }
      } catch {
        /* intentionally ignored */
      }
      recognitionRef.current = null
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop())
      } catch {
        /* intentionally ignored */
      }
      streamRef.current = null
    }
  }

  // Iniciar gravação de voz (MediaRecorder + Web Speech API simultâneos)
  const startRecording = async () => {
    if (isProcessing) return

    // Reseta estados anteriores
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioUrl(null)
    setAudioBlob(null)
    setLiveTranscript('')
    setFinalTranscript('')
    setRecordDuration(0)
    setDragOffset(0)
    setIsDraggingCancel(false)
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      // Configura MediaRecorder
      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '' // browser default
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        if (!isMountedRef.current) return
        const mime = recorder.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: mime })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
      }

      recorder.start(100) // pedaços a cada 100ms
      mediaRecorderRef.current = recorder
      if (isMountedRef.current) {
        setIsRecording(true)
      }

      // Inicia timer
      const startTime = Date.now()
      timerIntervalRef.current = window.setInterval(() => {
        if (!isMountedRef.current) return
        const elapsed = (Date.now() - startTime) / 1000
        setRecordDuration(elapsed)
      }, 100)

      // Inicia Web Speech API em paralelo
      startSpeechRecognition()
    } catch (err) {
      console.error('Erro ao acessar microfone:', err)
      if (isMountedRef.current) {
        setIsRecording(false)
        const isDenied =
          (err as { name?: string })?.name === 'NotAllowedError' ||
          (err as { name?: string })?.name === 'PermissionDeniedError'
        if (isDenied) {
          const guide = getPermissionGuide()
          toast({
            variant: 'destructive',
            title: 'Permissão de microfone negada',
            description: `${guide.title} ${guide.steps[0]}`,
          })
        }
      }
      stopRecordingCleanup()
    }
  }

  const startSpeechRecognition = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'pt-BR'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      let accumulated = ''

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            accumulated += (accumulated ? ' ' : '') + trans
          } else {
            interim += trans
          }
        }
        setLiveTranscript(interim)
        setFinalTranscript(accumulated)
      }

      recognition.onerror = (e: unknown) => {
        console.warn('SpeechRecognition aviso:', e)
      }

      recognition.onend = () => {
        // Se ainda estiver montado e gravando, tenta reiniciar
        if (
          isMountedRef.current &&
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === 'recording'
        ) {
          try {
            recognition.start()
          } catch {
            /* intentionally ignored */
          }
        }
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch (err) {
      console.warn('Não foi possível iniciar SpeechRecognition:', err)
    }
  }

  // Parar gravação e gerar áudio
  const stopRecording = useCallback(() => {
    if (!isRecording) return

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    setIsRecording(false)
    setAudioDuration(recordDuration)
    stopRecordingCleanup()
  }, [isRecording, recordDuration])

  // Cancelar gravação e descartar tudo
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    audioChunksRef.current = []
    setIsRecording(false)
    setAudioUrl(null)
    setAudioBlob(null)
    setRecordDuration(0)
    setLiveTranscript('')
    setFinalTranscript('')
    setDragOffset(0)
    setIsDraggingCancel(false)
    stopRecordingCleanup()
  }, [])

  // Descartar áudio gerado
  const discardAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioUrl(null)
    setAudioBlob(null)
    setAudioDuration(0)
    setLiveTranscript('')
    setFinalTranscript('')
    setIsPlaying(false)
    setPlaybackTime(0)
  }

  // Enviar para a IA
  const handleSendToAI = () => {
    const fullTranscript = `${finalTranscript} ${liveTranscript}`.trim()
    if (!fullTranscript && !audioBlob) return

    if (onAudioReady && audioBlob) {
      onAudioReady(audioBlob, fullTranscript)
    }

    onSendTranscript(fullTranscript)
    discardAudio()
  }

  // Controles de reprodução do áudio gravado
  const togglePlayAudio = () => {
    if (!audioElementRef.current) return

    if (isPlaying) {
      audioElementRef.current.pause()
      setIsPlaying(false)
    } else {
      audioElementRef.current.play()
      setIsPlaying(true)
    }
  }

  // Touch e Mouse Events para Pressionar e Segurar estilo WhatsApp
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isProcessing) return
    isHoldModeRef.current = true
    startXRef.current = e.clientX
    startRecording()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isRecording || !isHoldModeRef.current) return
    const diff = e.clientX - startXRef.current
    if (diff < 0) {
      setDragOffset(diff)
      if (diff < -80) {
        setIsDraggingCancel(true)
      } else {
        setIsDraggingCancel(false)
      }
    }
  }

  const handleMouseUp = () => {
    if (!isRecording) return
    if (isDraggingCancel) {
      cancelRecording()
    } else {
      stopRecording()
    }
    isHoldModeRef.current = false
  }

  // Touch handlers para mobile (arrastar para cancelar estilo WhatsApp)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isProcessing) return
    isHoldModeRef.current = true
    startXRef.current = e.touches[0].clientX
    startRecording()
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isRecording) return
    const currentX = e.touches[0].clientX
    const diff = currentX - startXRef.current
    if (diff < 0) {
      setDragOffset(diff)
      if (diff < -80) {
        setIsDraggingCancel(true)
      } else {
        setIsDraggingCancel(false)
      }
    }
  }

  const handleTouchEnd = () => {
    if (!isRecording) return
    if (isDraggingCancel) {
      cancelRecording()
    } else {
      stopRecording()
    }
    isHoldModeRef.current = false
  }

  // Modo alternativo de clique simples (toque para iniciar, clique para parar)
  const handleClickToggle = () => {
    if (isProcessing) return
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const currentTranscriptText = `${finalTranscript} ${liveTranscript}`.trim()

  return (
    <div
      className={cn(
        'relative rounded-2xl transition-all duration-300',
        compact
          ? 'p-2 bg-slate-50 border border-slate-200'
          : 'p-4 bg-white border border-slate-200 shadow-sm',
        className,
      )}
    >
      {/* Elemento de áudio invisível para reprodução */}
      {audioUrl && (
        <audio
          ref={audioElementRef}
          src={audioUrl}
          onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
          onEnded={() => {
            setIsPlaying(false)
            setPlaybackTime(0)
          }}
        />
      )}
      {/* ESTADO 1: GRAVANDO (MODO WHATSAPP) */}
      {isRecording && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-red-50/90 border border-red-200 rounded-xl text-red-900 animate-pulse-subtle">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Ícone de microfone piscando */}
            <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-red-600 text-white shadow-md animate-pulse">
              <Mic className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-ping" />
            </div>

            {/* Contador de tempo da gravação */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-red-700 tabular-nums">
                {formatSeconds(recordDuration)}
              </span>
              <span className="text-xs text-red-600 font-medium hidden sm:inline">
                Gravando áudio...
              </span>
            </div>

            {/* Ondas sonoras animadas */}
            <div className="flex items-center gap-1 h-5 px-2">
              <span className="w-1 bg-red-500 rounded-full animate-[wave_0.8s_ease-in-out_infinite] h-2" />
              <span className="w-1 bg-red-600 rounded-full animate-[wave_1.1s_ease-in-out_infinite] h-4" />
              <span className="w-1 bg-red-500 rounded-full animate-[wave_0.7s_ease-in-out_infinite] h-5" />
              <span className="w-1 bg-red-700 rounded-full animate-[wave_1.3s_ease-in-out_infinite] h-3" />
              <span className="w-1 bg-red-500 rounded-full animate-[wave_0.9s_ease-in-out_infinite] h-4" />
            </div>
          </div>

          {/* Arrastar para cancelar ou botão direto de cancelar / parar */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div
              className={cn(
                'text-xs font-semibold px-2 py-1 rounded transition-all',
                isDraggingCancel ? 'bg-red-200 text-red-900 font-bold scale-105' : 'text-slate-500',
              )}
              style={{
                transform: `translateX(${Math.min(0, Math.max(-100, dragOffset))}px)`,
              }}
            >
              {isDraggingCancel ? 'Solte para cancelar' : '< Deslize ou cancele'}
            </div>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={cancelRecording}
              className="h-8 text-xs text-red-700 hover:text-red-800 hover:bg-red-100/70"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Cancelar
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={stopRecording}
              className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow"
            >
              <Square className="w-3.5 h-3.5 mr-1 fill-current" />
              Concluir
            </Button>
          </div>
        </div>
      )}
      {/* ESTADO 2: ÁUDIO GRAVADO PRONTO PARA REVISÃO/ENVIO (ESTILO WHATSAPP) */}
      {!isRecording && audioUrl && (
        <div className="space-y-3 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Botão Play / Pause */}
              <button
                type="button"
                onClick={togglePlayAudio}
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow transition-transform active:scale-95"
                title={isPlaying ? 'Pausar áudio' : 'Ouvir áudio gravado'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                )}
              </button>

              {/* Barra de progresso e duração */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-900">Áudio de voz gravado</span>
                  <span className="text-xs font-mono text-emerald-700 tabular-nums">
                    {formatSeconds(isPlaying ? playbackTime : audioDuration)}
                  </span>
                </div>
                {/* Linha de onda simulada do WhatsApp */}
                <div className="flex items-center gap-0.5 h-3">
                  {[40, 70, 30, 90, 60, 100, 45, 80, 50, 75, 35, 95, 60, 40].map((h, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-1 rounded-full transition-colors',
                        isPlaying && (playbackTime / (audioDuration || 1)) * 14 > i
                          ? 'bg-emerald-700'
                          : 'bg-emerald-300',
                      )}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Ações: Descartar / Regravar / Enviar para a IA */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={discardAudio}
                className="h-8 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100/70"
                title="Descartar e regravar"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Regravar
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={isProcessing}
                onClick={handleSendToAI}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Enviar para a IA
              </Button>
            </div>
          </div>

          {/* Exibição da transcrição bruta capturada */}
          {currentTranscriptText && (
            <div className="pt-2 border-t border-emerald-200/60">
              <div className="flex items-center justify-between text-[11px] text-emerald-800 mb-1">
                <span className="font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Transcrição detectada:
                </span>
                <span className="text-slate-500 text-[10px]">
                  (A IA irá corrigir gírias, sotaques e pontuação)
                </span>
              </div>
              <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-lg border border-emerald-100 italic">
                &ldquo;{currentTranscriptText}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}
      {/* ESTADO 3: PARADO (BOTÃO PRINCIPAL ESTILO WHATSAPP) */}
      {!isRecording && !audioUrl && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Instrução visual */}
          <div className="flex items-center gap-2.5 text-slate-600 text-xs">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 leading-tight">
                Áudio estilo WhatsApp com IA
              </p>
              <p className="text-[11px] text-slate-500">{placeholder}</p>
            </div>
          </div>

          {/* Botão de Gravação de Áudio */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={handleClickToggle}
                    className={cn(
                      'relative group px-4 py-2 rounded-xl text-white font-medium text-xs flex items-center gap-2 shadow-sm transition-all',
                      'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95',
                      isProcessing && 'opacity-60 cursor-not-allowed',
                    )}
                    aria-label="Gravar áudio com IA"
                  >
                    <Mic className="w-4 h-4 text-white animate-bounce-subtle" />
                    <span>Gravar Áudio</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">
                    {speechSupported
                      ? 'Pressione e segure (ou dê um clique) para falar'
                      : 'Navegador com suporte de áudio parcial'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}
      {/* Informação sobre tolerância a erros e sotaques */}
      {!isRecording && !audioUrl && !compact && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>
              Fale naturalmente: a IA entende sotaques regionais, erros de grafia, concordância e
              gírias de negócios.
            </span>
          </div>
          <Link
            to="/audios"
            className="text-emerald-700 font-semibold hover:underline shrink-0 hidden sm:inline"
          >
            Ver histórico de áudios &rarr;
          </Link>
        </div>
      )}{' '}
    </div>
  )
}
export default VoiceRecorder
