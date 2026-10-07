import React, { useEffect, useState, useRef } from 'react'
import {
  CreditCard,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Lock,
  Eye,
  EyeOff,
  Zap,
  Globe,
  Radio,
  ExternalLink,
  Info,
  PlayCircle,
  QrCode,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import pb from '@/lib/pocketbase/client'
import { gatewayPagamentoService } from '@/services/gatewayPagamento'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { COMPANY_LEGAL } from '@/config/company'
import {
  sanitizarPixPayload,
  validarPixPayload,
  normalizarOuRepararPixPayload,
} from '@/lib/pixUtils'

interface GatewayStatusData {
  sucesso: boolean
  gateway: string
  chave_configurada: boolean
  chave_mascarada: string
  chave_origem: string
  ambiente: 'producao' | 'sandbox'
  ultima_verificacao?: string
  status_verificacao?: string
  detalhes_conta?: {
    nome_empresa?: string
    email?: string
    cpf_cnpj?: string
    ultima_checagem?: string
  } | null
  auto_reativado?: boolean
  reativacao_resultado?: unknown
  webhook: {
    url: string
    token_configurado: boolean
    token_mascarado: string
    token_origem: string
    eventos_obrigatorios: string[]
    status_real?: {
      consultado: boolean
      status: string
      interrupted: boolean
      enabled: boolean
      webhook_id?: string
      nome?: string
      url?: string
      email?: string
      mensagem?: string
    }
  }
}

export default function AdminGateway() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isMountedRef = useRef(true)

  const [loading, setLoading] = useState<boolean>(true)
  const [status, setStatus] = useState<GatewayStatusData | null>(null)

  // Testar conexão
  const [testandoConexao, setTestandoConexao] = useState<boolean>(false)
  const [resultadoTeste, setResultadoTeste] = useState<{
    executado: boolean
    conectado: boolean
    mensagem: string
    conta?: {
      nome: string
      email: string
      cpf_cnpj: string
      verificado_em: string
    }
  } | null>(null)

  // Rotação / Atualização da Chave
  const [modalAtualizarChaveOpen, setModalAtualizarChaveOpen] = useState<boolean>(false)
  const [novaChaveInput, setNovaChaveInput] = useState<string>('')
  const [mostrarNovaChave, setMostrarNovaChave] = useState<boolean>(false)
  const [testarAntesDeSalvar, setTestarAntesDeSalvar] = useState<boolean>(true)
  const [salvandoChave, setSalvandoChave] = useState<boolean>(false)

  // Regenerar Token Webhook
  const [modalRegenerarTokenOpen, setModalRegenerarTokenOpen] = useState<boolean>(false)
  const [novoTokenGerado, setNovoTokenGerado] = useState<string | null>(null)
  const [regenerandoToken, setRegenerandoToken] = useState<boolean>(false)

  // Reativar Fila do Webhook na Asaas
  const [reativandoFila, setReativandoFila] = useState<boolean>(false)

  // Revelação / Ocultação do Token do Webhook
  const [tokenRevelado, setTokenRevelado] = useState<string | null>(null)
  const [revelandoToken, setRevelandoToken] = useState<boolean>(false)
  const [mostrarToken, setMostrarToken] = useState<boolean>(false)

  // Cópia
  const [copiadoUrl, setCopiadoUrl] = useState<boolean>(false)
  const [copiadoNovoToken, setCopiadoNovoToken] = useState<boolean>(false)
  const [copiadoTokenCard, setCopiadoTokenCard] = useState<boolean>(false)
  const [copiadoPixTeste, setCopiadoPixTeste] = useState<boolean>(false)
  const timerCopiadoUrlRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerCopiadoTokenRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerCopiadoTokenCardRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerCopiadoPixTesteRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Teste de Validação Real (R$ 5,00 via PIX)
  const [gerandoTestePix, setGerandoTestePix] = useState<boolean>(false)
  const [modalTestePixOpen, setModalTestePixOpen] = useState<boolean>(false)
  const [testePixData, setTestePixData] = useState<{
    pagamento_id: string
    asaas_id: string
    referencia: string
    valor: number
    status: string
    pix_copia_cola: string
    pix_qr_code_base64: string
    invoice_url: string
    vencimento_pix: string
    expiracao_qr: string
    criadoEm?: string
    pagoEm?: string
    webhookProcessadoEm?: string
  } | null>(null)
  const [pollingTesteAtivo, setPollingTesteAtivo] = useState<boolean>(false)
  const [testeConfirmado, setTesteConfirmado] = useState<boolean>(false)
  const [historicoUltimoTeste, setHistoricoUltimoTeste] = useState<{
    id: string
    asaas_id: string
    referencia: string
    status: string
    criadoEm: string
    pagoEm?: string
    webhookProcessadoEm?: string
  } | null>(null)
  const pollingTesteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timerCopiadoUrlRef.current) {
        clearTimeout(timerCopiadoUrlRef.current)
      }
      if (timerCopiadoTokenRef.current) {
        clearTimeout(timerCopiadoTokenRef.current)
      }
      if (timerCopiadoTokenCardRef.current) {
        clearTimeout(timerCopiadoTokenCardRef.current)
      }
      if (timerCopiadoPixTesteRef.current) {
        clearTimeout(timerCopiadoPixTesteRef.current)
      }
      if (pollingTesteTimerRef.current) {
        clearInterval(pollingTesteTimerRef.current)
        pollingTesteTimerRef.current = null
      }
    }
  }, [])

  const carregarStatus = async () => {
    setLoading(true)
    try {
      const data = await gatewayPagamentoService.obterStatusGateway()
      if (isMountedRef.current) {
        setStatus(data)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao obter status do gateway'
        toast({
          title: 'Erro ao carregar status',
          description: msg,
          variant: 'destructive',
        })
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  const carregarUltimoTeste = async () => {
    if (!user?.id) return
    try {
      const ult = await gatewayPagamentoService.obterUltimoTesteValidacao(user.id)
      if (isMountedRef.current && ult) {
        const meta = (ult.metadados as Record<string, unknown>) || {}
        setHistoricoUltimoTeste({
          id: ult.id,
          asaas_id: ult.asaas_id || (meta.asaas_payment_id as string) || '',
          referencia: ult.referencia_transacao,
          status: ult.status,
          criadoEm: ult.created,
          pagoEm: ult.pago_em,
          webhookProcessadoEm: (meta.webhook_processado_em as string) || undefined,
        })
      }
    } catch (err) {
      console.warn('Aviso ao carregar histórico de testes:', err)
    }
  }

  useEffect(() => {
    carregarStatus()
    carregarUltimoTeste()
  }, [user?.id])

  // Limpa o polling de teste ao fechar o modal
  const handleFecharModalTeste = () => {
    if (pollingTesteTimerRef.current) {
      clearInterval(pollingTesteTimerRef.current)
      pollingTesteTimerRef.current = null
    }
    setPollingTesteAtivo(false)
    setModalTestePixOpen(false)
    carregarUltimoTeste()
  }

  // Polling para checar status do pagamento de teste a cada 5s
  const iniciarPollingTeste = (pagamentoId: string, asaasId: string) => {
    if (pollingTesteTimerRef.current) {
      clearInterval(pollingTesteTimerRef.current)
    }
    setPollingTesteAtivo(true)

    const checarStatus = async () => {
      if (!isMountedRef.current) return
      try {
        // 1. Tenta checar primeiro no banco local (rápido e direto)
        if (pagamentoId) {
          try {
            const pagLocal = await pb.collection('pagamentos').getOne(pagamentoId)
            if (isMountedRef.current && pagLocal && pagLocal.status === 'pago') {
              setTesteConfirmado(true)
              setPollingTesteAtivo(false)
              if (pollingTesteTimerRef.current) {
                clearInterval(pollingTesteTimerRef.current)
                pollingTesteTimerRef.current = null
              }
              setTestePixData((prev) =>
                prev
                  ? {
                      ...prev,
                      status: 'pago',
                      pagoEm: pagLocal.pago_em || new Date().toISOString(),
                      webhookProcessadoEm: new Date().toISOString(),
                    }
                  : null,
              )
              toast({
                title: '🎉 PAGAMENTO CONFIRMADO! ✅',
                description:
                  'O PIX de R$ 5,00 foi recebido e o webhook da Asaas foi validado com sucesso!',
              })
              carregarUltimoTeste()
              carregarStatus()
              return
            }
          } catch {
            /* intentionally ignored */
          }
        }

        // 2. Consulta via endpoint Asaas se asaasId estiver presente
        if (asaasId) {
          const consulta = await gatewayPagamentoService.consultarCobrancaAsaas(asaasId)
          const statusAsaas = consulta.cobranca?.status
          const statusLocal = consulta.status_local

          if (
            isMountedRef.current &&
            (statusAsaas === 'RECEIVED' || statusAsaas === 'CONFIRMED' || statusLocal === 'pago')
          ) {
            setTesteConfirmado(true)
            setPollingTesteAtivo(false)
            if (pollingTesteTimerRef.current) {
              clearInterval(pollingTesteTimerRef.current)
              pollingTesteTimerRef.current = null
            }

            setTestePixData((prev) =>
              prev
                ? {
                    ...prev,
                    status: 'pago',
                    pagoEm: new Date().toISOString(),
                    webhookProcessadoEm: new Date().toISOString(),
                  }
                : null,
            )

            toast({
              title: '🎉 PAGAMENTO CONFIRMADO! ✅',
              description:
                'O PIX de R$ 5,00 foi recebido e o webhook da Asaas foi validado com sucesso!',
            })

            carregarUltimoTeste()
            carregarStatus()
          }
        }
      } catch (err) {
        console.warn('[AdminGateway] Aviso no polling de teste PIX:', err)
      }
    }

    // Executa a primeira checagem após 5 segundos e segue a cada 5 segundos
    pollingTesteTimerRef.current = setInterval(checarStatus, 5000)
  }

  // Ação: Gerar Cobrança de Teste R$ 5,00 (PIX)
  const handleGerarCobrancaTestePix = async () => {
    setGerandoTestePix(true)
    setTesteConfirmado(false)
    try {
      const res = await gatewayPagamentoService.gerarCobrancaTestePix()
      if (isMountedRef.current) {
        const payloadNormalizado = normalizarOuRepararPixPayload(res.pix_copia_cola)
        const pixLimpo = payloadNormalizado.payload || sanitizarPixPayload(res.pix_copia_cola)

        setTestePixData({
          pagamento_id: res.pagamento_id,
          asaas_id: res.asaas_id,
          referencia: res.referencia,
          valor: res.valor,
          status: res.status,
          pix_copia_cola: pixLimpo,
          pix_qr_code_base64: res.pix_qr_code_base64,
          invoice_url: res.invoice_url,
          vencimento_pix: res.vencimento_pix,
          expiracao_qr: res.expiracao_qr,
          criadoEm: new Date().toISOString(),
        })

        setModalTestePixOpen(true)

        toast({
          title: 'Cobrança de Teste Gerada!',
          description:
            res.mensagem || 'QR Code PIX de R$ 5,00 gerado. Pague para validar o webhook.',
        })

        // Inicia monitoramento em tempo real
        iniciarPollingTeste(res.pagamento_id, res.asaas_id)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao gerar cobrança PIX de teste'
        toast({
          variant: 'destructive',
          title: 'Erro ao gerar cobrança de teste',
          description: msg,
        })
      }
    } finally {
      if (isMountedRef.current) {
        setGerandoTestePix(false)
      }
    }
  }

  // Ação: Copiar Código Copia e Cola do Teste PIX
  const handleCopiarPixTeste = async () => {
    if (!testePixData?.pix_copia_cola) return

    // Normaliza/repara o payload garantindo CRC16 perfeito e sem caracteres acidentais
    const normalizado = normalizarOuRepararPixPayload(testePixData.pix_copia_cola)
    const textoLimpo = normalizado.payload || sanitizarPixPayload(testePixData.pix_copia_cola)

    // Atualiza o estado caso tenha sofrido reparo/sanitização
    if (textoLimpo !== testePixData.pix_copia_cola && isMountedRef.current) {
      setTestePixData((prev) => (prev ? { ...prev, pix_copia_cola: textoLimpo } : null))
    }

    const sucesso = await copiarTextoRobusto(textoLimpo)
    if (!isMountedRef.current) return

    if (sucesso) {
      setCopiadoPixTeste(true)
      toast({
        title: 'Código PIX copiado!',
        description:
          'Código BR Code verificado (CRC16 intacto, sem quebras nem espaços). Abra o app do seu banco e escolha "Pix Copia e Cola" para pagar R$ 5,00.',
      })
      if (timerCopiadoPixTesteRef.current) clearTimeout(timerCopiadoPixTesteRef.current)
      timerCopiadoPixTesteRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setCopiadoPixTeste(false)
        }
      }, 3000)
    } else {
      toast({
        title: 'Não foi possível copiar automaticamente',
        description: 'Selecione o código PIX na caixa de texto e copie.',
        variant: 'destructive',
      })
    }
  }

  // Proteção em nível de renderização além da rota: apenas jaocarloss@gmail.com
  const isDono = user?.email?.toLowerCase().trim() === 'jaocarloss@gmail.com'

  if (!isDono) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Acesso Restrito ao Dono</h2>
        <p className="text-sm text-slate-500 max-w-md mt-1">
          A configuração e rotação de chaves do gateway de pagamento é de acesso exclusivo de{' '}
          <strong>jaocarloss@gmail.com</strong>.
        </p>
      </div>
    )
  }

  // Ação: Testar Conexão Real na API Asaas
  const handleTestarConexao = async () => {
    setTestandoConexao(true)
    setResultadoTeste(null)
    try {
      const res = await gatewayPagamentoService.testarConexaoGateway()
      if (isMountedRef.current) {
        setResultadoTeste({
          executado: true,
          conectado: res.conectado,
          mensagem: res.mensagem,
          conta: res.conta,
        })

        if (res.conectado) {
          toast({
            title: '✅ Conexão validada com a Asaas!',
            description: res.mensagem,
          })
          await carregarStatus()
        } else {
          toast({
            variant: 'destructive',
            title: '❌ Falha na conexão com Asaas',
            description: res.mensagem,
          })
        }
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Erro ao testar chave Asaas'
        setResultadoTeste({
          executado: true,
          conectado: false,
          mensagem: msg,
        })
        toast({
          variant: 'destructive',
          title: 'Erro no teste de conexão',
          description: msg,
        })
      }
    } finally {
      if (isMountedRef.current) {
        setTestandoConexao(false)
      }
    }
  }

  // Ação: Salvar Nova Chave (Rotação Segura)
  const handleSalvarNovaChave = async () => {
    if (!novaChaveInput.trim()) {
      toast({
        title: 'Chave não informada',
        description: 'Cole a nova chave de API da Asaas antes de salvar.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoChave(true)
    try {
      const res = await gatewayPagamentoService.salvarChaveGateway(
        novaChaveInput.trim(),
        testarAntesDeSalvar,
      )

      if (isMountedRef.current) {
        toast({
          title: '🔐 Chave atualizada com sucesso!',
          description: `A nova chave (${res.chave_mascarada}) foi armazenada de forma segura e já está ativa.`,
        })
        setModalAtualizarChaveOpen(false)
        setNovaChaveInput('')
        setResultadoTeste(null)
        await carregarStatus()
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao salvar chave Asaas'
        toast({
          variant: 'destructive',
          title: 'Erro ao atualizar chave',
          description: msg,
        })
      }
    } finally {
      if (isMountedRef.current) {
        setSalvandoChave(false)
      }
    }
  }

  // Ação: Regenerar Token do Webhook
  const handleRegenerarTokenWebhook = async () => {
    setRegenerandoToken(true)
    try {
      const res = await gatewayPagamentoService.regenerarTokenWebhook()
      if (isMountedRef.current) {
        setNovoTokenGerado(res.novo_token)
        setTokenRevelado(res.novo_token)
        toast({
          title: 'Novo Token de Webhook Gerado',
          description: 'Copie o novo token e cole na aba Webhooks do seu painel Asaas.',
        })
        await carregarStatus()
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao regenerar token do webhook'
        toast({
          variant: 'destructive',
          title: 'Erro ao gerar token',
          description: msg,
        })
      }
    } finally {
      if (isMountedRef.current) {
        setRegenerandoToken(false)
      }
    }
  }

  // Ação: Reativar Fila do Webhook na Asaas
  const handleReativarFilaWebhook = async () => {
    setReativandoFila(true)
    try {
      const res = await gatewayPagamentoService.reativarFilaWebhook()
      if (isMountedRef.current) {
        if (res.sucesso) {
          toast({
            title: '✅ Fila Reativada na Asaas!',
            description:
              res.mensagem || 'A fila do webhook foi reativada e os envios foram retomados.',
          })
          await carregarStatus()
        } else {
          toast({
            variant: 'destructive',
            title: 'Aviso ao reativar fila',
            description: res.mensagem || 'Não foi possível reativar a fila automaticamente.',
          })
        }
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Erro ao conectar à Asaas para reativar fila. Tente novamente ou reative pelo painel Asaas.'
        toast({
          variant: 'destructive',
          title: 'Erro ao reativar fila',
          description: msg,
        })
      }
    } finally {
      if (isMountedRef.current) {
        setReativandoFila(false)
      }
    }
  }

  // Ação: Alternar Revelar / Ocultar Token do Webhook no Card
  const handleToggleRevelarToken = async () => {
    if (mostrarToken) {
      setMostrarToken(false)
      return
    }

    if (tokenRevelado) {
      setMostrarToken(true)
      return
    }

    setRevelandoToken(true)
    try {
      const res = await gatewayPagamentoService.revelarTokenWebhook()
      if (isMountedRef.current) {
        setTokenRevelado(res.token)
        setMostrarToken(true)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao obter token do webhook'
        toast({
          variant: 'destructive',
          title: 'Erro ao revelar token',
          description: msg,
        })
      }
    } finally {
      if (isMountedRef.current) {
        setRevelandoToken(false)
      }
    }
  }

  // Ação: Copiar Token direto pelo Card de Webhook (revela silenciosamente se necessário)
  const handleCopiarTokenCard = async () => {
    let tokenParaCopiar = tokenRevelado || novoTokenGerado

    if (!tokenParaCopiar) {
      setRevelandoToken(true)
      try {
        const res = await gatewayPagamentoService.revelarTokenWebhook()
        tokenParaCopiar = res.token
        if (isMountedRef.current) {
          setTokenRevelado(res.token)
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Falha ao obter token para cópia'
          toast({
            variant: 'destructive',
            title: 'Erro ao copiar token',
            description: msg,
          })
          return
        }
      } finally {
        if (isMountedRef.current) {
          setRevelandoToken(false)
        }
      }
    }

    if (!tokenParaCopiar) return

    const sucesso = await copiarTextoRobusto(tokenParaCopiar)
    if (!isMountedRef.current) return

    if (sucesso) {
      setCopiadoTokenCard(true)
      toast({
        title: 'Token de Webhook copiado!',
        description: 'Cole no campo "Token de autenticação" na configuração de Webhooks da Asaas.',
      })
      if (timerCopiadoTokenCardRef.current) clearTimeout(timerCopiadoTokenCardRef.current)
      timerCopiadoTokenCardRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setCopiadoTokenCard(false)
        }
      }, 3000)
    } else {
      toast({
        title: 'Não foi possível copiar automaticamente',
        description: 'Clique em Revelar Token para selecionar o valor manualmente.',
        variant: 'destructive',
      })
    }
  }

  /**
   * Copia texto para a área de transferência com suporte robusto:
   * 1. navigator.clipboard.writeText (se disponível em ambiente seguro HTTPS/localhost)
   * 2. Fallback via document.execCommand('copy') com textarea invisível
   */
  const copiarTextoRobusto = async (texto: string): Promise<boolean> => {
    if (!texto) return false

    // Tentativa 1: Clipboard API nativa
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(texto)
        return true
      } catch (err) {
        console.warn('[AdminGateway] Clipboard API falhou, tentando fallback:', err)
      }
    }

    // Tentativa 2: Fallback via textarea e execCommand('copy')
    try {
      const textarea = document.createElement('textarea')
      textarea.value = texto
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

      const copiadoSucesso = document.execCommand('copy')
      document.body.removeChild(textarea)

      if (copiadoSucesso) {
        return true
      }
    } catch (err) {
      console.error('[AdminGateway] Fallback execCommand falhou:', err)
    }

    return false
  }

  const URL_WEBHOOK_PADRAO = import.meta.env.VITE_POCKETBASE_URL
    ? `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/asaas/webhook`
    : 'https://finalizacao-do-sistema-913b5.shrd00.internal.goskip.dev/backend/v1/asaas/webhook'
  const urlWebhookExibicao = status?.webhook?.url || URL_WEBHOOK_PADRAO

  const handleCopiarUrlWebhook = async () => {
    const url = urlWebhookExibicao
    if (!url) return

    const sucesso = await copiarTextoRobusto(url)
    if (!isMountedRef.current) return

    if (sucesso) {
      setCopiadoUrl(true)
      toast({
        title: 'URL do Webhook copiada!',
        description: 'Cole esta URL nas configurações de Webhooks do painel Asaas.',
      })
      if (timerCopiadoUrlRef.current) clearTimeout(timerCopiadoUrlRef.current)
      timerCopiadoUrlRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setCopiadoUrl(false)
        }
      }, 3000)
    } else {
      toast({
        title: 'Não foi possível copiar automaticamente',
        description: 'Selecione o texto do campo abaixo e copie com Ctrl+C / Cmd+C.',
        variant: 'destructive',
      })
    }
  }

  const handleCopiarNovoToken = async () => {
    if (!novoTokenGerado) return

    const sucesso = await copiarTextoRobusto(novoTokenGerado)
    if (!isMountedRef.current) return

    if (sucesso) {
      setCopiadoNovoToken(true)
      toast({
        title: 'Token copiado!',
        description: 'Token de autenticação do Webhook copiado para a área de transferência.',
      })
      if (timerCopiadoTokenRef.current) clearTimeout(timerCopiadoTokenRef.current)
      timerCopiadoTokenRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setCopiadoNovoToken(false)
        }
      }, 3000)
    } else {
      toast({
        title: 'Não foi possível copiar automaticamente',
        description: 'Selecione o token no campo abaixo e copie com Ctrl+C / Cmd+C.',
        variant: 'destructive',
      })
    }
  }

  const formatarDataIso = (iso?: string) => {
    if (!iso) return 'Nunca verificada'
    try {
      const d = new Date(iso)
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    } catch (_) {
      return iso
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* CABEÇALHO DA TELA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-900 to-emerald-700 text-white shadow-sm">
              <CreditCard className="w-5 h-5" />
            </span>
            <h2
              translate="no"
              className="notranslate text-2xl font-bold tracking-tight text-slate-900"
            >
              Gateway de Pagamento (Asaas)
            </h2>
            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs font-bold">
              👑 Exclusivo: jaocarloss@gmail.com
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestão segura da conexão com a Asaas. Status da chave, validação em tempo real, rotação
            segura de credenciais e configuração de webhooks.
          </p>
        </div>

        <Button
          onClick={carregarStatus}
          disabled={loading}
          variant="outline"
          className="border-slate-300 hover:bg-slate-100 self-start sm:self-auto gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Status
        </Button>
      </div>

      {/* AVISO DE SEGURANÇA E PRIVACIDADE */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white text-xs sm:text-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm border border-slate-800">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white/10 text-emerald-400 shrink-0 mt-0.5 md:mt-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">Cofre Seguro de Credenciais do Backend</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase">
                Zero Leaks no Front-end
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              A chave de API completa <strong>nunca trafega nem fica exposta no navegador</strong>{' '}
              ou em arquivos públicos. Toda validação, assinatura e cobrança ocorre 100% no servidor
              em nuvem do OrçaFácil através de hooks isolados.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 bg-white/10 p-2.5 rounded-xl border border-white/10 text-[11px] text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Beneficiário: {COMPANY_LEGAL.razaoSocial}</span>
        </div>
      </div>

      {/* 3 CARDS DE VISÃO GERAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: STATUS DA CONEXÃO */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status da Conexão
            </CardTitle>
            <Radio className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="text-sm text-slate-400">Verificando...</div>
              ) : status?.chave_configurada ? (
                <>
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xl font-bold text-emerald-700">Conectado</span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] uppercase font-bold ml-auto">
                    {status.ambiente === 'producao' ? 'Produção' : 'Sandbox'}
                  </Badge>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-xl font-bold text-rose-700">Desconectado</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Última validação:{' '}
              <strong className="text-slate-700 font-mono">
                {formatarDataIso(status?.ultima_verificacao)}
              </strong>
            </p>
          </CardContent>
        </Card>

        {/* CARD 2: CHAVE DE API MASCARADA */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Chave de API Asaas
            </CardTitle>
            <KeyRound className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-slate-900">
                {loading ? '••••••••••••' : status?.chave_mascarada || 'Nenhuma chave configurada'}
              </span>
              {status?.chave_origem && (
                <Badge variant="outline" className="text-[10px] ml-auto">
                  Origem: {status.chave_origem}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {status?.chave_configurada
                ? 'Chave ativa para geração de PIX e cancelamentos'
                : 'Configure uma chave para permitir emissão de PIX'}
            </p>
          </CardContent>
        </Card>

        {/* CARD 3: STATUS REAL DO WEBHOOK NA ASAAS */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status na Asaas
            </CardTitle>
            <Globe className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="text-sm text-slate-400">Consultando Asaas...</div>
              ) : status?.webhook?.status_real?.consultado ? (
                status.webhook.status_real.interrupted ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-base font-bold text-rose-700">Interrompido</span>
                    <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-bold ml-auto">
                      Requer Reativação
                    </Badge>
                  </>
                ) : status.webhook.status_real.enabled ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-base font-bold text-emerald-700">Ativado</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold ml-auto">
                      Fila Normal
                    </Badge>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full bg-slate-400" />
                    <span className="text-base font-bold text-slate-700">Desativado</span>
                  </>
                )
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-900">
                    {status?.webhook?.token_mascarado || 'Configurado'}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2 truncate">
              {status?.webhook?.status_real?.mensagem ||
                (status?.webhook.token_configurado
                  ? 'Token de segurança ativo e validando requisições'
                  : 'Recomendado gerar um token')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* BLOCO DE TESTE DE CONEXÃO E ROTAÇÃO DA CHAVE */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Diagnóstico & Atualização da Chave de API</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Valide a conexão em tempo real contra a API da Asaas e substitua a chave quando
                necessário.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                onClick={handleTestarConexao}
                disabled={testandoConexao || loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-xs"
              >
                {testandoConexao ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Testando na Asaas...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    Testar Conexão Agora
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setNovaChaveInput('')
                  setModalAtualizarChaveOpen(true)
                }}
                variant="outline"
                className="border-slate-300 hover:bg-slate-100 text-xs h-9 font-semibold"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Atualizar Chave (Rotação)
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {/* RESULTADO DO TESTE (QUANDO EXECUTADO) */}
          {resultadoTeste && (
            <div
              className={`p-4 rounded-xl border flex flex-col gap-2 ${
                resultadoTeste.conectado
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {resultadoTeste.conectado ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Conexão com a Asaas Ativa e Homologada</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Falha na Verificação da Chave</span>
                  </>
                )}
              </div>
              <p className="text-xs leading-relaxed">{resultadoTeste.mensagem}</p>

              {resultadoTeste.conta && (
                <div className="mt-2 pt-2 border-t border-emerald-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-emerald-800 font-semibold">Conta Titular:</span>{' '}
                    <strong>{resultadoTeste.conta.nome}</strong>
                  </div>
                  <div>
                    <span className="text-emerald-800 font-semibold">E-mail:</span>{' '}
                    <span className="font-mono">{resultadoTeste.conta.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-emerald-800 font-semibold">Verificado em:</span>{' '}
                    <span className="font-mono">
                      {formatarDataIso(resultadoTeste.conta.verificado_em)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DADOS DETALHADOS DA CONTA EM CACHE */}
          {status?.detalhes_conta && !resultadoTeste && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Conta Asaas Registrada
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Última sincronização: {formatarDataIso(status.detalhes_conta.ultima_checagem)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-500">Razão Social / Nome:</span>
                  <div className="font-semibold text-slate-900">
                    {status.detalhes_conta.nome_empresa || 'Asaas Produção'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">E-mail Cadastrado:</span>
                  <div className="font-mono text-slate-800">
                    {status.detalhes_conta.email || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">CNPJ / CPF:</span>
                  <div className="font-mono text-slate-800">
                    {status.detalhes_conta.cpf_cnpj || COMPANY_LEGAL.cnpj}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 leading-relaxed">
            💡 <strong>Dica de Operação:</strong> Se a Asaas solicitar a rotação periódica da sua
            chave ou se você gerou um novo token no portal da Asaas (
            <a
              href="https://www.asaas.com"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              asaas.com
            </a>{' '}
            → Minha Conta → Integrações), basta clicar no botão{' '}
            <strong>"Atualizar Chave (Rotação)"</strong> acima. O sistema fará um teste prévio e
            armazenará a nova credencial sem interrupção de serviço.
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO: TESTE DE VALIDAÇÃO COM COBRANÇA REAL (R$ 5,00 VIA PIX) */}
      <Card className="border-emerald-200 shadow-sm bg-gradient-to-b from-white via-emerald-50/20 to-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <CardHeader className="border-b border-emerald-100/80 bg-emerald-500/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                  <QrCode className="w-5 h-5" />
                </span>
                <CardTitle className="text-base font-bold text-slate-900">
                  Teste de Validação com Cobrança Real (R$ 5,00 via PIX)
                </CardTitle>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                  ⚡ Validação do Ciclo Completo
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Gere uma cobrança PIX real de <strong>R$ 5,00</strong> diretamente na API do Asaas
                para validar a confirmação automática via webhook ponta-a-ponta antes de ligar o
                gateway aos clientes.
              </CardDescription>
            </div>

            <Button
              type="button"
              onClick={handleGerarCobrancaTestePix}
              disabled={gerandoTestePix || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-4 shadow-sm gap-2 shrink-0 self-start sm:self-auto"
            >
              {gerandoTestePix ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Gerando Cobrança no Asaas...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  Gerar Cobrança de Teste R$ 5,00 (PIX)
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4 text-xs">
          {/* INSTRUÇÕES EM PT-BR */}
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5 sm:mt-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-emerald-900 text-sm">
                  Instruções para o Teste Real:
                </div>
                <p className="text-emerald-800 text-xs leading-relaxed">
                  Pague o PIX de R$ 5,00 com outro aparelho/conta para validar o ciclo real. Ao
                  pagar, a confirmação automática aparece aqui em segundos.
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-300/60">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Isolado de relatórios de vendas</span>
            </div>
          </div>
          {/* PAINEL DE RESULTADO / LINHA DO TEMPO DO ÚLTIMO TESTE */}
          {historicoUltimoTeste ? (
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-slate-900 text-xs">Linha do Tempo do Ciclo</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      historicoUltimoTeste.status === 'pago'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}
                  >
                    {historicoUltimoTeste.status === 'pago'
                      ? 'PAGAMENTO CONFIRMADO ✅'
                      : 'Aguardando pagamento'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {historicoUltimoTeste.status !== 'pago' && testePixData && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setModalTestePixOpen(true)}
                      className="h-7 text-[11px] font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    >
                      Ver QR Code Pendente
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGerarCobrancaTestePix}
                    disabled={gerandoTestePix}
                    className="h-7 text-[11px] font-semibold text-slate-700 border-slate-300 hover:bg-slate-100"
                  >
                    Novo teste
                  </Button>
                </div>
              </div>

              {/* LINHA DO TEMPO DO CICLO: 1. Cobrança criada (hora/ID) → 2. Pagamento detectado (hora) → 3. Webhook processado (hora) */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">
                      1. Cobrança criada
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {formatarDataIso(historicoUltimoTeste.criadoEm)}
                    </span>
                    <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate font-semibold">
                      ID: {historicoUltimoTeste.asaas_id || 'Asaas v3'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                      historicoUltimoTeste.status === 'pago'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-400 text-amber-950'
                    }`}
                  >
                    2
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">
                      2. Pagamento detectado
                    </span>
                    <span className="text-[11px] font-mono">
                      {historicoUltimoTeste.status === 'pago' ? (
                        <strong className="text-emerald-700">
                          {formatarDataIso(
                            historicoUltimoTeste.pagoEm || historicoUltimoTeste.webhookProcessadoEm,
                          )}
                        </strong>
                      ) : (
                        <span className="text-amber-600">Aguardando pagamento</span>
                      )}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {historicoUltimoTeste.status === 'pago'
                        ? 'PIX R$ 5,00 recebido'
                        : 'Aguardando PIX'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                      historicoUltimoTeste.status === 'pago'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    3
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">
                      3. Webhook processado
                    </span>
                    <span className="text-[11px] font-mono">
                      {historicoUltimoTeste.status === 'pago' ? (
                        <strong className="text-emerald-700">
                          {formatarDataIso(
                            historicoUltimoTeste.webhookProcessadoEm || historicoUltimoTeste.pagoEm,
                          )}
                        </strong>
                      ) : (
                        <span className="text-slate-400">Aguardando disparo</span>
                      )}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {historicoUltimoTeste.status === 'pago'
                        ? 'Token validado / 200 OK'
                        : 'Sem ativação de plano'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-between">
              <span>
                Nenhum teste de validação executado ainda nesta conta. Clique no botão acima para
                iniciar seu primeiro ciclo real.
              </span>
            </div>
          )}{' '}
        </CardContent>
      </Card>

      {/* SEÇÃO DO WEBHOOK */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-600" />
                <span>Configuração de Webhooks na Asaas</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                O Webhook é o canal por onde a Asaas avisa o OrçaFácil quando um cliente faz o PIX
                no banco.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <Button
                type="button"
                onClick={handleReativarFilaWebhook}
                disabled={reativandoFila || loading}
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-semibold shadow-sm gap-1.5"
              >
                {reativandoFila ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="w-4 h-4 text-white" />
                )}
                {reativandoFila ? 'Reativando na Asaas...' : 'Reativar Fila na Asaas'}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setNovoTokenGerado(null)
                  setModalRegenerarTokenOpen(true)
                }}
                variant="outline"
                className="border-slate-300 hover:bg-slate-100 text-xs h-9 font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                Regenerar Token do Webhook
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          {/* BANNER DE STATUS REAL DO WEBHOOK NA ASAAS */}
          {status?.webhook?.status_real && (
            <div
              className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                status.webhook.status_real.interrupted
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : status.webhook.status_real.status === 'Ativado'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {status.webhook.status_real.interrupted ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                ) : status.webhook.status_real.status === 'Ativado' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">
                      Status Real no Painel Asaas: {status.webhook.status_real.status}
                    </span>
                    {status.webhook.status_real.webhook_id && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/70 border border-current">
                        ID: {status.webhook.status_real.webhook_id}
                      </span>
                    )}
                    {status.webhook.status_real.nome && (
                      <span className="text-[11px] opacity-80">
                        • {status.webhook.status_real.nome}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs opacity-90">{status.webhook.status_real.mensagem}</p>
                </div>
              </div>

              {status.webhook.status_real.interrupted && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleReativarFilaWebhook}
                  disabled={reativandoFila}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 self-stretch sm:self-auto gap-1 shadow-sm"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  Reativar Imediatamente
                </Button>
              )}
            </div>
          )}

          {/* URL DO WEBHOOK PARA COPIAR */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              URL Oficial do Webhook (Cole no painel da Asaas):
            </Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={urlWebhookExibicao}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                onFocus={(e) => (e.target as HTMLInputElement).select()}
                className="font-mono text-xs bg-slate-50 text-slate-800 select-all cursor-text focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
              <Button
                type="button"
                onClick={handleCopiarUrlWebhook}
                variant={copiadoUrl ? 'default' : 'outline'}
                className={`shrink-0 gap-1.5 text-xs font-semibold transition-all ${
                  copiadoUrl
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {copiadoUrl ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-600" />
                )}
                {copiadoUrl ? 'Copiado!' : 'Copiar URL'}
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              No painel Asaas, acesse:{' '}
              <strong>Minha Conta → Integrações → Webhooks para Cobranças</strong> e informe a URL
              acima. (O texto do campo é selecionável com duplo clique ou clique simples).
            </p>
          </div>

          {/* STATUS E CONTROLES DO TOKEN DE WEBHOOK */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 block">
                    Token de Autenticação do Webhook
                  </span>
                  {status?.webhook?.token_configurado ? (
                    <Badge
                      translate="no"
                      className="notranslate bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]"
                    >
                      Ativo
                    </Badge>
                  ) : (
                    <Badge
                      translate="no"
                      variant="outline"
                      className="notranslate text-amber-700 border-amber-300 bg-amber-50 text-[10px]"
                    >
                      Sem token
                    </Badge>
                  )}
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Valor enviado no cabeçalho HTTP{' '}
                  <code
                    translate="no"
                    className="notranslate bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]"
                  >
                    asaas-access-token
                  </code>{' '}
                  para certificar que a requisição partiu legitimamente da Asaas.
                </p>
              </div>

              {/* BOTÕES DE AÇÃO: COPIAR, REVELAR/OCULTAR E REGENERAR */}
              <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto">
                <Button
                  type="button"
                  onClick={handleCopiarTokenCard}
                  disabled={revelandoToken || loading}
                  variant={copiadoTokenCard ? 'default' : 'outline'}
                  className={`h-8 text-xs font-semibold gap-1.5 transition-all ${
                    copiadoTokenCard
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {copiadoTokenCard ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  {copiadoTokenCard ? 'Copiado!' : 'Copiar Token'}
                </Button>

                <Button
                  type="button"
                  onClick={handleToggleRevelarToken}
                  disabled={revelandoToken || loading}
                  variant="outline"
                  className="h-8 text-xs font-semibold gap-1.5 border-slate-300 hover:bg-slate-100 text-slate-700"
                >
                  {revelandoToken ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : mostrarToken ? (
                    <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  {revelandoToken ? 'Carregando...' : mostrarToken ? 'Ocultar' : 'Revelar Token'}
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    setNovoTokenGerado(null)
                    setModalRegenerarTokenOpen(true)
                  }}
                  variant="outline"
                  className="h-8 text-xs font-semibold gap-1.5 border-slate-300 hover:bg-slate-100 text-indigo-700 hover:text-indigo-800"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                  Regenerar Token
                </Button>
              </div>
            </div>

            {/* CAMPO DE EXIBIÇÃO DO TOKEN COM MÁSCARA OU VALOR REVELADO */}
            <div className="pt-2 border-t border-slate-200/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  translate="no"
                  value={
                    mostrarToken && tokenRevelado
                      ? tokenRevelado
                      : status?.webhook?.token_mascarado || '••••••••••••••••••••••••'
                  }
                  onClick={(e) => {
                    if (mostrarToken) (e.target as HTMLInputElement).select()
                  }}
                  className={`notranslate font-mono text-xs select-all cursor-text transition-colors ${
                    mostrarToken
                      ? 'bg-white text-slate-900 border-indigo-300 ring-1 ring-indigo-200 font-bold'
                      : 'bg-slate-100/80 text-slate-600 border-slate-200'
                  }`}
                />
              </div>

              {mostrarToken && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Token revelado apenas para jaocarloss@gmail.com</span>
                </div>
              )}
            </div>
          </div>

          {/* EVENTOS OBRIGATÓRIOS A MARCAR NA ASAAS */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700">
              Eventos que DEVEM ser marcados na Asaas:
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                {
                  code: 'PAYMENT_RECEIVED',
                  label: 'Pagamento Recebido',
                  desc: 'Ativa o plano e envia comprovante por e-mail',
                },
                {
                  code: 'PAYMENT_CONFIRMED',
                  label: 'Pagamento Confirmado',
                  desc: 'Garante a renovação em caso de confirmação bancária tardia',
                },
                {
                  code: 'PAYMENT_OVERDUE',
                  label: 'Cobrança Vencida',
                  desc: 'Cancela cobrança PIX que expirou sem pagamento',
                },
                {
                  code: 'PAYMENT_REFUNDED',
                  label: 'Pagamento Estornado',
                  desc: 'Bloqueia o plano em caso de estorno',
                },
                {
                  code: 'PAYMENT_DELETED',
                  label: 'Cobrança Removida',
                  desc: 'Sincroniza cancelamento manual de cobrança',
                },
              ].map((ev) => (
                <div
                  key={ev.code}
                  className="p-3 rounded-xl border border-slate-200 bg-white text-xs flex flex-col justify-between"
                >
                  <div
                    translate="no"
                    className="notranslate flex items-center gap-1.5 font-bold text-slate-900"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{ev.label}</span>
                  </div>
                  <div
                    translate="no"
                    className="notranslate font-mono text-[10px] text-blue-600 mt-1"
                  >
                    {ev.code}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{ev.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: ATUALIZAR CHAVE DE API (ROTAÇÃO SEGURA) */}
      <Dialog open={modalAtualizarChaveOpen} onOpenChange={setModalAtualizarChaveOpen}>
        <DialogContent className="max-w-[520px] rounded-3xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
              <KeyRound className="w-5 h-5 text-blue-600" />
              <span>Atualizar Chave da API Asaas (Rotação)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              A nova chave substituirá a atual no cofre criptografado do backend. A chave nunca será
              exposta publicamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label htmlFor="nova-chave" className="text-xs font-bold text-slate-700">
                Nova Chave de API Asaas (Access Token):
              </Label>
              <div className="relative">
                <Input
                  id="nova-chave"
                  type={mostrarNovaChave ? 'text' : 'password'}
                  placeholder="$aact_YTU5YTE0M2M2N2I4MTliN..."
                  value={novaChaveInput}
                  onChange={(e) => setNovaChaveInput(e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setMostrarNovaChave((prev) => !prev)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  tabIndex={-1}
                >
                  {mostrarNovaChave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Obtenha em: <strong>Asaas → Minha Conta → Integrações → Gerar chave de API</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <input
                type="checkbox"
                id="check-testar"
                checked={testarAntesDeSalvar}
                onChange={(e) => setTestarAntesDeSalvar(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300"
              />
              <Label htmlFor="check-testar" className="text-xs text-slate-700 cursor-pointer">
                <strong>Testar chave contra a Asaas antes de salvar</strong> (recomendado para
                evitar salvar chaves inválidas)
              </Label>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Assim que você salvar, as próximas cobranças PIX geradas no checkout utilizarão esta
                nova chave imediatamente.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={salvandoChave}
              onClick={() => setModalAtualizarChaveOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={salvandoChave || !novaChaveInput.trim()}
              onClick={handleSalvarNovaChave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {salvandoChave ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Validando e Salvando...
                </>
              ) : (
                'Salvar e Ativar Chave'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: REGENERAR TOKEN DO WEBHOOK */}
      <Dialog open={modalRegenerarTokenOpen} onOpenChange={setModalRegenerarTokenOpen}>
        <DialogContent className="max-w-[520px] rounded-3xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
              <RefreshCw className="w-5 h-5 text-indigo-600" />
              <span>Regenerar Token do Webhook</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Gera uma nova assinatura criptográfica para o webhook. Você precisará atualizar esse
              token na Asaas para continuar recebendo avisos de pagamento.
            </DialogDescription>
          </DialogHeader>

          {!novoTokenGerado ? (
            <div className="space-y-4 my-2 text-xs text-slate-700">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Atenção:</strong> Ao regenerar o token, a Asaas precisará ser configurada
                  com o novo valor no campo <strong>"Token de autenticação"</strong> da aba
                  Webhooks, caso contrário as confirmações bancárias automáticas serão rejeitadas
                  até a atualização.
                </p>
              </div>

              <p>Deseja prosseguir com a geração do novo token agora?</p>

              <DialogFooter className="gap-2 sm:gap-0 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={regenerandoToken}
                  onClick={() => setModalRegenerarTokenOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={regenerandoToken}
                  onClick={handleRegenerarTokenWebhook}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {regenerandoToken ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    'Sim, Gerar Novo Token'
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 my-2 text-xs">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Novo Token Criado com Sucesso!</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  ⚠️ Por segurança, este valor completo só será exibido{' '}
                  <strong>UMA ÚNICA VEZ</strong> nesta tela. Copie agora e cole no portal Asaas.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Seu Novo Token:</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={novoTokenGerado}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    onFocus={(e) => (e.target as HTMLInputElement).select()}
                    className="font-mono text-xs bg-slate-100 text-slate-900 select-all font-bold cursor-text focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                  <Button
                    type="button"
                    onClick={handleCopiarNovoToken}
                    className={`font-bold shrink-0 text-xs transition-all ${
                      copiadoNovoToken
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {copiadoNovoToken ? (
                      <CheckCircle2 className="w-4 h-4 mr-1 text-white" />
                    ) : (
                      <Copy className="w-4 h-4 mr-1" />
                    )}
                    {copiadoNovoToken ? 'Copiado!' : 'Copiar Token'}
                  </Button>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  onClick={() => setModalRegenerarTokenOpen(false)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Concluir e Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 3: COBRANÇA PIX DE TESTE REAL (R$ 5,00) */}
      <Dialog
        open={modalTestePixOpen}
        onOpenChange={(open) => {
          if (!open) handleFecharModalTeste()
          else setModalTestePixOpen(true)
        }}
      >
        <DialogContent className="max-w-[480px] rounded-3xl bg-white p-6 max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                <QrCode className="w-5 h-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Cobrança PIX de Teste (R$ 5,00)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Gerada diretamente na API Asaas para homologação do webhook
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {testePixData && (
            <div className="space-y-4 my-2 text-xs">
              {/* STATUS DINÂMICO DO PAGAMENTO */}
              {testeConfirmado || testePixData.status === 'pago' ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 flex flex-col items-center text-center gap-2 animate-bounce-short">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-sm">
                    ✅
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-emerald-900 uppercase tracking-wide">
                      PAGAMENTO CONFIRMADO ✅
                    </h3>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                      O webhook da Asaas foi recebido e validado com sucesso pelo servidor! O ciclo
                      ponta-a-ponta está 100% aprovado.
                    </p>
                  </div>
                  <Badge className="bg-emerald-600 text-white border-none font-bold text-xs py-1 px-3">
                    Ciclo Real Validado
                  </Badge>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw
                      className={`w-4 h-4 text-amber-600 ${pollingTesteAtivo ? 'animate-spin' : ''}`}
                    />
                    <div>
                      <span className="font-bold block">Aguardando pagamento</span>
                      <span className="text-[11px] text-amber-800">
                        Checando confirmação bancária automaticamente a cada 5s
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] uppercase font-bold shrink-0">
                    Aguardando pagamento
                  </Badge>
                </div>
              )}

              {/* CARD DE VALOR E DESCRIÇÃO */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">
                    Valor da cobrança de teste:
                  </span>
                  <span className="text-xl font-black text-slate-900">
                    R${' '}
                    {Number(testePixData.valor || 5)
                      .toFixed(2)
                      .replace('.', ',')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Ref: {testePixData.referencia || 'OF-TESTE'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ID: {testePixData.asaas_id}
                  </span>
                </div>
              </div>

              {/* EXIBIÇÃO DO QR CODE PIX */}
              {!(testeConfirmado || testePixData.status === 'pago') && (
                <>
                  {testePixData.pix_qr_code_base64 ? (
                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border-2 border-dashed border-emerald-300">
                      <img
                        src={testePixData.pix_qr_code_base64}
                        alt="QR Code PIX R$ 5,00"
                        className="w-48 h-48 object-contain rounded-lg"
                      />
                      <span className="text-[11px] text-slate-500 mt-2 font-medium">
                        Escaneie com o app de qualquer banco
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-100 text-center text-slate-600">
                      QR Code não disponível em imagem. Utilize o código copia-e-cola abaixo.
                    </div>
                  )}

                  {/* CÓDIGO PIX COPIA E COLA */}
                  {testePixData.pix_copia_cola &&
                    (() => {
                      const payloadNormalizado = normalizarOuRepararPixPayload(
                        testePixData.pix_copia_cola,
                      )
                      const payloadParaUso =
                        payloadNormalizado.payload ||
                        sanitizarPixPayload(testePixData.pix_copia_cola)
                      const validacao = validarPixPayload(payloadParaUso)

                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-slate-700">
                              Código PIX Copia e Cola (BR Code Oficial):
                            </Label>
                            {validacao.valido ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                                ✓ CRC16 Válido ({validacao.crcAtual})
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                                ⚠️ Requer Reparo
                              </Badge>
                            )}
                          </div>

                          {!validacao.valido && (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold">Aviso sobre o código recebido:</p>
                                <p className="text-[10px] mt-0.5">{validacao.motivo}</p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const reparado = normalizarOuRepararPixPayload(
                                    testePixData.pix_copia_cola,
                                  )
                                  setTestePixData((prev) =>
                                    prev ? { ...prev, pix_copia_cola: reparado.payload } : null,
                                  )
                                  toast({
                                    title: 'Checksum CRC16 corrigido!',
                                    description: `Código recalculado com sucesso (CRC: ${reparado.crc}).`,
                                  })
                                }}
                                className="text-[10px] h-7 px-2 shrink-0 border-amber-300 hover:bg-amber-100 text-amber-950 font-bold"
                              >
                                Corrigir CRC16
                              </Button>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row gap-2">
                            <textarea
                              readOnly
                              rows={3}
                              value={payloadParaUso}
                              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                              onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
                              className="w-full p-2.5 rounded-lg font-mono text-[11px] leading-relaxed bg-slate-50 border border-slate-200 text-slate-900 select-all cursor-text resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 break-all font-semibold"
                              style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
                              aria-label="Código PIX Copia e Cola"
                            />
                            <Button
                              type="button"
                              onClick={handleCopiarPixTeste}
                              className={`font-bold shrink-0 text-xs transition-all self-stretch sm:self-auto sm:h-auto py-2.5 px-4 ${
                                copiadoPixTeste
                                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              {copiadoPixTeste ? (
                                <CheckCircle2 className="w-4 h-4 mr-1.5 text-white shrink-0" />
                              ) : (
                                <Copy className="w-4 h-4 mr-1.5 shrink-0" />
                              )}
                              {copiadoPixTeste ? 'Copiado!' : 'Copiar código PIX'}
                            </Button>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Código completo sem truncamento. Toque na caixa para selecionar tudo ou
                            use &quot;Copiar código PIX&quot;.
                          </p>
                        </div>
                      )
                    })()}

                  {/* LINK EXTERNO DA FATURA ASAAS */}
                  {testePixData.invoice_url && (
                    <div className="text-center pt-1">
                      <a
                        href={testePixData.invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        Abrir fatura oficial no Asaas
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </>
              )}

              {/* INSTRUÇÃO FINAL */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                ℹ️ Esta cobrança de teste de R$ 5,00 não ativa planos de clientes e não envia
                recibos de venda por e-mail. Ela é tratada de forma segura para validar apenas o
                canal de webhooks.
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              onClick={handleFecharModalTeste}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold"
            >
              {testeConfirmado || testePixData?.status === 'pago'
                ? 'Fechar e Concluir'
                : 'Fechar Janela'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
