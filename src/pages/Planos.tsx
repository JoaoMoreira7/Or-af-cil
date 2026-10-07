import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Check,
  CheckCircle2,
  Clock,
  Lock,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Copy,
  CreditCard,
  QrCode,
  Barcode,
  Loader2,
  Info,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Zap,
  Award,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { COMPANY_LEGAL } from '@/config/company'
import { PLANOS_LISTA, PlanoId, obterConfigPlano } from '@/config/plans'
import { gatewayPagamentoService, ResultadoCriacaoPixAsaas } from '@/services/gatewayPagamento'
import {
  sanitizarPixPayload,
  validarPixPayload,
  normalizarOuRepararPixPayload,
} from '@/lib/pixUtils'
import { Badge } from '@/components/ui/badge'

export const Planos: React.FC = () => {
  const { user } = useAuth()
  const {
    assinatura: plano,
    isTrial,
    isAtivo,
    isExpirado: isBloqueado,
    isDono,
    diasRestantesTrial,
    planoId: planoIdAtual,
    assinarPlano: assinarPlanoSimulado,
    simularFimTeste: simularFimDeTeste,
    restaurarTeste: restaurarTesteDemo,
    recarregarAssinatura: recarregarPlano,
    loading: loadingSub,
  } = useSubscription()

  const { toast } = useToast()

  // Plano selecionado para checkout (inicia no Profissional por ser o melhor custo-benefício)
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<PlanoId>('profissional')
  const planoSelecionadoConfig = obterConfigPlano(planoSelecionadoId)

  // Estado do modal de checkout
  const [modalOpen, setModalOpen] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState<'pix' | 'cartao' | 'boleto'>('pix')
  const [processingPayment, setProcessingPayment] = useState(false)

  // Estados específicos para PIX Real via Asaas
  const [loadingPixAsaas, setLoadingPixAsaas] = useState(false)
  const [pixData, setPixData] = useState<ResultadoCriacaoPixAsaas | null>(null)
  const [pixCopiado, setPixCopiado] = useState(false)
  const [pixStatusPago, setPixStatusPago] = useState(false)
  const [pollingAtivo, setPollingAtivo] = useState(false)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Formulário do Cartão de Crédito
  const [cardNome, setCardNome] = useState('')
  const [cardNumero, setCardNumero] = useState('')
  const [cardValidade, setCardValidade] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({})

  // Boleto Bancário
  const [boletoCopiado, setBoletoCopiado] = useState(false)
  const fakeBoletoLinha = '23793.38128 60000.123456 78000.654321 1 95450000004990'

  // Formatar data em padrão brasileiro
  const formatarData = (isoString?: string) => {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  }

  // Limpa timer de polling ao desmontar ou fechar modal
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current)
      }
    }
  }, [])

  // Iniciar geração de PIX Real para o plano selecionado
  const gerarPixRealAsaas = async (planoIdAlvo: PlanoId = planoSelecionadoId) => {
    setLoadingPixAsaas(true)
    setPixStatusPago(false)
    try {
      const res = await gatewayPagamentoService.criarPixAsaas({
        planoId: planoIdAlvo,
      })
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
            description: `Sua assinatura do Plano ${planoSelecionadoConfig.nome} foi ativada com sucesso por +30 dias!`,
          })
        }
      } catch (err) {
        console.warn('Aviso no polling de verificação do PIX:', err)
      }
    }, 4000)
  }

  const handleOpenCheckout = (planoEscolhidoId: PlanoId) => {
    setPlanoSelecionadoId(planoEscolhidoId)
    setCardNome(user?.name || '')
    setCardNumero('')
    setCardValidade('')
    setCardCvv('')
    setCardErrors({})
    setPixCopiado(false)
    setBoletoCopiado(false)
    setPixStatusPago(false)
    setPixData(null)
    setModalOpen(true)

    // Se estiver em modo PIX, já gera ou revalida o PIX real para o plano escolhido
    if (formaPagamento === 'pix') {
      gerarPixRealAsaas(planoEscolhidoId)
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
        planoId: planoSelecionadoId,
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
        description: `Seu plano ${planoSelecionadoConfig.nome} (${planoSelecionadoConfig.precoMensalExtenso}) foi ativado ${labelMetodo}. Acesso liberado por +30 dias!`,
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
          description: `A Asaas confirmou o recebimento do PIX. Seu plano ${planoSelecionadoConfig.nome} já está ativo.`,
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

  const handleCopiarPix = async () => {
    const rawCode = pixData?.pix_copia_cola || ''
    if (!rawCode) return

    // Sanitiza e garante CRC16 íntegro
    const normalizado = normalizarOuRepararPixPayload(rawCode)
    const limpo = normalizado.payload || sanitizarPixPayload(rawCode)

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(limpo)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = limpo
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      setPixCopiado(true)
      toast({
        title: 'Código PIX copiado!',
        description:
          'Código copia-e-cola transferido para a área de transferência (CRC16 verificado). Cole no seu aplicativo bancário.',
      })
      setTimeout(() => setPixCopiado(false), 3000)
    } catch (err) {
      console.warn('Erro ao copiar PIX:', err)
      toast({
        title: 'Erro ao copiar',
        description: 'Selecione o código no campo e copie manualmente.',
        variant: 'destructive',
      })
    }
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

  const planoUsuarioAtualConfig = obterConfigPlano(planoIdAtual)

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* HEADER DA PÁGINA COM SLOGAN OFICIAL */}
      <div className="pb-1">
        <div className="inline-block px-3 py-1 mb-2 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          Feito para quem vive de serviço
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Planos e Assinaturas
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Escolha a escala ideal para o seu negócio de prestação de serviços. Da emissão rápida de
          propostas até a gestão avançada de campo e relatórios executivos.
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
              Cobranças via <strong>PIX</strong> para qualquer plano são geradas em tempo real na
              API de produção da Asaas. Confirmação instantânea via Webhook e emissão de
              comprovante.
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
              await restaurarTesteDemo()
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
                Status da sua conta
              </span>

              {isDono ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-gradient-to-r from-amber-500/30 to-amber-400/20 text-amber-300 border border-amber-400/50 flex items-center gap-1.5 shadow-sm">
                  👑 Conta do Proprietário — Acesso Livre Vitalício
                </span>
              ) : (
                <>
                  {isAtivo && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Plano Ativo ({planoUsuarioAtualConfig.nome})
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
                </>
              )}
            </div>

            <h3 className="text-2xl font-extrabold text-white flex items-center gap-2">
              {isDono ? (
                <>
                  Plano Premium (Acesso Total)
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/40">
                    Proprietário
                  </span>
                </>
              ) : (
                <>
                  Plano {planoUsuarioAtualConfig.nome}
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-white/10 text-slate-200">
                    {planoUsuarioAtualConfig.posicionamento}
                  </span>
                </>
              )}
            </h3>

            <p className="text-xs text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {isDono ? (
                <span className="text-emerald-300 font-medium">
                  Sua conta de proprietário (<strong>{user?.email}</strong>) tem isenção permanente
                  de mensalidade e acesso irrestrito a todos os módulos do OrçaFácil.
                </span>
              ) : isAtivo ? (
                <span>
                  Renovação prevista em:{' '}
                  <strong>
                    {plano?.renovacao_em ? formatarData(plano.renovacao_em) : '30 dias'}
                  </strong>
                </span>
              ) : isTrial && !isBloqueado ? (
                <span>
                  Teste grátis de 7 dias válido até:{' '}
                  <strong>{plano?.trial_ate ? formatarData(plano.trial_ate) : '7 dias'}</strong> (
                  {diasRestantesTrial} {diasRestantesTrial === 1 ? 'dia' : 'dias'} restante(s))
                </span>
              ) : (
                <span className="text-rose-300 font-medium">
                  Seu período de teste expirou. Escolha um plano abaixo para desbloquear o sistema.
                </span>
              )}
            </p>
          </div>

          <div className="sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            {isDono ? (
              <div>
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-300">
                  Gratuito / Isento
                </span>
                <p className="text-[11px] text-amber-200/80 mt-1">
                  Sem mensalidade · Acesso vitalício
                </p>
              </div>
            ) : (
              <div>
                <span className="text-3xl font-extrabold tabular-nums text-white">
                  {planoUsuarioAtualConfig.precoFormatado}
                </span>
                <span className="text-xs text-slate-400 ml-1">/mês</span>
                <p className="text-[11px] text-blue-200 mt-1">Cobrança mensal Asaas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ESCADA DE TRÊS PLANOS LADO A LADO (MOBILE: EMPILHADOS) */}
      <div>
        <div className="text-center max-w-xl mx-auto mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">
            Feito para quem vive de serviço
          </p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Três planos feitos sob medida para a sua rotina
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Comece no seu ritmo e evolua conforme a demanda de clientes e serviços crescer.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-7 items-stretch">
          {PLANOS_LISTA.map((planoItem) => {
            const isDestaque = planoItem.id === 'profissional'
            const isPlanoAtual = isAtivo && planoIdAtual === planoItem.id

            return (
              <div
                key={planoItem.id}
                className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 transition-all duration-200 ${
                  isDestaque
                    ? 'bg-gradient-to-b from-blue-50/50 via-white to-indigo-50/30 border-2 border-blue-600 shadow-2xl shadow-blue-500/10 lg:-translate-y-2'
                    : 'bg-white border border-slate-200/90 shadow-md hover:shadow-lg'
                }`}
              >
                {/* Badge de Destaque para o Profissional ("Mais escolhido") */}
                {planoItem.badgeDestaque && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full text-[11px] font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-md flex items-center gap-1.5 whitespace-nowrap">
                      <Sparkles className="w-3.5 h-3.5" />
                      {planoItem.badgeDestaque}
                    </span>
                  </div>
                )}

                <div>
                  {/* Cabeçalho do Card */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        isDestaque
                          ? 'bg-blue-100/80 text-blue-800 border-blue-300'
                          : planoItem.id === 'premium'
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {planoItem.posicionamento}
                    </span>

                    {isPlanoAtual && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Seu plano atual
                      </span>
                    )}
                  </div>

                  <h4 className="text-2xl font-extrabold text-slate-900 mt-1">
                    Plano {planoItem.nome}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed min-h-[38px]">
                    {planoItem.descricaoCurta}
                  </p>

                  {/* Preço Exato */}
                  <div className="my-5 pb-5 border-b border-slate-100">
                    <div className="flex items-baseline">
                      <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                        {planoItem.precoFormatado}
                      </span>
                      <span className="text-sm font-semibold text-slate-500 ml-1.5">/mês</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> 7 dias de teste grátis no primeiro acesso
                    </p>
                  </div>

                  {/* Lista de Recursos com diferenciação clara */}
                  <div className="space-y-3 pb-6">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Recursos inclusos:
                    </p>
                    <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                      {planoItem.recursos.map((recurso, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              isDestaque
                                ? 'bg-blue-100 text-blue-700'
                                : planoItem.id === 'premium'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                          <span
                            className={`leading-snug ${
                              idx === 1 &&
                              (planoItem.id === 'profissional' || planoItem.id === 'premium')
                                ? 'font-semibold text-slate-900'
                                : ''
                            }`}
                          >
                            {recurso}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Botão de Escolha do Plano ou Selo de Acesso Livre para o Dono */}
                <div className="pt-2">
                  {isDono ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-900">
                        <Check className="w-4 h-4 text-amber-600" />
                        <span>Acesso Livre Vitalício</span>
                      </div>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Conta do proprietário liberada de cobrança
                      </p>
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => handleOpenCheckout(planoItem.id)}
                      className={`w-full h-12 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 ${
                        isDestaque
                          ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 text-white shadow-blue-500/25 ring-2 ring-blue-600/30'
                          : planoItem.id === 'premium'
                            ? 'bg-gradient-to-r from-slate-900 to-purple-950 hover:bg-slate-800 text-white shadow-purple-950/20'
                            : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                      }`}
                    >
                      {isPlanoAtual ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          Renovar {planoItem.nome} ({planoItem.precoFormatado})
                        </>
                      ) : (
                        <>
                          <span>
                            Contratar {planoItem.nome} ({planoItem.precoFormatado})
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  )}
                  <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    {isDono ? 'Conta de Administrador Master' : 'PIX Instantâneo Oficial Asaas'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* TABELA COMPARATIVA RESUMIDA */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            Comparativo Direto de Recursos por Plano
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Entenda claramente o que é liberado em cada degrau da plataforma OrçaFácil.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Funcionalidade</th>
                <th className="py-3 px-3 text-center">Essencial (R$ 49,90)</th>
                <th className="py-3 px-3 text-center bg-blue-50/70 text-blue-900 font-bold rounded-t-lg">
                  Profissional (R$ 64,90)
                </th>
                <th className="py-3 px-3 text-center">Premium (R$ 79,90)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-3 px-3 font-medium">
                  Orçamentos Ilimitados & Cadastro de Clientes
                </td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">Sim</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold bg-blue-50/30">
                  Sim
                </td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">Sim</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium">IA de Voz & Gastos por Voz</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">Sim</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold bg-blue-50/30">
                  Sim
                </td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">Sim</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium">Dashboard Financeiro Básico</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">Sim</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold bg-blue-50/30">
                  Sim
                </td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">Sim</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium font-semibold text-slate-900">
                  Assistente de Campo (Fotos de Notas, Recibos e Orçamentos)
                </td>
                <td className="py-3 px-3 text-center text-slate-300 font-bold">—</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold bg-blue-50/30">
                  Sim (Incluso)
                </td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">Sim (Incluso)</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium font-semibold text-slate-900">
                  Contas a Receber Avançado (Cobrança via WhatsApp com Chave PIX)
                </td>
                <td className="py-3 px-3 text-center text-slate-300 font-bold">—</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold bg-blue-50/30">
                  Sim (Incluso)
                </td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">Sim (Incluso)</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium font-semibold text-slate-900">
                  Resumo Semanal em Áudio (Podcast Executivo)
                </td>
                <td className="py-3 px-3 text-center text-slate-300 font-bold">—</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold bg-blue-50/30">
                  Sim (Incluso)
                </td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">Sim (Incluso)</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium font-semibold text-slate-900">
                  Exportação & Relatórios Financeiros Avançados
                </td>
                <td className="py-3 px-3 text-center text-slate-300 font-bold">—</td>
                <td className="py-3 px-3 text-center text-slate-300 font-bold bg-blue-50/30">—</td>
                <td className="py-3 px-3 text-center text-purple-700 font-bold">Sim (Exclusivo)</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium font-semibold text-slate-900">
                  Selo e Canal de Atendimento com Suporte Prioritário VIP
                </td>
                <td className="py-3 px-3 text-center text-slate-400">Padrão</td>
                <td className="py-3 px-3 text-center text-slate-600 bg-blue-50/30">WhatsApp</td>
                <td className="py-3 px-3 text-center text-purple-700 font-bold">VIP Prioritário</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CHECKOUT COM PIX REAL ASAAS POR PLANO SELECIONADO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[540px] rounded-3xl bg-white text-slate-900 p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                {planoSelecionadoConfig.posicionamento}
              </span>
            </div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Contratar Plano {planoSelecionadoConfig.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Valor da assinatura:{' '}
              <strong className="text-slate-900 text-sm">
                {planoSelecionadoConfig.precoFormatado} / mês
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
                gerarPixRealAsaas(planoSelecionadoId)
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
                    Gerando cobrança PIX do Plano {planoSelecionadoConfig.nome} na Asaas...
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Criando cliente e gerando QR Code dinâmico (
                    {planoSelecionadoConfig.precoFormatado}).
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
                    Sua assinatura do plano <strong>{planoSelecionadoConfig.nome}</strong> foi
                    ativada por mais 30 dias. O comprovante oficial com CNPJ foi enviado para seu
                    e-mail cadastrado.
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
                      QR Code Dinâmico Oficial Asaas ({planoSelecionadoConfig.nome} —{' '}
                      {planoSelecionadoConfig.precoFormatado}):
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
                        Valor: <strong>{planoSelecionadoConfig.precoFormatado}</strong>
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
                  {pixData?.pix_copia_cola &&
                    (() => {
                      const validacao = validarPixPayload(pixData.pix_copia_cola)
                      const limpo =
                        validacao.payloadSanitizado || sanitizarPixPayload(pixData.pix_copia_cola)

                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-slate-700">
                              PIX Copia e Cola (BR Code Oficial):
                            </Label>
                            {validacao.valido ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                                ✓ CRC16 Válido ({validacao.crcAtual})
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                                ⚠️ Checksum Corrigido
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              readOnly
                              value={limpo}
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                              onFocus={(e) => (e.target as HTMLInputElement).select()}
                              className="text-[11px] font-mono bg-slate-50 h-9 text-slate-700 border-slate-200 select-all cursor-text"
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
                      )
                    })()}

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
                      onClick={() => gerarPixRealAsaas(planoSelecionadoId)}
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
                  <strong>Plano {planoSelecionadoConfig.nome}:</strong>{' '}
                  {planoSelecionadoConfig.precoFormatado}/mês. Para ativação imediata, utilize o{' '}
                  <strong>PIX</strong> (aprovação instantânea). Se preferir cartão, preencha os
                  dados abaixo para simulação.
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
                    `Confirmar no Cartão (${planoSelecionadoConfig.precoFormatado})`
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
                    {planoSelecionadoConfig.precoFormatado}
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
                    Para ativação imediata recomendada, pague via <strong>PIX</strong> (
                    {planoSelecionadoConfig.precoFormatado}). Se optar por boleto, confirme a
                    compensação abaixo para liberar o acesso.
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
                    Confirmar Compensação do Boleto ({planoSelecionadoConfig.precoFormatado})
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

export default Planos
