import React, { useState, useEffect } from 'react'
import {
  CreditCard,
  Check,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { planosService } from '@/services/planos'
import { PlanoAssinatura, formatarData } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function Planos() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [planoAtual, setPlanoAtual] = useState<PlanoAssinatura | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal Assinatura
  const [selectedPlanToSubscribe, setSelectedPlanToSubscribe] = useState<'starter' | 'pro' | null>(
    null,
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)

  // Masked form fields
  const [cardNome, setCardNome] = useState('')
  const [cardNumero, setCardNumero] = useState('')
  const [cardValidade, setCardValidade] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fetchPlano = async () => {
    if (!user?.id) return
    try {
      const p = await planosService.obterPlanoUsuario(user.id)
      setPlanoAtual(p)
    } catch (err) {
      console.error('Erro ao buscar plano:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlano()
  }, [user?.id])

  // Format Card Number (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16)
    const parts = raw.match(/[\s\S]{1,4}/g) || []
    setCardNumero(parts.join(' '))
    if (errors.cardNumero) setErrors((prev) => ({ ...prev, cardNumero: '' }))
  }

  // Format Expiry (MM/AA)
  const handleValidadeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (raw.length >= 3) {
      setCardValidade(`${raw.slice(0, 2)}/${raw.slice(2, 4)}`)
    } else {
      setCardValidade(raw)
    }
    if (errors.cardValidade) setErrors((prev) => ({ ...prev, cardValidade: '' }))
  }

  // Format CVV (3 digits)
  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 3)
    setCardCvv(raw)
    if (errors.cardCvv) setErrors((prev) => ({ ...prev, cardCvv: '' }))
  }

  const handleOpenSubscribe = (plano: 'starter' | 'pro') => {
    setSelectedPlanToSubscribe(plano)
    setCardNome(user?.name || '')
    setCardNumero('')
    setCardValidade('')
    setCardCvv('')
    setErrors({})
    setModalOpen(true)
  }

  const validateCardForm = () => {
    const errs: Record<string, string> = {}
    if (!cardNome.trim()) errs.cardNome = 'Informe o nome impresso no cartão.'
    const digitsOnly = cardNumero.replace(/\D/g, '')
    if (digitsOnly.length !== 16) errs.cardNumero = 'O número do cartão deve conter 16 dígitos.'
    if (cardValidade.length !== 5) errs.cardValidade = 'Validade inválida (MM/AA).'
    if (cardCvv.length !== 3) errs.cardCvv = 'CVV deve conter 3 dígitos.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateCardForm()) return
    if (!selectedPlanToSubscribe || !user?.id) return

    setProcessingPayment(true)

    // Simulação com delay de 1,5s
    setTimeout(async () => {
      try {
        const updated = await planosService.assinarPlano(user.id, selectedPlanToSubscribe)
        setPlanoAtual(updated)
        setProcessingPayment(false)
        setModalOpen(false)

        const planoNome =
          selectedPlanToSubscribe === 'pro' ? 'Pro (R$ 97/mês)' : 'Starter (R$ 49/mês)'
        toast({
          title: 'Pagamento simulado aprovado!',
          description: `Plano ${planoNome} ativado com sucesso em sua conta.`,
        })
      } catch (err: unknown) {
        setProcessingPayment(false)
        const msg = err instanceof Error ? err.message : 'Falha ao processar simulação de plano'
        toast({
          variant: 'destructive',
          title: 'Erro na simulação',
          description: msg,
        })
      }
    }, 1500)
  }

  const planoAtivoId = planoAtual?.plano || 'starter'

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* HEADER */}
      <div className="pb-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Planos e Assinatura</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Escolha a estrutura ideal para escalar seus orçamentos comerciais. Cobrança{' '}
          <strong className="text-amber-700">100% simulada</strong> para homologação.
        </p>
      </div>

      {/* CURRENT PLAN CARD */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                Seu plano atual
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {planoAtual?.status || 'Ativo'}
              </span>
            </div>
            <h3 className="text-2xl font-extrabold mt-1">
              Plano {planoAtivoId === 'pro' ? 'Pro' : 'Starter'}
            </h3>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Renovação prevista:{' '}
              {planoAtual?.renovacao_em ? formatarData(planoAtual.renovacao_em) : 'Em 30 dias'}
            </p>
          </div>

          <div className="sm:text-right">
            <span className="text-3xl font-extrabold tabular-nums">
              {planoAtivoId === 'pro' ? 'R$ 97' : 'R$ 49'}
            </span>
            <span className="text-xs text-slate-400">/mês</span>
            <p className="text-[11px] text-blue-200 mt-1">Ambiente de Demonstração Homologado</p>
          </div>
        </div>
      </div>

      {/* TWO PLAN CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* PLANO STARTER */}
        <div
          className={`bg-white rounded-2xl border p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:-translate-y-1 hover:shadow-md transition-all ${
            planoAtivoId === 'starter' ? 'ring-2 ring-blue-600 border-blue-600' : 'border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xl font-bold text-slate-900">Starter</h4>
              {planoAtivoId === 'starter' && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Plano Atual
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mb-5">
              Ideal para autônomos e pequenos prestadores estruturando suas propostas.
            </p>

            <div className="mb-6">
              <span className="text-4xl font-extrabold text-slate-900 tabular-nums">R$ 49</span>
              <span className="text-xs text-slate-500">/mês</span>
            </div>

            {/* Features */}
            <ul className="space-y-3 text-xs sm:text-sm text-slate-700 mb-8">
              {[
                'Até 20 orçamentos/mês',
                'Cadastro completo de clientes',
                'Assistente de IA básico',
                'Comando de voz para ditado',
                'Impressão e envio via WhatsApp',
              ].map((feat, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            onClick={() => handleOpenSubscribe('starter')}
            disabled={planoAtivoId === 'starter'}
            variant={planoAtivoId === 'starter' ? 'outline' : 'default'}
            className={`w-full h-11 font-semibold rounded-xl text-sm ${
              planoAtivoId === 'starter'
                ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {planoAtivoId === 'starter' ? (
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Plano Atual
              </span>
            ) : (
              'Migrar para Starter'
            )}
          </Button>
        </div>

        {/* PLANO PRO */}
        <div
          className={`relative bg-white rounded-2xl border p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all ${
            planoAtivoId === 'pro' ? 'ring-2 ring-violet-600 border-violet-600' : 'border-slate-200'
          }`}
        >
          {/* BADGE MAIS POPULAR */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 shadow-md flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Mais Popular
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 mt-1">
              <h4 className="text-xl font-bold text-slate-900">Pro</h4>
              {planoAtivoId === 'pro' && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  Plano Atual
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mb-5">
              Para empresas em expansão que exigem IA avançada e volume ilimitado.
            </p>

            <div className="mb-6">
              <span className="text-4xl font-extrabold text-slate-900 tabular-nums">R$ 97</span>
              <span className="text-xs text-slate-500">/mês</span>
            </div>

            {/* Features */}
            <ul className="space-y-3 text-xs sm:text-sm text-slate-700 mb-8">
              {[
                'Orçamentos ilimitados',
                'Assistente de IA avançado e prioritário',
                'Comando de voz completo sem limite',
                'Relatórios e métricas de conversão',
                'Prioridade no suporte técnico',
                'Backup contínuo de propostas',
              ].map((feat, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="font-medium text-slate-800">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            onClick={() => handleOpenSubscribe('pro')}
            disabled={planoAtivoId === 'pro'}
            className={`w-full h-11 font-semibold rounded-xl text-sm ${
              planoAtivoId === 'pro'
                ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-md'
            }`}
          >
            {planoAtivoId === 'pro' ? (
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Plano Atual
              </span>
            ) : (
              'Assinar Plano Pro'
            )}
          </Button>
        </div>
      </div>

      {/* MODAL DE ASSINATURA SIMULADA */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[460px] rounded-2xl bg-white text-slate-900 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Assinatura do Plano {selectedPlanToSubscribe === 'pro' ? 'Pro' : 'Starter'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Valor:{' '}
              <strong className="text-slate-800">
                {selectedPlanToSubscribe === 'pro' ? 'R$ 97,00/mês' : 'R$ 49,00/mês'}
              </strong>
            </DialogDescription>
          </DialogHeader>

          {/* AVISO DE COBRANÇA SIMULADA (CAIXA AMARELA) */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5 my-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Aviso de Cobrança Simulada:</span>
              <p className="mt-0.5 text-[11px] text-amber-700">
                Nenhum valor real será debitado do seu cartão. Esta é uma simulação de homologação
                para fins de demonstração da plataforma JM Sistemas.
              </p>
            </div>
          </div>

          <form onSubmit={handleSimulatePayment} className="space-y-3.5 mt-2">
            <div className="space-y-1">
              <Label htmlFor="card-nome" className="text-xs font-semibold text-slate-700">
                Nome no cartão
              </Label>
              <Input
                id="card-nome"
                value={cardNome}
                onChange={(e) => {
                  setCardNome(e.target.value.toUpperCase())
                  if (errors.cardNome) setErrors((prev) => ({ ...prev, cardNome: '' }))
                }}
                placeholder="NOME COMO NO CARTÃO"
                className={`h-9 text-xs uppercase ${errors.cardNome ? 'border-red-500' : ''}`}
              />
              {errors.cardNome && <p className="text-[11px] text-red-600">{errors.cardNome}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="card-numero" className="text-xs font-semibold text-slate-700">
                Número do cartão
              </Label>
              <Input
                id="card-numero"
                value={cardNumero}
                onChange={handleCardNumberChange}
                placeholder="0000 0000 0000 0000"
                className={`h-9 text-xs tabular-nums ${errors.cardNumero ? 'border-red-500' : ''}`}
              />
              {errors.cardNumero && <p className="text-[11px] text-red-600">{errors.cardNumero}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="card-validade" className="text-xs font-semibold text-slate-700">
                  Validade (MM/AA)
                </Label>
                <Input
                  id="card-validade"
                  value={cardValidade}
                  onChange={handleValidadeChange}
                  placeholder="12/28"
                  className={`h-9 text-xs tabular-nums ${errors.cardValidade ? 'border-red-500' : ''}`}
                />
                {errors.cardValidade && (
                  <p className="text-[11px] text-red-600">{errors.cardValidade}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="card-cvv" className="text-xs font-semibold text-slate-700">
                  CVV
                </Label>
                <Input
                  id="card-cvv"
                  value={cardCvv}
                  onChange={handleCvvChange}
                  placeholder="123"
                  className={`h-9 text-xs tabular-nums ${errors.cardCvv ? 'border-red-500' : ''}`}
                />
                {errors.cardCvv && <p className="text-[11px] text-red-600">{errors.cardCvv}</p>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="h-9 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={processingPayment}
                className="h-9 text-xs bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold"
              >
                {processingPayment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Confirmar Pagamento Simulado'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
