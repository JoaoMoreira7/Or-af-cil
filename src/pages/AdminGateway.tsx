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
import { gatewayPagamentoService } from '@/services/gatewayPagamento'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { COMPANY_LEGAL } from '@/config/company'

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
  webhook: {
    url: string
    token_configurado: boolean
    token_mascarado: string
    token_origem: string
    eventos_obrigatorios: string[]
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

  // Cópia
  const [copiadoUrl, setCopiadoUrl] = useState<boolean>(false)
  const [copiadoNovoToken, setCopiadoNovoToken] = useState<boolean>(false)
  const timerCopiadoUrlRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerCopiadoTokenRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    carregarStatus()
  }, [])

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

        {/* CARD 3: STATUS DO WEBHOOK */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Segurança do Webhook
            </CardTitle>
            <Globe className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="text-sm text-slate-400">Verificando...</div>
              ) : status?.webhook.token_configurado ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-base font-bold text-slate-900">
                    {status.webhook.token_mascarado}
                  </span>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] ml-auto">
                    Protegido
                  </Badge>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-700">Sem Token Gravado</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {status?.webhook.token_configurado
                ? 'Requisições sem token válido são rejeitadas'
                : 'Recomendado gerar um token para evitar fraudes'}
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

            <Button
              type="button"
              onClick={() => {
                setNovoTokenGerado(null)
                setModalRegenerarTokenOpen(true)
              }}
              variant="outline"
              className="border-slate-300 hover:bg-slate-100 text-xs h-9 font-semibold self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Regenerar Token do Webhook
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
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

          {/* STATUS DO TOKEN ATUAL */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-900 block">
                Token de Autenticação do Webhook
              </span>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Valor enviado no cabeçalho HTTP{' '}
                <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">
                  asaas-access-token
                </code>{' '}
                para certificar que a requisição partiu legitimamente da Asaas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {status?.webhook?.token_configurado ? (
                <>
                  <span
                    translate="no"
                    className="notranslate font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded-md border border-slate-200"
                  >
                    {status.webhook.token_mascarado}
                  </span>
                  <Badge
                    translate="no"
                    className="notranslate bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]"
                  >
                    Ativa
                  </Badge>
                </>
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
    </div>
  )
}
