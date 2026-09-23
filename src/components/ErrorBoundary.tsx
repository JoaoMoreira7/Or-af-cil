import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  resetKey?: string
}

interface State {
  hasError: boolean
  error: Error | null
  prevResetKey?: string
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    prevResetKey: this.props.resetKey,
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public static getDerivedStateFromProps(
    nextProps: Props,
    prevState: State,
  ): Partial<State> | null {
    if (nextProps.resetKey !== undefined && nextProps.resetKey !== prevState.prevResetKey) {
      return {
        hasError: false,
        error: null,
        prevResetKey: nextProps.resetKey,
      }
    }
    return null
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou um erro não tratado:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/dashboard'
  }

  private handleGoLogin = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/login'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-lg text-center space-y-5 animate-fade-in">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-900">
                {this.props.fallbackTitle || 'Algo deu errado'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Ocorreu uma falha inesperada ao exibir esta tela. Seus dados continuam salvos e você
                pode tentar novamente ou voltar à tela inicial.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-lg bg-slate-100 text-[11px] text-slate-600 text-left font-mono break-all max-h-24 overflow-y-auto">
                {this.state.error.message || 'Erro desconhecido'}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={this.handleReset}
                className="w-full sm:w-auto h-9 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Tentar novamente
              </Button>

              <Button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Home className="w-3.5 h-3.5 mr-1.5" />
                Ir para o Início
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={this.handleGoLogin}
                className="w-full sm:w-auto h-9 text-xs text-slate-600 hover:text-slate-900"
              >
                Tela de Login
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
