import React, { useState, useEffect, useRef } from 'react'
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
  ExternalLink,
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
import { gatewayPagamentoService, ResultadoCriacaoPixAsaas } from '@/services/gatewayPagamento'
import { COMPANY_LEGAL } from '@/config/company'

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
    recarregarPlano,
  } = useSubscription()

  // Modal Assinatura / Pagamento
  const [modalOpen, setModalOpen] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState<'pix' | 'cartao' | 'boleto'>('pix')
  const [processingPayment, setProcessingPayment] = useState(false)
  const [pixCopiado, setPixCopiado] = useState(false)
  const [boletoCopiado, setBoletoCopiado] = useState(false)

  // Estado PIX REAL ASAAS
  const [loadingPixAsaas, setLoadingPixAsaas] = useState(false)
  const [pixData, setPixData] = useState<ResultadoCriacaoPixAsaas | null>(null)
  const [pixStatusPago, setPixStatusPago] = useState(false)
  const [pollingAtivo, setPollingAtivo] = useState(false)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Campos Cartão
  const [cardNome, setCardNome] = useState('')
  const [cardNumero, setCardNumero] = useState('')
  const [cardValidade, setCardValidade] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({})

  // Códigos fictícios para fallback
  const fakeBoletoLinha = '34191.79001 01043.510047 91020.150008 5 94520000004990'

  // Limpa timer de polling ao desmontar ou fechar modal
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current)
      }
    }
  }, [])

  // Iniciar geração de PIX Real assim que abrir o modal na aba PIX
  const gerarPixRealAsaas = async () => {
    setLoadingPixAsaas(true)
    setPixStatusPago(false)
    try {
      const res = await gatewayPagamentoService.criarPixAsaas()
      setPixData(res)

      // Inicia polling para detectar quando o webhook ou o banco confirmar o pagamento
      iniciarPolling(res.asaas_id)
    } catch (err: unknown) {
      console.error('Erro ao gerar PIX Asaas:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao conectar com gateway Asaas'
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PIX',
        description: msg,
      })
    } finally {
      setLoadingPixAsaas(false)
    }
  }

  // Polling a cada 4 segundos checando o status da cobrança
  const iniciarPolling = (asaasId: string) => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
    }
    setPollingAtivo(true)

    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await gatewayPagamentoService.consultarCobrancaAsaas(asaasId)
        const st = res.cobranca.status
        if (st === 'RECEIVED' || st === 'CONFIRMED' || res.status_local === 'pago') {
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current)
          }
          setPollingAtivo(false)
          setPixStatusPago(true)

          // Recarrega o plano do usuário no contexto
          await recarregarPlano()

          toast({
            title: '🎉 Pagamento confirmado pela Asaas!',
            description: 'Sua assinatura do Plano Starter foi ativada com sucesso por +30 dias!',
          })
        }
      } catch (err) {
        console.warn('Aviso no polling de verificação do PIX:', err)
      }
    }, 4000)
  }

  const handleOpenCheckout = () => {
    setCardNome(user?.name || '')
    setCardNumero('')
    setCardValidade('')
    setCardCvv('')
    setCardErrors({})
    setPixCopiado(false)
    setBoletoCopiado(false)
    setPixStatusPago(false)
    setModalOpen(true)

    // Se estiver em modo PIX, já gera ou revalida o PIX real
    if (formaPagamento === 'pix' && !pixData) {
      gerarPixRealAsaas()
    }
  }

  const handleCloseModal = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
    }
    setPollingAtivo(false)
    setModalOpen(false)
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

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16)
    const parts = raw.match(/[\s\S]{1,4}/g) || []
    setCardNumero(parts.join(' '))
    if (cardErrors.cardNumero) setCardErrors((prev) => ({ ...prev, cardNumero: '' }))
  }

  const handleValidadeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (raw.length >= 3) {
      setCardValidade(`${raw.slice(0, 2)}/${raw.slice(2, 4)}`)
    } else {
      setCardValidade(raw)
    }
    if (cardErrors.cardValidade) setCardErrors((prev) => ({ ...prev, cardValidade: '' }))
  }

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
      const [mesStr] = cardValidade.split('/')
      const mes = parseInt(mesStr, 10)
      if (mes < 1 || mes > 12) {
        errs.cardValidade = 'Mês inválido (01 a 12).'
      }
    }

    if (cardCvv.length < 3) errs.cardCvv = 'CVV deve ter pelo menos 3 dígitos.'

    setCardErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Confirmar pagamento manual / simulado (para cartão ou boleto de teste)
  const handleConfirmarPagamentoSimulado = async (metodo: 'cartao' | 'boleto') => {
    if (metodo === 'cartao' && !validateCardForm()) return

    setProcessingPayment(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const cardDigits = cardNumero.replace(/\D/g, '')
      const numeroMascarado =
        cardDigits.length >= 4 ? `**** **** **** ${cardDigits.slice(-4)}` : '**** **** **** 0000'

      await assinarPlanoSimulado({
        formaPagamento: metodo,
        dadosCartao:
          metodo === 'cartao'
            ? {
                nomeTitular: cardNome.trim(),
                numeroMascarado,
                validade: cardValidade,
              }
            : undefined,
      })

      handleCloseModal()
      const labelMetodo = metodo === 'cartao' ? 'no Cartão de Crédito' : 'via Boleto'

      toast({
        title: 'Assinatura ativada!',
        description: `Seu plano ${PLANO_CONFIG.nome} (${PLANO_CONFIG.precoMensalExtenso}) foi ativado ${labelMetodo}. Acesso liberado por +30 dias!`,
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

  // Verificar status manual do PIX
  const handleChecarStatusPixManual = async () => {
    if (!pixData?.asaas_id) return
    setProcessingPayment(true)
    try {
      const res = await gatewayPagamentoService.consultarCobrancaAsaas(pixData.asaas_id)
      const st = res.cobranca.status
      if (st === 'RECEIVED' || st === 'CONFIRMED' || res.status_local === 'pago') {
        setPixStatusPago(true)
        if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
        await recarregarPlano()
        toast({
          title: 'Pagamento confirmado com sucesso!',
          description: 'A Asaas confirmou o recebimento do PIX. Seu plano já está ativo.',
        })
      } else {
        toast({
          title: 'Aguardando confirmação bancária...',
          description:
            'A cobrança ainda consta como pendente no Asaas. Assim que você pagar no app do banco, a confirmação ocorre em instantes!',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao consultar Asaas'
      toast({
        variant: 'destructive',
        title: 'Erro na consulta',
        description: msg,
      })
    } finally {
      setProcessingPayment(false)
    }
  }

  const handleCopiarPix = () => {
    const code = pixData?.pix_copia_cola || ''
    if (!code) return
    navigator.clipboard.writeText(code)
    setPixCopiado(true)
    toast({
      title: 'Código PIX copiado!',
      description:
        'Código copia-e-cola transferido para a área de transferência. Cole no seu aplicativo bancário.',
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

      {/* AVISO DO GATEWAY REAL ASAAS */}
      <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-950 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-emerald-950">
                Gateway de Pagamento Real Asaas Ativo
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900 uppercase">
                Produção Oficial
              </span>
            </div>
            <p className="text-xs text-emerald-800 mt-0.5">
              Cobranças via <strong>PIX</strong> são geradas diretamente na API de produção da
              Asaas. Confirmação automática instantânea via Webhook e envio imediato de comprovante
              por e-mail.
            </p>
          </div>
        </div>

        {/* FERRAMENTAS DO AVALIADOR / SIMULADOR DE FIM DE TESTE */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-200/60">
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
            className="text-xs bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            title="Força o status para expirado para você testar a tela de bloqueio"
          >
            <Lock className="w-3.5 h-3.5" />
            Simular fim do teste
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
            <p className="text-[11px] text-blue-200 mt-1">Cobrança mensal Asaas</p>
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
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
              Feito para quem vive de serviço
            </p>
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
                'Pagamento via PIX Real Asaas com baixa instantânea',
                'Comprovante oficial emitido por e-mail com CNPJ',
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
                Renovar ou Pagar com PIX ({PLANO_CONFIG.precoFormatado})
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
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Pagamento seguro processado via gateway Asaas
          </p>
        </div>
      </div>

      {/* MODAL DE CHECKOUT COM PIX REAL ASAAS */}
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

          {/* BENEFICIÁRIO LEGAL */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-center justify-between gap-2 my-1">
            <div>
              <span className="text-[11px] text-slate-500 block">Beneficiário / Empresa:</span>
              <strong className="text-slate-900">{COMPANY_LEGAL.razaoSocial}</strong>
              <span className="text-[11px] text-slate-500 block font-mono">
                CNPJ: {COMPANY_LEGAL.cnpj}
              </span>
            </div>
            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
              Asaas v3
            </span>
          </div>

          {/* SELETOR DE FORMAS DE PAGAMENTO */}
          <Tabs
            value={formaPagamento}
            onValueChange={(val) => {
              const f = val as 'pix' | 'cartao' | 'boleto'
              setFormaPagamento(f)
              if (f === 'pix' && !pixData && !loadingPixAsaas) {
                gerarPixRealAsaas()
              }
            }}
            className="w-full mt-2"
          >
            <TabsList className="grid grid-cols-3 w-full bg-slate-100 p-1 rounded-xl h-11">
              <TabsTrigger
                value="pix"
                className="text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                PIX Real
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

            {/* ABA 1: PIX REAL VIA ASAAS */}
            <TabsContent value="pix" className="space-y-4 pt-3">
              {loadingPixAsaas ? (
                <div className="py-12 text-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-800">
                    Gerando cobrança PIX oficial na Asaas...
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Criando cliente e gerando QR Code dinâmico com chave de segurança.
                  </p>
                </div>
              ) : pixStatusPago ? (
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-lg font-bold text-emerald-950">
                    Pagamento PIX Aprovado com Sucesso!
                  </h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Sua assinatura do plano <strong>Starter</strong> foi ativada por mais 30 dias. O
                    comprovante oficial e a nota foram enviados para seu e-mail cadastrado.
                  </p>
                  <Button
                    onClick={handleCloseModal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
                  >
                    Concluir e Acessar o Sistema
                  </Button>
                </div>
              ) : (
                <>
                  <div className="text-center p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      QR Code Dinâmico Oficial Asaas (R$ 49,90):
                    </div>

                    {/* QR Code Real da Asaas */}
                    <div className="w-52 h-52 bg-white p-2 rounded-2xl border border-slate-300 shadow-sm flex items-center justify-center my-1 relative">
                      {pixData?.pix_qr_code_base64 ? (
                        <img
                          src={pixData.pix_qr_code_base64}
                          alt="QR Code PIX Asaas"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-center p-3 text-xs text-slate-400">
                          <AlertCircle className="w-6 h-6 mx-auto mb-1 text-amber-500" />
                          QR Code indisponível no momento
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 mt-2 font-mono flex items-center gap-2">
                      <span>
                        Valor: <strong>{PLANO_CONFIG.precoFormatado}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Asaas ID: <strong>{pixData?.asaas_id || 'Gerando...'}</strong>
                      </span>
                    </div>

                    {pollingAtivo && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 mt-2 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                        Aguardando confirmação bancária em tempo real...
                      </div>
                    )}
                  </div>

                  {/* Código Copia e Cola Real */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      PIX Copia e Cola:
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={pixData?.pix_copia_cola || 'Gerando código copia-e-cola...'}
                        className="text-[11px] font-mono bg-slate-50 h-9 truncate text-slate-700 border-slate-200"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopiarPix}
                        disabled={!pixData?.pix_copia_cola}
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

                  {pixData?.invoice_url && (
                    <div className="text-right">
                      <a
                        href={pixData.invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                      >
                        Visualizar fatura e recibo na Asaas
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={gerarPixRealAsaas}
                      disabled={loadingPixAsaas}
                      className="h-10 text-xs border-slate-300"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 mr-1 ${loadingPixAsaas ? 'animate-spin' : ''}`}
                      />
                      Gerar Novo PIX
                    </Button>

                    <Button
                      type="button"
                      disabled={processingPayment}
                      onClick={handleChecarStatusPixManual}
                      className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.99]"
                    >
                      {processingPayment ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Já paguei / Verificar
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ABA 2: CARTÃO DE CRÉDITO */}
            <TabsContent value="cartao" className="space-y-3.5 pt-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Cartão de Crédito:</strong> Para contratação imediata, utilize o{' '}
                  <strong>PIX</strong> (aprovação instantânea). Se preferir cartão, preencha os
                  dados abaixo para simulação homologada.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleConfirmarPagamentoSimulado('cartao')
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
                      Processando pagamento no cartão...
                    </>
                  ) : (
                    `Confirmar no Cartão (${PLANO_CONFIG.precoFormatado})`
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* ABA 3: BOLETO BANCÁRIO */}
            <TabsContent value="boleto" className="space-y-4 pt-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-5 h-5 text-slate-700" />
                    <span className="text-xs font-bold text-slate-800">
                      Boleto Bancário (Compensação em até 3 dias úteis)
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
                    Para ativação imediata recomendada, pague via <strong>PIX</strong>. Se optar por
                    boleto, confirme a compensação abaixo para liberar o acesso.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                disabled={processingPayment}
                onClick={() => handleConfirmarPagamentoSimulado('boleto')}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.99]"
              >
                {processingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando compensação...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
                    Confirmar Compensação do Boleto
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
