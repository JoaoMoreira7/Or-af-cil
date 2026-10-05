import React, { useState } from 'react'
import {
  CreditCard,
  QrCode,
  Barcode,
  Check,
  CheckCircle2,
  Copy,
  AlertCircle,
  Loader2,
  Calendar,
  Sparkles,
  ShieldCheck,
  Lock,
  ArrowRight,
  Clock,
  RefreshCw,
  Info,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { formatarData } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { PLANO_CONFIG } from '@/config/plans'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function Planos() {
  const { user } = useAuth()
  const { toast } = useToast()
  const {
    plano,
    loading: loadingSub,
    isBloqueado,
    isTrial,
    isAtivo,
    diasRestantesTrial,
    simularFimDeTeste,
    restaurarTesteDemo,
    assinarPlanoSimulado,
  } = useSubscription()

  // Modal Assinatura / Pagamento
  const [modalOpen, setModalOpen] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState<'pix' | 'cartao' | 'boleto'>('pix')
  const [processingPayment, setProcessingPayment] = useState(false)
  const [pixCopiado, setPixCopiado] = useState(false)
  const [boletoCopiado, setBoletoCopiado] = useState(false)

  // Campos Cartão
  const [cardNome, setCardNome] = useState('')
  const [cardNumero, setCardNumero] = useState('')
  const [cardValidade, setCardValidade] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({})

  // Códigos fictícios
  const fakePixCode =
    '00020126580014br.gov.bcb.pix0136orcafacil-simulacao-homologacao-2026520400005303986540549.905802BR5920ORCAFACIL SAAS LTDA6009SAO PAULO62140510ORCFAC49906304F2B8'

  const fakeBoletoLinha = '34191.79001 01043.510047 91020.150008 5 94520000004990'

  const handleOpenCheckout = () => {
    setCardNome(user?.name || '')
    setCardNumero('')
    setCardValidade('')
    setCardCvv('')
    setCardErrors({})
    setPixCopiado(false)
    setBoletoCopiado(false)
    setModalOpen(true)
  }

  // Validação Luhn simples para Cartão
  const checkLuhn = (num: string): boolean => {
    let sum = 0
    let shouldDouble = false
    for (let i = num.length - 1; i >= 0; i--) {
      let digit = parseInt(num.charAt(i), 10)
      if (shouldDouble) {
        digit *= 2
        if (digit > 9) digit -= 9
      }
      sum += digit
      shouldDouble = !shouldDouble
    }
    return sum % 10 === 0
  }

  // Format Card Number (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16)
    const parts = raw.match(/[\s\S]{1,4}/g) || []
    setCardNumero(parts.join(' '))
    if (cardErrors.cardNumero) setCardErrors((prev) => ({ ...prev, cardNumero: '' }))
  }

  // Format Expiry (MM/AA)
  const handleValidadeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (raw.length >= 3) {
      setCardValidade(`${raw.slice(0, 2)}/${raw.slice(2, 4)}`)
    } else {
      setCardValidade(raw)
    }
    if (cardErrors.cardValidade) setCardErrors((prev) => ({ ...prev, cardValidade: '' }))
  }

  // Format CVV (3 ou 4 dígitos)
  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    setCardCvv(raw)
    if (cardErrors.cardCvv) setCardErrors((prev) => ({ ...prev, cardCvv: '' }))
  }

  const validateCardForm = () => {
    const errs: Record<string, string> = {}
    if (!cardNome.trim()) errs.cardNome = 'Informe o nome completo impresso no cartão.'
    const digitsOnly = cardNumero.replace(/\D/g, '')
    if (digitsOnly.length !== 16) {
      errs.cardNumero = 'O número do cartão deve conter exatamente 16 dígitos.'
    } else if (!checkLuhn(digitsOnly)) {
      errs.cardNumero = 'Número de cartão inválido (verificação de dígitos falhou).'
    }

    if (cardValidade.length !== 5) {
      errs.cardValidade = 'Informe a validade no formato MM/AA.'
    } else {
      const [mesStr, anoStr] = cardValidade.split('/')
      const mes = parseInt(mesStr, 10)
      if (mes < 1 || mes > 12) {
        errs.cardValidade = 'Mês inválido (01 a 12).'
      }
    }

    if (cardCvv.length < 3) errs.cardCvv = 'CVV deve ter pelo menos 3 dígitos.'

    setCardErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Confirmar pagamento simulado
  const handleConfirmarPagamento = async (metodo: 'pix' | 'cartao' | 'boleto') => {
    if (metodo === 'cartao' && !validateCardForm()) return

    setProcessingPayment(true)

    try {
      // Simula tempo de processamento
      await new Promise((resolve) => setTimeout(resolve, 1200))
      await assinarPlanoSimulado()

      setModalOpen(false)
      const labelMetodo =
        metodo === 'pix' ? 'via PIX' : metodo === 'cartao' ? 'no Cartão de Crédito' : 'via Boleto'

      toast({
        title: 'Pagamento simulado aprovado com sucesso!',
        description: `Seu plano ${PLANO_CONFIG.nome} (${PLANO_CONFIG.precoMensalExtenso}) foi ativado ${labelMetodo}. Acesso 100% liberado por +30 dias!`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar simulação de pagamento'
      toast({
        variant: 'destructive',
        title: 'Erro no pagamento',
        description: msg,
      })
    } finally {
      setProcessingPayment(false)
    }
  }

  const handleCopiarPix = () => {
    navigator.clipboard.writeText(fakePixCode)
    setPixCopiado(true)
    toast({
      title: 'Código PIX copiado!',
      description: 'Código copia-e-cola simulado transferido para a área de transferência.',
    })
    setTimeout(() => setPixCopiado(false), 3000)
  }

  const handleCopiarBoleto = () => {
    navigator.clipboard.writeText(fakeBoletoLinha)
    setBoletoCopiado(true)
    toast({
      title: 'Linha digitável copiada!',
      description: 'Código de barras do boleto transferido para a área de transferência.',
    })
    setTimeout(() => setBoletoCopiado(false), 3000)
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* HEADER DA PÁGINA */}
      <div className="pb-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Plano e Assinatura</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Acesso completo e irrestrito ao gerador de orçamentos com Inteligência Artificial e gestão
          de clientes.
        </p>
      </div>

      {/* AVISO DO MODO DEMONSTRAÇÃO / SIMULAÇÃO */}
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <span className="font-bold text-amber-950">Ambiente de Demonstração & Homologação</span>
            <p className="text-xs text-amber-800 mt-0.5">
              Todas as formas de pagamento (PIX, Cartão e Boleto) são 100% simuladas. Nenhum valor
              real será debitado.
            </p>
          </div>
        </div>

        {/* FERRAMENTAS DO AVALIADOR / SIMULADOR DE FIM DE TESTE */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200/60">
          <button
            type="button"
            disabled={loadingSub}
            onClick={async () => {
              await simularFimDeTeste()
              toast({
                title: 'Simulação: Fim de Teste ativado',
                description:
                  'O status agora é "expirado". Navegue pelo menu para testar a tela de bloqueio (paywall).',
              })
            }}
            className="text-xs bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            title="Força o status para expirado para você testar a tela de bloqueio"
          >
            <Lock className="w-3.5 h-3.5" />
            Simular fim do período de teste
          </button>

          <button
            type="button"
            disabled={loadingSub}
            onClick={async () => {
              await restaurarTesteDemo(3)
              toast({
                title: 'Teste grátis restaurado',
                description: 'Conta configurada com 3 dias restantes de teste grátis.',
              })
            }}
            className="text-xs bg-white hover:bg-slate-50 active:scale-95 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 transition-all flex items-center gap-1 shadow-sm"
            title="Restaura 3 dias de teste para a conta demo"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            Restaurar 3 dias (Demo)
          </button>
        </div>
      </div>

      {/* CARD DE STATUS ATUAL DA CONTA */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                Status da sua assinatura
              </span>

              {isAtivo && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Plano Ativo
                </span>
              )}

              {isTrial && !isBloqueado && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Teste Grátis: {diasRestantesTrial}{' '}
                  {diasRestantesTrial === 1 ? 'dia restante' : 'dias restantes'}
                </span>
              )}

              {isBloqueado && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Teste Expirado / Bloqueado
                </span>
              )}
            </div>

            <h3 className="text-2xl font-extrabold text-white">Plano Starter</h3>

            <p className="text-xs text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {isAtivo ? (
                <span>
                  Renovação prevista em:{' '}
                  <strong>
                    {plano?.renovacao_em ? formatarData(plano.renovacao_em) : '30 dias'}
                  </strong>
                </span>
              ) : isTrial && !isBloqueado ? (
                <span>
                  Teste grátis válido até:{' '}
                  <strong>{plano?.trial_ate ? formatarData(plano.trial_ate) : '7 dias'}</strong> (
                  {diasRestantesTrial} {diasRestantesTrial === 1 ? 'dia' : 'dias'} restante(s))
                </span>
              ) : (
                <span className="text-rose-300 font-medium">
                  Seu teste expirou. Contrate o plano por {PLANO_CONFIG.precoMensalExtenso} para
                  desbloquear o sistema.
                </span>
              )}
            </p>
          </div>

          <div className="sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            <span className="text-3xl font-extrabold tabular-nums text-white">
              {PLANO_CONFIG.precoFormatado}
            </span>
            <span className="text-xs text-slate-400 ml-1">/mês</span>
            <p className="text-[11px] text-blue-200 mt-1">Cobrança mensal simulada</p>
          </div>
        </div>
      </div>

      {/* PLANO ÚNICO: R$ 49,90/mês (STARTER) */}
      <div className="max-w-xl mx-auto">
        <div className="relative bg-white rounded-3xl border-2 border-blue-600 p-6 sm:p-8 shadow-xl">
          {/* Badge de Destaque */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="px-4 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-md flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Plano Único Completo
            </span>
          </div>

          <div className="text-center pt-2">
            <h4 className="text-2xl font-bold text-slate-900">Plano {PLANO_CONFIG.nome}</h4>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Tudo o que você precisa para emitir propostas impecáveis e fechar negócios.
            </p>

            <div className="my-6">
              <span className="text-5xl font-extrabold text-slate-900 tabular-nums">
                {PLANO_CONFIG.precoFormatado}
              </span>
              <span className="text-sm font-medium text-slate-500 ml-1">/mês</span>
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                7 dias de teste grátis inclusos no cadastro
              </p>
            </div>
          </div>

          {/* Vantagens e Recursos */}
          <div className="space-y-3 pt-2 pb-6 border-t border-slate-100">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              O que está incluso:
            </p>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-700">
              {[
                'Criação de orçamentos e propostas comerciais completas',
                'Assistente de IA integrado para detalhar serviços e preços',
                'Comando de voz para geração rápida de orçamentos',
                'Cadastro ilimitado de clientes com histórico',
                'Exportação em PDF pronta para impressão',
                'Envio direto do orçamento para o WhatsApp do cliente',
                'Formas de pagamento: PIX instantâneo, Cartão e Boleto',
                'Suporte técnico e atualizações contínuas',
              ].map((feat, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className="leading-snug">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Botão de Contratação / Ação */}
          <Button
            size="lg"
            onClick={handleOpenCheckout}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 text-white font-bold text-base shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all"
          >
            {isAtivo ? (
              <span className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-300" />
                Renovar ou Alterar Pagamento ({PLANO_CONFIG.precoFormatado})
              </span>
            ) : isBloqueado ? (
              <span className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-300" />
                Desbloquear Acesso por {PLANO_CONFIG.precoMensalExtenso}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>Contratar Plano por {PLANO_CONFIG.precoMensalExtenso}</span>
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>

          <p className="text-[11px] text-center text-slate-400 mt-3 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            Pagamento simulado seguro com ativação imediata
          </p>
        </div>
      </div>

      {/* MODAL DE CHECKOUT COM AS 3 FORMAS DE PAGAMENTO SIMULADAS */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[540px] rounded-3xl bg-white text-slate-900 p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Contratar Plano {PLANO_CONFIG.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Valor da assinatura:{' '}
              <strong className="text-slate-900 text-sm">
                {PLANO_CONFIG.precoFormatado} / mês
              </strong>
            </DialogDescription>
          </DialogHeader>

          {/* AVISO DO AMBIENTE SIMULADO NO MODAL */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 my-1">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Ambiente de Demonstração Homologado:</span>
              <p className="mt-0.5 text-[11px] text-amber-800 leading-relaxed">
                Nenhuma cobrança bancária real será realizada. Escolha uma forma abaixo e clique em
                confirmar para ativar o plano imediatamente.
              </p>
            </div>
          </div>

          {/* SELETOR DE FORMAS DE PAGAMENTO */}
          <Tabs
            value={formaPagamento}
            onValueChange={(val) => setFormaPagamento(val as 'pix' | 'cartao' | 'boleto')}
            className="w-full mt-2"
          >
            <TabsList className="grid grid-cols-3 w-full bg-slate-100 p-1 rounded-xl h-11">
              <TabsTrigger
                value="pix"
                className="text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4" />
                PIX
              </TabsTrigger>
              <TabsTrigger
                value="cartao"
                className="text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm flex items-center gap-1.5"
              >
                <CreditCard className="w-4 h-4" />
                Cartão
              </TabsTrigger>
              <TabsTrigger
                value="boleto"
                className="text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm flex items-center gap-1.5"
              >
                <Barcode className="w-4 h-4" />
                Boleto
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: PIX */}
            <TabsContent value="pix" className="space-y-4 pt-4">
              <div className="text-center p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-500 mb-2">
                  Escaneie o QR Code simulado com seu app de banco:
                </span>

                {/* QR Code SVG Fictício em Alta Fidelidade */}
                <div className="w-48 h-48 bg-white p-3 rounded-2xl border border-slate-300 shadow-inner flex items-center justify-center my-1 relative">
                  <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full text-slate-900"
                    fill="currentColor"
                  >
                    {/* Cantos superiores e inferior esquerdo do QR Code */}
                    <rect x="5" y="5" width="26" height="26" rx="2" fill="#0F172A" />
                    <rect x="9" y="9" width="18" height="18" fill="white" />
                    <rect x="13" y="13" width="10" height="10" fill="#2563EB" />

                    <rect x="69" y="5" width="26" height="26" rx="2" fill="#0F172A" />
                    <rect x="73" y="9" width="18" height="18" fill="white" />
                    <rect x="77" y="13" width="10" height="10" fill="#2563EB" />

                    <rect x="5" y="69" width="26" height="26" rx="2" fill="#0F172A" />
                    <rect x="9" y="73" width="18" height="18" fill="white" />
                    <rect x="13" y="77" width="10" height="10" fill="#2563EB" />

                    {/* Padrões internos do QR */}
                    <rect x="36" y="8" width="6" height="6" fill="#0F172A" />
                    <rect x="46" y="8" width="6" height="12" fill="#0F172A" />
                    <rect x="56" y="14" width="8" height="6" fill="#0F172A" />
                    <rect x="36" y="24" width="16" height="6" fill="#0F172A" />
                    <rect x="8" y="36" width="6" height="16" fill="#0F172A" />
                    <rect x="20" y="42" width="10" height="6" fill="#0F172A" />
                    <rect x="36" y="36" width="8" height="8" fill="#2563EB" />
                    <rect x="48" y="40" width="14" height="6" fill="#0F172A" />
                    <rect x="68" y="36" width="10" height="10" fill="#0F172A" />
                    <rect x="84" y="42" width="8" height="14" fill="#0F172A" />
                    <rect x="36" y="52" width="12" height="6" fill="#0F172A" />
                    <rect x="54" y="52" width="8" height="16" fill="#0F172A" />
                    <rect x="68" y="54" width="16" height="6" fill="#0F172A" />
                    <rect x="36" y="68" width="6" height="14" fill="#0F172A" />
                    <rect x="48" y="74" width="14" height="6" fill="#0F172A" />
                    <rect x="68" y="68" width="8" height="14" fill="#0F172A" />
                    <rect x="80" y="74" width="12" height="14" fill="#0F172A" />
                  </svg>
                </div>

                <span className="text-[11px] text-slate-500 mt-2 font-mono">
                  Valor: <strong>{PLANO_CONFIG.precoFormatado}</strong> • Beneficiário: OrçaFácil
                  Ltda
                </span>
              </div>

              {/* Código Copia e Cola */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Ou copie o código PIX Copia e Cola:
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={fakePixCode}
                    className="text-[11px] font-mono bg-slate-50 h-9 truncate text-slate-600"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopiarPix}
                    className="h-9 px-3 text-xs shrink-0 font-medium"
                  >
                    {pixCopiado ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 mr-1" />
                    )}
                    {pixCopiado ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                disabled={processingPayment}
                onClick={() => handleConfirmarPagamento('pix')}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.99] mt-2"
              >
                {processingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando PIX simulado...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Já paguei / Confirmar pagamento
                  </>
                )}
              </Button>
            </TabsContent>

            {/* ABA 2: CARTÃO DE CRÉDITO */}
            <TabsContent value="cartao" className="space-y-3.5 pt-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleConfirmarPagamento('cartao')
                }}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <Label htmlFor="card-nome" className="text-xs font-semibold text-slate-700">
                    Nome impresso no cartão
                  </Label>
                  <Input
                    id="card-nome"
                    value={cardNome}
                    onChange={(e) => {
                      setCardNome(e.target.value.toUpperCase())
                      if (cardErrors.cardNome) setCardErrors((prev) => ({ ...prev, cardNome: '' }))
                    }}
                    placeholder="Ex: JOAO CARLOS SILVA"
                    className={`h-9 text-xs uppercase ${cardErrors.cardNome ? 'border-red-500' : ''}`}
                  />
                  {cardErrors.cardNome && (
                    <p className="text-[11px] text-red-600">{cardErrors.cardNome}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="card-numero" className="text-xs font-semibold text-slate-700">
                    Número do cartão
                  </Label>
                  <Input
                    id="card-numero"
                    value={cardNumero}
                    onChange={handleCardNumberChange}
                    placeholder="4532 0150 0000 1234"
                    className={`h-9 text-xs tabular-nums ${cardErrors.cardNumero ? 'border-red-500' : ''}`}
                  />
                  {cardErrors.cardNumero && (
                    <p className="text-[11px] text-red-600">{cardErrors.cardNumero}</p>
                  )}
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
                      className={`h-9 text-xs tabular-nums ${cardErrors.cardValidade ? 'border-red-500' : ''}`}
                    />
                    {cardErrors.cardValidade && (
                      <p className="text-[11px] text-red-600">{cardErrors.cardValidade}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="card-cvv" className="text-xs font-semibold text-slate-700">
                      CVV / Código de segurança
                    </Label>
                    <Input
                      id="card-cvv"
                      value={cardCvv}
                      onChange={handleCvvChange}
                      placeholder="123"
                      className={`h-9 text-xs tabular-nums ${cardErrors.cardCvv ? 'border-red-500' : ''}`}
                    />
                    {cardErrors.cardCvv && (
                      <p className="text-[11px] text-red-600">{cardErrors.cardCvv}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={processingPayment}
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.99] mt-3"
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando pagamento simulado...
                    </>
                  ) : (
                    `Confirmar Pagamento no Cartão (${PLANO_CONFIG.precoFormatado})`
                  )}
                </Button>{' '}
              </form>
            </TabsContent>

            {/* ABA 3: BOLETO BANCÁRIO */}
            <TabsContent value="boleto" className="space-y-4 pt-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-5 h-5 text-slate-700" />
                    <span className="text-xs font-bold text-slate-800">
                      Boleto Bancário Simulado
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900">
                    {PLANO_CONFIG.precoFormatado}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 block">Linha Digitável:</span>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={fakeBoletoLinha}
                      className="text-[11px] font-mono bg-white h-9 truncate text-slate-700"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopiarBoleto}
                      className="h-9 px-3 text-xs shrink-0 font-medium"
                    >
                      {boletoCopiado ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 mr-1" />
                      )}
                      {boletoCopiado ? 'Copiado!' : 'Copiar'}
                    </Button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/60 text-[11px] text-blue-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    Na prática bancária, a compensação de boletos pode levar até 3 dias úteis. No
                    entanto, para permitir seu teste imediato na plataforma, você pode confirmar a
                    compensação simulada agora mesmo clicando no botão abaixo!
                  </p>
                </div>
              </div>

              <Button
                type="button"
                disabled={processingPayment}
                onClick={() => handleConfirmarPagamento('boleto')}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.99]"
              >
                {processingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Confirmando boleto simulado...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
                    Confirmar Compensação Imediata do Boleto
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
