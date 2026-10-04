import React, { useState, useEffect } from 'react'
import {
  Bell,
  MessageCircle,
  X,
  Clock,
  Sparkles,
  ChevronRight,
  Send,
  AlertCircle,
} from 'lucide-react'
import { Orçamento, Cliente, formatarMoedaBRL } from '@/types'
import { COMPANY_LEGAL } from '@/config/company'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const DISMISSED_FOLLOWUPS_KEY = 'jm_followups_dispensados'

export interface FollowUpItem {
  orcamento: Orçamento
  cliente?: Cliente
  diasSemResposta: number
}

export interface FollowUpProativoProps {
  orcamentos: Orçamento[]
  clientes?: Cliente[]
  diasLimite?: number
  onDispensar?: (orcamentoId: string) => void
  compact?: boolean
}

/**
 * Calcula a quantidade de dias corridos desde uma data ISO até hoje
 */
export function calcularDiasSemResposta(dataIso: string): number {
  if (!dataIso) return 0
  try {
    const dataRef = new Date(dataIso).getTime()
    const agora = Date.now()
    const diffMs = Math.max(0, agora - dataRef)
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  } catch {
    return 0
  }
}

/**
 * Monta o texto de mensagem de lembrete cordial via WhatsApp para o cliente
 */
export function gerarMensagemLembrete(
  orcamento: Orçamento,
  cliente?: Cliente,
  diasSemResposta = 5,
): string {
  const nomeCliente = cliente?.nome || 'Olá'
  const primeiroNome = nomeCliente.split(' ')[0]
  const numeroOrc = orcamento.numero || ''
  const descricaoOrc = orcamento.descricao || 'serviço'
  const valorFormatado = formatarMoedaBRL(orcamento.valor_total)

  return (
    `Olá ${primeiroNome}, tudo bem?\n\n` +
    `Aqui é da *${COMPANY_LEGAL.nomeFantasia}*. Passando para saber se você conseguiu analisar a proposta do orçamento *${numeroOrc}* (${descricaoOrc}) no valor de *${valorFormatado}*.\n\n` +
    `Ficou com alguma dúvida técnica ou sobre prazos e condições de pagamento? Qualquer ajuste que precisar, é só me falar por aqui para alinharmos!`
  )
}

/**
 * Abre o WhatsApp com a mensagem de follow-up preenchida
 */
export function abrirWhatsAppLembrete(orcamento: Orçamento, cliente?: Cliente, dias = 5) {
  const phone = (cliente?.telefone || '').replace(/\D/g, '')
  const msg = gerarMensagemLembrete(orcamento, cliente, dias)
  const encoded = encodeURIComponent(msg)

  const url = phone ? `https://wa.me/55${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`

  window.open(url, '_blank')
}

export function FollowUpProativo({
  orcamentos,
  clientes = [],
  diasLimite = 5,
  onDispensar,
  compact = false,
}: FollowUpProativoProps) {
  // Lista de IDs dispensados persistida no localStorage
  const [dispensados, setDispensados] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(DISMISSED_FOLLOWUPS_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Mapear clientes por ID para busca rápida
  const clientesMap = React.useMemo(() => {
    const map = new Map<string, Cliente>()
    clientes.forEach((c) => map.set(c.id, c))
    return map
  }, [clientes])

  // Filtrar orçamentos com status pendente/aguardando (rascunho ou enviado) há 5+ dias
  const followUps: FollowUpItem[] = React.useMemo(() => {
    const resultado: FollowUpItem[] = []

    for (const orc of orcamentos) {
      if (dispensados.includes(orc.id)) continue

      // Status pendente / aguardando resposta: "enviado" ou "rascunho"
      const statusPendente = orc.status === 'enviado' || orc.status === 'rascunho'
      if (!statusPendente) continue

      // Data de referência: updated ou created
      const dataRef = orc.updated || orc.created
      const dias = calcularDiasSemResposta(dataRef)

      if (dias >= diasLimite) {
        const clienteAssociado =
          clientesMap.get(orc.cliente_id) || orc.expand?.cliente_id || undefined

        resultado.push({
          orcamento: orc,
          cliente: clienteAssociado,
          diasSemResposta: dias,
        })
      }
    }

    // Ordenar pelos mais antigos primeiro (maior urgência de follow-up)
    return resultado.sort((a, b) => b.diasSemResposta - a.diasSemResposta)
  }, [orcamentos, dispensados, diasLimite, clientesMap])

  const handleDispensar = (orcamentoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const novos = [...dispensados, orcamentoId]
    setDispensados(novos)
    try {
      localStorage.setItem(DISMISSED_FOLLOWUPS_KEY, JSON.stringify(novos))
    } catch {
      /* noop */
    }
    if (onDispensar) {
      onDispensar(orcamentoId)
    }
  }

  if (followUps.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/50 border border-amber-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-200/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
            <Bell className="w-4 h-4 animate-bounce-subtle" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-950">Follow-up Proativo de Orçamentos</h3>
              <Badge className="bg-amber-200 text-amber-900 border-none font-bold text-[10px] px-2 py-0.5">
                {followUps.length} {followUps.length === 1 ? 'pendente' : 'pendentes'}
              </Badge>
            </div>
            <p className="text-xs text-amber-800">
              Propostas aguardando resposta há 5 ou mais dias. Envie um lembrete no WhatsApp para
              acelerar o fechamento!
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {followUps.map((item) => {
          const { orcamento, cliente, diasSemResposta } = item
          const nomeCliente = cliente?.nome || orcamento.expand?.cliente_id?.nome || 'Cliente'
          const primeiroNome = nomeCliente.split(' ')[0]

          return (
            <div
              key={orcamento.id}
              className="bg-white rounded-xl border border-amber-200/80 p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-amber-950 text-sm">{nomeCliente}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-amber-50 text-amber-900 border-amber-300 font-semibold"
                  >
                    {orcamento.numero || '#---'}
                  </Badge>
                  <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Há {diasSemResposta} dias sem resposta
                  </span>
                </div>

                <p className="text-slate-600 line-clamp-1">
                  <strong>Serviço:</strong> {orcamento.descricao} · <strong>Total:</strong>{' '}
                  {formatarMoedaBRL(orcamento.valor_total)}
                </p>

                <p className="text-slate-700 italic text-[11px]">
                  &ldquo;O orçamento de {primeiroNome} está há {diasSemResposta} dias sem resposta —
                  quer que eu mande lembrete no WhatsApp dele?&rdquo;
                </p>
              </div>

              {/* AÇÕES: ENVIAR LEMBRETE WHATSAPP E DISPENSAR */}
              <div className="flex items-center gap-2 shrink-0 pt-1 md:pt-0 self-end md:self-center">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => abrirWhatsAppLembrete(orcamento, cliente, diasSemResposta)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 shadow-sm"
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                  Enviar lembrete
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => handleDispensar(orcamento.id, e)}
                  className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs h-8 px-2.5"
                  title="Dispensar esta sugestão"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Dispensar
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
