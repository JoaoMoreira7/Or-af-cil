import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  Users,
  CreditCard,
  DollarSign,
  Clock,
  ShieldCheck,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Mail,
  Send,
  Sparkles,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { adminService } from '@/services/admin'
import { resumoSemanalService } from '@/services/resumoSemanal'
import { useAuth } from '@/contexts/AuthContext'
import { AdminMetricas, UsuarioAssinanteAdmin, formatarMoedaBRL, formatarData } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { PLANO_CONFIG } from '@/config/plans'

export default function Admin() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [metricas, setMetricas] = useState<AdminMetricas | null>(null)
  const [assinantes, setAssinantes] = useState<UsuarioAssinanteAdmin[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'trial' | 'expirado'>(
    'todos',
  )

  // Estado para disparo de e-mail de teste do Resumo Semanal
  const { user } = useAuth()
  const isMountedRef = useRef(true)
  const isDono = user?.email?.toLowerCase().trim() === 'jaocarloss@gmail.com'
  const [emailTeste, setEmailTeste] = useState<string>(user?.email || 'jaocarloss@gmail.com')
  const [enviandoTeste, setEnviandoTeste] = useState<boolean>(false)

  useEffect(() => {
    isMountedRef.current = true
    if (user?.email && !emailTeste) {
      setEmailTeste(user.email)
    }
    return () => {
      isMountedRef.current = false
    }
  }, [user?.email, emailTeste])

  const carregarDados = async () => {
    setLoading(true)
    try {
      const res = await adminService.obterUsuariosEPlanos()
      setMetricas(res.metricas)
      setAssinantes(res.assinantes)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar dados do painel'
      toast({
        title: 'Erro ao carregar dados',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  const handleDispararEmailTeste = async (e: React.FormEvent) => {
    e.preventDefault()
    const emailDest = emailTeste.trim()
    if (!emailDest || !emailDest.includes('@')) {
      toast({
        title: 'E-mail inválido',
        description: 'Por favor, informe um endereço de e-mail válido para o disparo de teste.',
        variant: 'destructive',
      })
      return
    }

    setEnviandoTeste(true)
    try {
      const res = await resumoSemanalService.dispararTesteEmail(emailDest)
      if (isMountedRef.current) {
        toast({
          title: 'Disparo de teste realizado!',
          description:
            res.mensagem ||
            `E-mail do Resumo da Semana enviado com sucesso para ${emailDest} (Semana ${res.chave_semana || 'atual'}).`,
        })
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Falha ao processar disparo de teste do resumo semanal'
        toast({
          title: 'Erro no disparo de teste',
          description: msg,
          variant: 'destructive',
        })
      }
    } finally {
      if (isMountedRef.current) {
        setEnviandoTeste(false)
      }
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const assinantesFiltrados = useMemo(() => {
    return assinantes.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'todos' ? true : item.planoStatus === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [assinantes, searchTerm, statusFilter])

  const renderBadgeStatus = (usuario: UsuarioAssinanteAdmin) => {
    if (usuario.planoStatus === 'ativo') {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-300 font-medium flex items-center gap-1 w-fit">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ativo
        </Badge>
      )
    }
    if (usuario.planoStatus === 'trial') {
      const dias = usuario.diasRestantesTrial ?? 0
      return (
        <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-300 font-medium flex items-center gap-1 w-fit">
          <Clock className="w-3 h-3 text-amber-600" />
          Teste ({dias} {dias === 1 ? 'dia' : 'dias'})
        </Badge>
      )
    }
    return (
      <Badge className="bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 border-rose-300 font-medium flex items-center gap-1 w-fit">
        <XCircle className="w-3 h-3 text-rose-600" /> Expirado
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DO PAINEL ADMIN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-lg bg-blue-600/10 text-blue-600">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Painel do Administrador
            </h2>
            <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-xs">
              Acesso Restrito
            </Badge>
            {isDono && (
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs font-bold">
                👑 Dono da Plataforma
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Visão consolidada de usuários cadastrados, períodos de teste grátis e assinaturas
            ativas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* BOTÃO EXCLUSIVO DO DONO: PAINEL DE VENDAS */}
          {isDono && (
            <Button
              type="button"
              onClick={() => navigate('/admin/vendas')}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm h-9 px-3.5 shadow-sm gap-1.5"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Controle de Vendas</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}

          <Button
            onClick={carregarDados}
            disabled={loading}
            variant="outline"
            className="border-slate-300 hover:bg-slate-100 self-start sm:self-auto gap-2 h-9"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* BANNER DE DESTAQUE PARA O DONO SE ESTIVER NA TELA ADMIN */}
      {isDono && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 text-slate-800 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5 sm:mt-0 shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm">
                Área Exclusiva: Controle Financeiro & Histórico de Vendas
              </span>
              <p className="text-xs text-slate-600 mt-0.5">
                Você tem acesso exclusivo ao registro completo de vendas (PIX, Cartão, Boleto),
                métricas de receita acumulada e ações manuais de cancelamento/reativação.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/admin/vendas')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs whitespace-nowrap self-stretch sm:self-auto shadow-xs"
          >
            Acessar Controle de Vendas
          </Button>
        </div>
      )}

      {/* CARD DE TESTE DO RESUMO DA SEMANA */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-blue-100/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
                <Mail className="w-4 h-4" />
              </span>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Disparo de Teste: Resumo Semanal por E-mail</span>
                  <Badge
                    variant="outline"
                    className="border-blue-300 bg-blue-100/60 text-blue-700 text-[10px] font-semibold"
                  >
                    <Sparkles className="w-3 h-3 mr-1 text-blue-600" />
                    IA OrçaFácil
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  Valide a entrega e a formatação do e-mail do resumo semanal antes do envio oficial
                  na próxima segunda-feira (12:00 UTC).
                </CardDescription>
              </div>
            </div>

            <Badge
              variant="secondary"
              className="bg-white/90 text-slate-700 border-slate-200 text-[11px] self-start sm:self-auto"
            >
              Sem bloquear o cron
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleDispararEmailTeste} className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <Input
                  type="email"
                  required
                  placeholder="admin@exemplo.com"
                  value={emailTeste}
                  onChange={(e) => setEmailTeste(e.target.value)}
                  disabled={enviandoTeste}
                  className="pl-9 text-xs sm:text-sm h-10 border-blue-200 bg-white focus-visible:ring-blue-500"
                />
              </div>

              <Button
                type="submit"
                disabled={enviandoTeste}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium h-10 px-5 gap-2 shadow-xs transition-all whitespace-nowrap"
              >
                {enviandoTeste ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Gerando & Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar e-mail de teste do Resumo da Semana
                  </>
                )}
              </Button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              💡 <strong>Como funciona:</strong> O backend compila os números reais dos últimos 7
              dias (orçamentos fechados, novas propostas, clientes e valores a receber), aplica a IA
              com a persona cadastrada e dispara o e-mail HTML idêntico ao modelo de produção, sem
              gravar trava anti-duplicidade na coleção{' '}
              <code className="font-mono bg-blue-100/60 px-1 py-0.5 rounded text-blue-900">
                resumos_semanais_enviados
              </code>
              .
            </p>
          </form>
        </CardContent>
      </Card>

      {/* CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL DE USUÁRIOS */}
        <Card className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total de Usuários
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '...' : metricas?.totalUsuarios || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Contas cadastradas no sistema</span>
            </p>
          </CardContent>
        </Card>

        {/* USUÁRIOS EM TESTE GRÁTIS */}
        <Card className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Em Teste Grátis
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {loading ? '...' : metricas?.totalEmTrial || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Período de avaliação de 7 dias</span>
            </p>
          </CardContent>
        </Card>

        {/* ASSINANTES ATIVOS */}
        <Card className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Assinantes Ativos
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {loading ? '...' : metricas?.totalAtivos || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Assinantes com acesso liberado</span>
            </p>
          </CardContent>
        </Card>

        {/* RECEITA MENSAL ESTIMADA */}
        <Card className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Receita Mensal Estimada
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">
              {loading ? '...' : formatarMoedaBRL(metricas?.receitaMensalEstimada || 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Ponderada pelos planos ativos</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* LISTA / TABELA DE ASSINANTES E USUÁRIOS */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Lista de Usuários e Assinantes
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Acompanhe o status do plano, datas de renovação e término de teste de cada conta.
              </CardDescription>
            </div>

            {/* FILTROS E BUSCA */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                <Input
                  placeholder="Buscar por nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-xs h-9 w-full sm:w-64 border-slate-200"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setStatusFilter('todos')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === 'todos'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ativo')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === 'ativo'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ativos
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('trial')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === 'trial'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Em Teste
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('expirado')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === 'expirado'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Expirados
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-sm">Carregando usuários e assinaturas...</p>
            </div>
          ) : assinantesFiltrados.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <p className="text-sm font-medium text-slate-700">Nenhum registro encontrado</p>
              <p className="text-xs text-slate-400 mt-1">
                Tente ajustar os filtros ou o termo de busca.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Função</th>
                    <th className="py-3 px-4">Plano</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Dias Restantes (Trial)</th>
                    <th className="py-3 px-4">Renovação / Vencimento</th>
                    <th className="py-3 px-4">Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {assinantesFiltrados.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* USUÁRIO */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{item.email}</div>
                      </td>

                      {/* FUNÇÃO */}
                      <td className="py-3 px-4">
                        {item.admin ? (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-semibold text-[10px]">
                            Administrador
                          </Badge>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Cliente</span>
                        )}
                      </td>

                      {/* PLANO */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">{item.planoNome}</span>
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-4">{renderBadgeStatus(item)}</td>

                      {/* DIAS RESTANTES */}
                      <td className="py-3 px-4">
                        {item.planoStatus === 'trial' ? (
                          <span className="font-semibold text-amber-700">
                            {item.diasRestantesTrial === 0
                              ? 'Último dia'
                              : `${item.diasRestantesTrial} ${item.diasRestantesTrial === 1 ? 'dia' : 'dias'}`}
                          </span>
                        ) : item.planoStatus === 'ativo' ? (
                          <span className="text-slate-400">— (Assinante Ativo)</span>
                        ) : (
                          <span className="text-rose-600 font-medium">Expirado</span>
                        )}
                      </td>

                      {/* DATA DE RENOVAÇÃO / VENCIMENTO */}
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {item.planoStatus === 'ativo' && item.renovacaoEm
                          ? formatarData(item.renovacaoEm)
                          : item.planoStatus === 'trial' && item.trialAte
                            ? formatarData(item.trialAte)
                            : '—'}
                      </td>

                      {/* CADASTRO */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {formatarData(item.created)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CARD DE INFORMAÇÕES DO SISTEMA E POLÍTICA DE COBRANÇA */}
      <div className="p-4 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Modelo de Cobrança & Notificação
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
            O sistema opera com a escada de 3 planos: Essencial (R$ 49,90), Profissional (R$ 64,90)
            e Premium (R$ 79,90) via gateway oficial Asaas. O cron job automático dispara e-mails de
            alerta com os 3 planos aos usuários com 2 dias de teste restantes.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="text-slate-300 border-slate-700 bg-slate-800">
            Cron diário às 09:00 UTC
          </Badge>
        </div>
      </div>
    </div>
  )
}
