import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, ArrowRight, CheckCircle2, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSubscription } from '@/contexts/SubscriptionContext'

export const TrialExpiredPaywall: React.FC = () => {
  const navigate = useNavigate()
  const { restaurarTesteDemo, loading } = useSubscription()

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden p-6 sm:p-10 text-center animate-fade-in-up">
        {/* Ícone de bloqueio */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-lg mb-6">
          <Lock className="w-8 h-8" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 mb-3">
          Período de teste encerrado
        </span>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Seu teste grátis de 7 dias chegou ao fim
        </h2>

        <p className="text-sm text-slate-600 mt-3 leading-relaxed">
          Para continuar criando orçamentos profissionais, cadastrando clientes e aproveitando a
          nossa Inteligência Artificial, contrate o plano completo por apenas{' '}
          <strong className="text-slate-900 font-bold">R$ 49,00/mês</strong>.
        </p>

        {/* Card do plano resumo */}
        <div className="my-6 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 border border-blue-100 text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Plano JM Sistemas
              </span>
              <h3 className="text-lg font-bold text-slate-900">Acesso Total & Ilimitado</h3>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-slate-900">R$ 49,00</span>
              <span className="text-xs text-slate-500 block">/mês</span>
            </div>
          </div>

          <ul className="mt-4 space-y-2 text-xs sm:text-sm text-slate-700">
            {[
              'Criação de orçamentos ilimitados com IA',
              'Gestão completa de clientes e contatos',
              'Comando de voz para geração rápida',
              'Envio direto pelo WhatsApp e impressão em PDF',
              'Formas de pagamento: PIX, Cartão ou Boleto',
            ].map((beneficio, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{beneficio}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Botão de Contratação */}
        <div className="space-y-3">
          <Button
            size="lg"
            onClick={() => navigate('/planos')}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 text-white font-bold text-base shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all"
          >
            <span>Contratar Plano por R$ 49,00/mês</span>
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          {/* Botão de restauração discreto de demonstração */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 text-amber-700 font-medium">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Ambiente de demonstração e homologação
            </span>

            <button
              type="button"
              disabled={loading}
              onClick={() => restaurarTesteDemo(3)}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 underline text-xs transition-colors"
              title="Restaura 3 dias de teste para demonstração"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restaurar teste grátis (Modo demo)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
