import React, { useState, useEffect, useRef } from 'react'
import {
  QrCode,
  Copy,
  Check,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  DollarSign,
  Send,
  Loader2,
} from 'lucide-react'
import { Cobranca, formatarMoedaBRL, formatarDataHora } from '@/types'
import { cobrancasService } from '@/services/cobrancas'
import { COMPANY_LEGAL } from '@/config/company'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  sanitizarPixPayload,
  normalizarOuRepararPixPayload,
  validarPixPayload,
} from '@/lib/pixUtils'

export interface ModalCobrancaSimuladaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cobranca: Cobranca | null
  clienteTelefone?: string
  onStatusChange?: (novaCobranca: Cobranca) => void
}

export function ModalCobrancaSimulada({
  open,
  onOpenChange,
  cobranca,
  clienteTelefone,
  onStatusChange,
}: ModalCobrancaSimuladaProps) {
  const { toast } = useToast()
  const [copiado, setCopiado] = useState(false)
  const [atualizandoStatus, setAtualizandoStatus] = useState(false)
  const isMountedRef = useRef(true)
  const timerCopiadoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timerCopiadoRef.current) {
        clearTimeout(timerCopiadoRef.current)
      }
    }
  }, [])

  if (!cobranca) return null

  const isPago = cobranca.status === 'pago'
  const rawCodigoPix = cobranca.codigo_pix || ''
  const normalizado = normalizarOuRepararPixPayload(rawCodigoPix)
  const codigoPix = normalizado.payload || sanitizarPixPayload(rawCodigoPix)
  const validacao = validarPixPayload(codigoPix)

  const handleCopiarPix = async () => {
    if (!codigoPix) return

    let copiou = false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(codigoPix)
          copiou = true
        } catch {
          /* intentionally ignored */
        }
      }

      if (!copiou) {
        const textarea = document.createElement('textarea')
        textarea.value = codigoPix
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.top = '0'
        textarea.style.left = '0'
        textarea.style.width = '2em'
        textarea.style.height = '2em'
        textarea.style.padding = '0'
        textarea.style.border = 'none'
        textarea.style.outline = 'none'
        textarea.style.boxShadow = 'none'
        textarea.style.background = 'transparent'
        textarea.style.opacity = '0'
        textarea.style.zIndex = '-9999'

        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        textarea.setSelectionRange(0, textarea.value.length)
        copiou = document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      if (isMountedRef.current && copiou) {
        setCopiado(true)
        toast({
          title: 'PIX Copia e Cola copiado!',
          description:
            'Código de pagamento simulado transferido para a área de transferência (sem espaços ou quebras).',
        })
        if (timerCopiadoRef.current) clearTimeout(timerCopiadoRef.current)
        timerCopiadoRef.current = setTimeout(() => {
          if (isMountedRef.current) setCopiado(false)
        }, 3000)
      }
    } catch (_) {
      toast({
        title: 'Erro ao copiar',
        description: 'Selecione o código no campo e copie manualmente.',
        variant: 'destructive',
      })
    }
  }

  const handleEnviarWhatsApp = () => {
    const telLimpo = (clienteTelefone || '').replace(/\D/g, '')
    const msg =
      `Olá, *${cobranca.cliente_nome}*! Segue a chave PIX para pagamento do orçamento *${cobranca.orcamento_numero}* da *${COMPANY_LEGAL.nomeFantasia}*:\n\n` +
      `*Valor:* ${formatarMoedaBRL(cobranca.valor)}\n` +
      `*PIX Copia e Cola:*\n\`\`\`${codigoPix}\`\`\`\n\n` +
      `Assim que efetuar o pagamento simulado, nos avise para registrarmos a baixa. Obrigado!`

    const encoded = encodeURIComponent(msg)
    const url = telLimpo
      ? `https://wa.me/55${telLimpo}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`

    window.open(url, '_blank')
  }

  const handleDarBaixa = async () => {
    setAtualizandoStatus(true)
    try {
      const atualizada = await cobrancasService.marcarComoPago(cobranca.id)
      toast({
        title: 'Cobrança marcada como PAGA!',
        description: `Recebimento de ${formatarMoedaBRL(cobranca.valor)} confirmado.`,
      })
      if (onStatusChange) {
        onStatusChange(atualizada)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao registrar baixa'
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar pagamento',
        description: msg,
      })
    } finally {
      setAtualizandoStatus(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className={
                isPago
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                  : 'bg-amber-50 text-amber-700 border-amber-300 font-bold'
              }
            >
              {isPago ? 'Cobrança Paga' : 'Cobrança Pendente'}
            </Badge>

            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {cobranca.orcamento_numero}
            </span>
          </div>

          <DialogTitle className="text-xl font-bold text-slate-900 pt-1">
            Cobrança do Orçamento
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Cliente: <strong className="text-slate-800">{cobranca.cliente_nome}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* VALOR EM DESTAQUE */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-600 block">Valor a Cobrar:</span>
            <span className="text-2xl font-black text-blue-700 tabular-nums">
              {formatarMoedaBRL(cobranca.valor)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* AVISO DE AMBIENTE SIMULADO */}
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center gap-2 text-amber-900 text-[11px]">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Ambiente de Demonstração:</strong> Cobrança e PIX simulados. Não debita dinheiro
            real.
          </span>
        </div>

        {/* QR CODE E CHAVE PIX */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            {/* QR Code SVG / Visual */}
            <div className="relative p-3 bg-white rounded-xl shadow-xs border border-slate-200 mb-2">
              <QrCode className="w-28 h-28 text-slate-800" />
              {isPago && (
                <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center text-white p-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
                  <span className="text-xs font-bold">PAGO</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Chave PIX Simulada Instantânea do Orçamento
            </p>
          </div>

          {/* Copia e Cola Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-600">
                PIX Copia e Cola (Simulado)
              </label>
              {validacao.valido && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] font-bold py-0 h-4">
                  ✓ CRC16 ({validacao.crcAtual})
                </Badge>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                readOnly
                rows={2}
                value={codigoPix}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full p-2 text-xs bg-slate-100 rounded-lg border border-slate-200 text-slate-700 font-mono select-all resize-none cursor-text focus:outline-none focus:ring-1 focus:ring-emerald-500 break-all leading-tight"
                style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
                aria-label="PIX Copia e Cola Simulado"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopiarPix}
                className="self-stretch sm:self-auto sm:h-auto py-2 px-3 shrink-0 text-xs font-semibold"
              >
                {copiado ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* AÇÕES DE BAIXA E ENVIO */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            onClick={handleEnviarWhatsApp}
            className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5"
          >
            <MessageCircle className="w-4 h-4" />
            Enviar para o cliente pelo WhatsApp
          </Button>

          {!isPago ? (
            <Button
              type="button"
              variant="outline"
              disabled={atualizandoStatus}
              onClick={handleDarBaixa}
              className="w-full h-10 border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold text-xs rounded-xl"
            >
              {atualizandoStatus ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Registrando baixa...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-blue-600" />
                  Marcar como Pago (Dar Baixa Manual)
                </>
              )}
            </Button>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center text-xs text-emerald-800 font-medium flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Baixa confirmada{' '}
                {cobranca.pago_em ? `em ${formatarDataHora(cobranca.pago_em)}` : ''}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
