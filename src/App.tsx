import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute, PublicOnlyRoute, AdminRoute } from '@/components/ProtectedRoute'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import Layout from '@/components/Layout'
import ErrorBoundary from '@/components/ErrorBoundary'

// Pages
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Dashboard from '@/pages/Dashboard'
import Clientes from '@/pages/Clientes'
import Orcamentos from '@/pages/Orcamentos'
import OrcamentoDetalhe from '@/pages/OrcamentoDetalhe'
import OrcamentoForm from '@/pages/OrcamentoForm'
import Planos from '@/pages/Planos'
import Configuracoes from '@/pages/Configuracoes'
import Admin from '@/pages/Admin'
import TermosDeUso from '@/pages/TermosDeUso'
import PoliticaDePrivacidade from '@/pages/PoliticaDePrivacidade'
import AudiosHistorico from '@/pages/AudiosHistorico'
import ModoVoz from '@/pages/ModoVoz'
import ContasReceber from '@/pages/ContasReceber'
import NotFound from '@/pages/NotFound'

const AppRoutes = () => {
  const location = useLocation()

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        {/* Public Legal Pages (Access without auth) */}
        <Route
          path="/termos-de-uso"
          element={
            <ErrorBoundary resetKey="/termos-de-uso">
              <TermosDeUso />
            </ErrorBoundary>
          }
        />
        <Route
          path="/politica-de-privacidade"
          element={
            <ErrorBoundary resetKey="/politica-de-privacidade">
              <PoliticaDePrivacidade />
            </ErrorBoundary>
          }
        />

        {/* Public Auth Only Pages */}
        <Route
          path="/login"
          element={
            <ErrorBoundary resetKey="/login">
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/signup"
          element={
            <ErrorBoundary resetKey="/signup">
              <PublicOnlyRoute>
                <Signup />
              </PublicOnlyRoute>
            </ErrorBoundary>
          }
        />
        <Route path="/cadastro" element={<Navigate to="/signup" replace />} />

        {/* Root Redirect to Dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Authenticated Routes wrapped in ProtectedRoute & Global Layout */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/orcamentos" element={<Orcamentos />} />
          <Route path="/orcamentos/novo" element={<OrcamentoForm />} />
          <Route path="/orcamentos/:id" element={<OrcamentoDetalhe />} />
          <Route path="/orcamentos/:id/editar" element={<OrcamentoForm />} />
          <Route path="/contas-a-receber" element={<ContasReceber />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/audios" element={<AudiosHistorico />} />
          <Route path="/modo-voz" element={<ModoVoz />} />
          <Route path="/planos" element={<Planos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
        </Route>

        {/* Fallback 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  )
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <SubscriptionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </SubscriptionProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
