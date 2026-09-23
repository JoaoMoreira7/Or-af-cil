import React, { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Users,
  PlusCircle,
  CreditCard,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { TrialExpiredPaywall } from '@/components/TrialExpiredPaywall'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const { user, logout } = useAuth()
  const { isBloqueado, isTrial, diasRestantesTrial, isAtivo } = useSubscription()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Rotas isentas de bloqueio por paywall: Planos e Configurações
  const isRotaLiberada = location.pathname === '/planos' || location.pathname === '/configuracoes'
  const deveExibirPaywall = isBloqueado && !isRotaLiberada

  // Mapeamento dinâmico de títulos por rota
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/dashboard') return 'Dashboard'
    if (path === '/orcamentos') return 'Orçamentos'
    if (path === '/orcamentos/novo') return 'Novo Orçamento com IA'
    if (path.startsWith('/orcamentos/') && path.endsWith('/editar')) return 'Editar Orçamento'
    if (path.startsWith('/orcamentos/')) return 'Detalhe do Orçamento'
    if (path === '/clientes') return 'Clientes'
    if (path === '/planos') return 'Planos e Assinatura'
    if (path === '/configuracoes') return 'Configurações da Conta'
    return 'JM Sistemas'
  }

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Orçamentos', path: '/orcamentos', icon: FileText },
    { label: 'Clientes', path: '/clientes', icon: Users },
    { label: 'Novo Orçamento', path: '/orcamentos/novo', icon: PlusCircle, isCta: true },
    { label: 'Planos', path: '/planos', icon: CreditCard },
    { label: 'Configurações', path: '/configuracoes', icon: Settings },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getInitials = (name?: string) => {
    if (!name) return 'JM'
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
              JM
            </div>
            <div className="hidden lg:flex flex-col">
              <span className="font-bold text-white text-base tracking-tight leading-none">
                JM Sistemas
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
                  JM
                </div>
                <span className="font-bold text-white text-base">JM Sistemas</span>
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
                <span>Plano Ativo (R$ 49/mês)</span>
              </div>
            )}

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
                Contratar por R$ 49/mês
              </button>
            </div>
          </div>
        )}

        {/* PAGE CONTENT OU PAYWALL SE TESTE EXPIROU */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1240px] w-full mx-auto pb-24 md:pb-8">
          {deveExibirPaywall ? <TrialExpiredPaywall /> : <Outlet />}
        </main>

        {/* BOTTOM NAVIGATION MOBILE (64px) */}
        <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-30 px-3 flex items-center justify-around shadow-lg">
          {[
            { label: 'Início', path: '/dashboard', icon: LayoutDashboard },
            { label: 'Orçamentos', path: '/orcamentos', icon: FileText },
            { label: 'Novo', path: '/orcamentos/novo', icon: PlusCircle, isCenter: true },
            { label: 'Clientes', path: '/clientes', icon: Users },
            { label: 'Planos', path: '/planos', icon: CreditCard },
          ].map((item) => {
            const Icon = item.icon
            const isActive =
              item.path === '/orcamentos/novo'
                ? location.pathname === '/orcamentos/novo'
                : item.path === '/orcamentos'
                  ? location.pathname.startsWith('/orcamentos') &&
                    location.pathname !== '/orcamentos/novo'
                  : location.pathname === item.path

            if (item.isCenter) {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center justify-center -mt-5"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-violet-600 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-semibold text-blue-600 mt-1">{item.label}</span>
                </NavLink>
              )
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center py-1 px-2 transition-colors ${
                  isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
