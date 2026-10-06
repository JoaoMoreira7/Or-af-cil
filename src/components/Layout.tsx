import React, { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Users,
  PlusCircle,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  Bell,
  Menu,
  X,
  Sparkles,
  Volume2,
  Mic,
  MoreHorizontal,
  AudioLines,
  Radio,
  DollarSign,
  Camera,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { TrialExpiredPaywall } from '@/components/TrialExpiredPaywall'
import { Button } from '@/components/ui/button'
import { PLANO_CONFIG } from '@/config/plans'

export default function Layout() {
  const { user, logout } = useAuth()
  const { isBloqueado, isTrial, diasRestantesTrial, isAtivo } = useSubscription()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  // Rotas isentas de bloqueio por paywall: Planos, Configurações e Admin
  const isRotaLiberada =
    location.pathname === '/planos' ||
    location.pathname === '/configuracoes' ||
    location.pathname === '/admin' ||
    location.pathname === '/admin/vendas'
  const deveExibirPaywall = isBloqueado && !isRotaLiberada

  // Mapeamento dinâmico de títulos por rota
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/dashboard') return 'Dashboard'
    if (path === '/admin') return 'Painel do Administrador'
    if (path === '/admin/vendas') return 'Controle de Vendas (Dono)'
    if (path === '/orcamentos') return 'Orçamentos'
    if (path === '/orcamentos/novo') return 'Novo Orçamento com IA'
    if (path.startsWith('/orcamentos/') && path.endsWith('/editar')) return 'Editar Orçamento'
    if (path.startsWith('/orcamentos/')) return 'Detalhe do Orçamento'
    if (path === '/contas-a-receber') return 'Contas a Receber'
    if (path === '/clientes') return 'Clientes'
    if (path === '/audios') return 'Histórico de Ditados & Áudios'
    if (path === '/modo-voz') return 'Modo Voz — Só Falar'
    if (path === '/assistente-campo') return 'Assistente de Campo (Fotos & Notas)'
    if (path === '/gastos') return 'Gastos & Despesas'
    if (path === '/planos') return 'Planos e Assinatura'
    if (path === '/configuracoes') return 'Configurações da Conta'
    return 'OrçaFácil'
  }

  type NavItem = {
    label: string
    path: string
    icon: React.ComponentType<{ className?: string }>
    isCta?: boolean
    isAdmin?: boolean
  }

  const baseNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Orçamentos', path: '/orcamentos', icon: FileText },
    { label: 'Contas a Receber', path: '/contas-a-receber', icon: DollarSign },
    { label: 'Gastos', path: '/gastos', icon: DollarSign },
    { label: 'Assistente de Campo', path: '/assistente-campo', icon: Camera },
    { label: 'Modo Voz', path: '/modo-voz', icon: Mic },
    { label: 'Áudios', path: '/audios', icon: AudioLines },
    { label: 'Clientes', path: '/clientes', icon: Users },
    { label: 'Novo Orçamento', path: '/orcamentos/novo', icon: PlusCircle, isCta: true },
    { label: 'Planos', path: '/planos', icon: CreditCard },
    { label: 'Configurações', path: '/configuracoes', icon: Settings },
  ]

  const isDono = user?.email?.toLowerCase().trim() === 'jaocarloss@gmail.com'

  let navItems: NavItem[] = [...baseNavItems]
  if (user?.admin) {
    navItems.push({ label: 'Admin', path: '/admin', icon: Shield, isAdmin: true })
  }
  if (isDono) {
    navItems.push({
      label: 'Vendas (Dono)',
      path: '/admin/vendas',
      icon: DollarSign,
      isAdmin: true,
    })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getInitials = (name?: string) => {
    if (!name) return 'OF'
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() || '')
      .join('')
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* DESKTOP SIDEBAR (264px) / TABLET RAIL (72px) */}
      <aside className="no-print hidden md:flex flex-col fixed top-0 bottom-0 left-0 z-30 bg-[#0F172A] text-slate-300 md:w-[72px] lg:w-[264px] border-r border-slate-800 transition-all duration-300">
        {/* LOGO AREA */}
        <div className="h-16 flex items-center px-4 lg:px-6 border-b border-slate-800/80">
          <div
            className="flex items-center gap-3 overflow-hidden cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shrink-0">
              OF
            </div>
            <div className="hidden lg:flex flex-col">
              <span className="font-bold text-white text-base tracking-tight leading-none">
                OrçaFácil
              </span>
              <span className="text-[11px] text-slate-400 font-medium tracking-wide uppercase mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-violet-400" /> Gestão & IA
              </span>
            </div>
          </div>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 py-4 px-2 lg:px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.path === '/orcamentos/novo'
                ? location.pathname === '/orcamentos/novo'
                : item.path === '/orcamentos'
                  ? location.pathname.startsWith('/orcamentos') &&
                    location.pathname !== '/orcamentos/novo'
                  : location.pathname === item.path

            if (item.isCta) {
              return (
                <div key={item.path} className="py-2">
                  <NavLink
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white ring-2 ring-blue-500/30'
                        : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:brightness-110 active:scale-[0.98]'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </NavLink>
                </div>
              )
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* SIDEBAR FOOTER (USER & LOGOUT) */}
        <div className="p-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow">
                {getInitials(user?.name)}
              </div>
              <div className="hidden lg:flex flex-col truncate">
                <span className="text-xs font-semibold text-white truncate">
                  {user?.name || 'Usuário'}
                </span>
                <span className="text-[11px] text-slate-400 truncate">{user?.email}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-md hover:bg-slate-800 transition-colors"
              title="Sair do sistema"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER MODAL */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-[280px] max-w-full bg-[#0F172A] text-slate-300 p-4 shadow-2xl z-10">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-base">
                  OF
                </div>
                <span className="font-bold text-white text-base">OrçaFácil</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.path === '/orcamentos/novo'
                    ? location.pathname === '/orcamentos/novo'
                    : item.path === '/orcamentos'
                      ? location.pathname.startsWith('/orcamentos') &&
                        location.pathname !== '/orcamentos/novo'
                      : location.pathname === item.path

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      item.isCta
                        ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold'
                        : isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {getInitials(user?.name)}
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-400"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col md:pl-[72px] lg:pl-[264px] min-h-screen">
        {/* FIXED HEADER WITH BACKDROP BLUR */}
        <header className="no-print sticky top-0 z-20 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 md:hidden rounded-lg hover:bg-slate-100"
              aria-label="Abrir menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* BADGE DE DIAS RESTANTES NO HEADER */}
            {isTrial && (
              <div
                onClick={() => navigate('/planos')}
                className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-800 cursor-pointer hover:bg-amber-100 transition-colors"
                title="Clique para ver os detalhes do plano"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Teste grátis:{' '}
                  <strong>
                    {diasRestantesTrial === 0
                      ? 'Hoje é o último dia'
                      : `${diasRestantesTrial} ${diasRestantesTrial === 1 ? 'dia restante' : 'dias restantes'}`}
                  </strong>
                </span>
              </div>
            )}

            {isAtivo && (
              <div
                onClick={() => navigate('/planos')}
                className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 cursor-pointer hover:bg-emerald-100 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Plano Ativo ({PLANO_CONFIG.precoMensalExtenso})</span>
              </div>
            )}

            {/* Atalho de Modo Voz no topo (fácil acesso no desktop e mobile) */}
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/modo-voz')}
              className={`h-9 px-3 text-xs md:text-sm font-medium border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all shadow-sm ${
                location.pathname === '/modo-voz'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-500 ring-2 ring-emerald-400/30'
                  : ''
              }`}
              title="Abrir Modo Voz (Só Falar)"
            >
              <Mic className="w-4 h-4 mr-1 text-emerald-600 animate-pulse" />
              <span className="hidden sm:inline">Modo Voz</span>
            </Button>

            {/* CTA Desktop */}
            <Button
              onClick={() => navigate('/orcamentos/novo')}
              className="hidden sm:inline-flex bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-medium text-xs md:text-sm h-9 px-3.5 shadow-sm rounded-lg"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Novo Orçamento
            </Button>

            {/* Notification Bell (Badge estático em 0) */}
            <button
              type="button"
              className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              title="Notificações (0)"
              aria-label="Notificações"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-slate-300 text-slate-700 text-[10px] font-bold rounded-full flex items-center justify-center">
                0
              </span>
            </button>
          </div>
        </header>

        {/* BANNER INFORMATIVO DE TRIAL / EXPIRAÇÃO NO TOPO (QUANDO APLICÁVEL) */}
        {isTrial && !isBloqueado && (
          <div className="no-print bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-2 max-w-[1240px] mx-auto w-full justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span>
                  Período de teste grátis:{' '}
                  <strong>
                    {diasRestantesTrial === 0
                      ? 'Último dia de teste!'
                      : `${diasRestantesTrial} ${diasRestantesTrial === 1 ? 'dia restante' : 'dias restantes'}`}
                  </strong>
                </span>
              </span>
              <button
                type="button"
                onClick={() => navigate('/planos')}
                className="text-xs bg-white/20 hover:bg-white text-white hover:text-blue-900 px-2.5 py-0.5 rounded-full font-semibold transition-colors"
              >
                Contratar por {PLANO_CONFIG.precoMensalExtenso}
              </button>
            </div>
          </div>
        )}

        {/* PAGE CONTENT OU PAYWALL SE TESTE EXPIROU */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1240px] w-full mx-auto pb-24 md:pb-8">
          {deveExibirPaywall ? <TrialExpiredPaywall /> : <Outlet />}
        </main>

        {/* MOBILE BOTTOM SHEET / MENU SECUNDÁRIO 'MAIS' */}
        {mobileMoreOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileMoreOpen(false)}
            />
            <div className="relative mt-auto w-full bg-white rounded-t-2xl shadow-2xl z-50 p-4 pb-20 border-t border-slate-200 animate-slide-up">
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Mais opções
                </span>
                <button
                  onClick={() => setMobileMoreOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false)
                    navigate('/gastos')
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-colors ${
                    location.pathname === '/gastos'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">Gastos</span>
                  <span className="text-[10px] text-slate-500">Voz & Custos</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false)
                    navigate('/assistente-campo')
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-colors ${
                    location.pathname === '/assistente-campo'
                      ? 'bg-violet-50 border-violet-300 text-violet-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center mb-1">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">Assist. Campo</span>
                  <span className="text-[10px] text-slate-500">Lê Fotos/Notas</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false)
                    navigate('/contas-a-receber')
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-colors ${
                    location.pathname === '/contas-a-receber'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">A Receber</span>
                  <span className="text-[10px] text-slate-500">Cobranças</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false)
                    navigate('/audios')
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-colors ${
                    location.pathname === '/audios'
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mb-1">
                    <AudioLines className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">Áudios</span>
                  <span className="text-[10px] text-slate-500">Histórico</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false)
                    navigate('/clientes')
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-colors ${
                    location.pathname === '/clientes'
                      ? 'bg-purple-50 border-purple-300 text-purple-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mb-1">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">Clientes</span>
                  <span className="text-[10px] text-slate-500">Cadastro</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false)
                    navigate('/planos')
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-colors ${
                    location.pathname === '/planos'
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-1">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">Planos</span>
                  <span className="text-[10px] text-slate-500">Assinatura</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false)
                    navigate('/configuracoes')
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-colors ${
                    location.pathname === '/configuracoes'
                      ? 'bg-slate-200 border-slate-400 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center mb-1">
                    <Settings className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">Ajustes</span>
                  <span className="text-[10px] text-slate-500">Conta</span>
                </button>

                {user?.admin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false)
                      navigate('/admin')
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-colors ${
                      location.pathname === '/admin'
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mb-1">
                      <Shield className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold">Admin</span>
                    <span className="text-[10px] text-slate-500">Gestão</span>
                  </button>
                )}

                {isDono && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false)
                      navigate('/admin/vendas')
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-colors ${
                      location.pathname === '/admin/vendas'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold">Vendas</span>
                    <span className="text-[10px] text-slate-500">Dono</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION MOBILE (64px) */}
        <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-30 px-2 flex items-center justify-around shadow-lg">
          {/* 1. Início */}
          <NavLink
            to="/dashboard"
            onClick={() => setMobileMoreOpen(false)}
            className={`flex flex-col items-center justify-center py-1 px-2 transition-colors ${
              location.pathname === '/dashboard'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Início</span>
          </NavLink>

          {/* 2. Orçamentos */}
          <NavLink
            to="/orcamentos"
            onClick={() => setMobileMoreOpen(false)}
            className={`flex flex-col items-center justify-center py-1 px-2 transition-colors ${
              location.pathname.startsWith('/orcamentos') &&
              location.pathname !== '/orcamentos/novo'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Orçamentos</span>
          </NavLink>

          {/* 3. BOTÃO CENTRAL DE DESTAQUE: MODO VOZ (SÓ FALAR) */}
          <NavLink
            to="/modo-voz"
            onClick={() => setMobileMoreOpen(false)}
            className="flex flex-col items-center justify-center -mt-5"
          >
            <div
              className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all ${
                location.pathname === '/modo-voz'
                  ? 'bg-gradient-to-tr from-emerald-500 via-teal-600 to-emerald-700 text-white ring-4 ring-emerald-300/50'
                  : 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white hover:brightness-110'
              }`}
            >
              <Mic className="w-6 h-6 animate-pulse" />
            </div>
            <span
              className={`text-[10px] font-bold mt-1 ${
                location.pathname === '/modo-voz'
                  ? 'text-emerald-700 font-extrabold'
                  : 'text-emerald-600'
              }`}
            >
              Só Falar
            </span>
          </NavLink>

          {/* 4. Áudios (Histórico) */}
          <NavLink
            to="/audios"
            onClick={() => setMobileMoreOpen(false)}
            className={`flex flex-col items-center justify-center py-1 px-2 transition-colors ${
              location.pathname === '/audios'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <AudioLines className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Áudios</span>
          </NavLink>

          {/* 5. Mais (Abre Drawer Secundário com Clientes, Planos, Ajustes, Admin) */}
          <button
            type="button"
            onClick={() => setMobileMoreOpen((prev) => !prev)}
            className={`flex flex-col items-center justify-center py-1 px-2 transition-colors ${
              mobileMoreOpen ||
              location.pathname === '/gastos' ||
              location.pathname === '/assistente-campo' ||
              location.pathname === '/contas-a-receber' ||
              location.pathname === '/clientes' ||
              location.pathname === '/planos' ||
              location.pathname === '/configuracoes' ||
              location.pathname === '/admin'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Mais</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
