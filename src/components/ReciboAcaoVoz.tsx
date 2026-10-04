import React from 'react'
import {
  RotateCcw,
  Pencil,
  CheckCircle2,
  Clock,
  User,
  FileText,
  RefreshCw,
  Loader2,
  AlertTriangle,
  History,
} from 'lucide-react'
import { AcaoVozRegistro } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

export interface ReciboAcaoVozProps {
  acao: AcaoVozRegistro
  onDesfazer: (acao: AcaoVozRegistro) => Promise<void>
  onEditar?: (acao: AcaoVozRegistro) => void
  isUndoing?: boolean
  showBadge?: boolean
  compact?: boolean
}

export function formatarTempoRelativo(isoDate: string): string {
  try {
    const agora = Date.now()
    const passado = new Date(isoDate).getTime()
    const diffMs = Math.max(0, agora - passado)
    const diffMinutos = Math.floor(diffMs / (60 * 1000))
    const diffHoras = Math.floor(diffMs / (60 * 60 * 1000))

    if (diffMinutos < 1) return 'há instantes'
    if (diffMinutos === 1) return 'há 1 minuto'
    if (diffMinutos < 60) return `há ${diffMinutos} minutos`
    if (diffHoras === 1) return 'há 1 hora'
    return `há ${diffHoras} horas`
  } catch {
    return 'recentemente'
  }
}

export function ReciboAcaoVoz({
  acao,
  onDesfazer,
  onEditar,
  isUndoing = false,
  showBadge = true,
  compact = false,
}: ReciboAcaoVozProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const isDesfeito = acao.status === 'desfeito'

  const getIcon = () => {
    switch (acao.tipo_acao) {
      case 'criacao_cliente':
        return <User className="w-4 h-4 text-purple-600" />
      case 'criacao_orcamento':
        return <FileText className="w-4 h-4 text-blue-600" />
      case 'mudanca_status':
        return <RefreshCw className="w-4 h-4 text-amber-600" />
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />
    }
  }

  const getTipoLabel = () => {
    switch (acao.tipo_acao) {
      case 'criacao_cliente':
        return 'Cliente Cadastrado'
      case 'criacao_orcamento':
        return 'Orçamento Criado'
      case 'mudanca_status':
        return 'Status Alterado'
      default:
        return 'Ação de Voz'
    }
  }

  const handleConfirmDesfazer = async () => {
    setConfirmOpen(false)
    await onDesfazer(acao)
  }

  return (
    <>
      <div
        className={`rounded-2xl border transition-all ${
          isDesfeito
            ? 'bg-slate-50/80 border-slate-200 text-slate-500 opacity-75'
            : 'bg-emerald-50/50 border-emerald-200 shadow-sm hover:shadow-md'
        } ${compact ? 'p-3' : 'p-4 sm:p-5'}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          {/* LADO ESQUERDO: ÍCONE, TÍTULO, DESCRIÇÃO E TEMPO */}
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isDesfeito
                  ? 'bg-slate-200 text-slate-500'
                  : 'bg-white shadow-sm border border-emerald-200'
              }`}
            >
              {getIcon()}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4
                  className={`text-sm font-bold ${
                    isDesfeito ? 'text-slate-600 line-through' : 'text-slate-900'
                  }`}
                >
                  {acao.titulo}
                </h4>

                {showBadge && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-bold py-0.5 px-2 ${
                      isDesfeito
                        ? 'bg-slate-100 text-slate-500 border-slate-300'
                        : 'bg-emerald-100/80 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {isDesfeito ? 'Desfeito' : getTipoLabel()}
                  </Badge>
                )}
              </div>

              {acao.descricao_resumo && (
                <p className="text-xs text-slate-600 leading-relaxed">{acao.descricao_resumo}</p>
              )}

              <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatarTempoRelativo(acao.created)}
                </span>
                <span>• Válido por 24h</span>
                {isDesfeito && acao.desfeito_em && (
                  <span className="text-amber-700 font-medium">
                    (Revertido {formatarTempoRelativo(acao.desfeito_em)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* LADO DIREITO: BOTÕES "EDITAR" E "DESFAZER" */}
          {!isDesfeito && (
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-1 sm:pt-0">
              {onEditar && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onEditar(acao)}
                  disabled={isUndoing}
                  className="h-8 text-xs border-slate-300 hover:bg-slate-100 text-slate-700 font-medium"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Editar
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                disabled={isUndoing}
                className="h-8 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-semibold"
              >
                {isUndoing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Desfazendo...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Desfazer
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMAÇÃO PARA DESFAZER */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[420px] rounded-2xl bg-white text-slate-900 p-6">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Desfazer esta ação da IA?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>
                Você está prestes a reverter: <strong>&ldquo;{acao.titulo}&rdquo;</strong>.
              </p>
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                {acao.tipo_acao === 'criacao_cliente' &&
                  'O cliente criado por voz será excluído da base.'}
                {acao.tipo_acao === 'criacao_orcamento' &&
                  'O orçamento gerado por voz será excluído do sistema.'}
                {acao.tipo_acao === 'mudanca_status' && 'O orçamento retornará ao status anterior.'}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="h-9 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDesfazer}
              className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              Sim, Desfazer Ação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
