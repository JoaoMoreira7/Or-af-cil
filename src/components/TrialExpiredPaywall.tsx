import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, ArrowRight, CheckCircle2, Sparkles, RefreshCw, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { PLANOS_LISTA } from '@/config/plans'

export const TrialExpiredPaywall: React.FC = () => {
  const navigate = useNavigate()
  const { restaurarTeste, loading } = useSubscription()

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-3xl w-full bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden p-6 sm:p-10 text-center animate-fade-in-up">
        {/* Ícone de bloqueio */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-lg mb-6">
          <Lock className="w-8 h-8" />
        </div>

        <div className="flex flex-col items-center gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            Período de teste encerrado
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Feito para quem vive de serviço
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Seu teste grátis de 7 dias chegou ao fim
        </h2>

        <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-xl mx-auto">
          O OrçaFácil é feito para quem vive de serviço. Para continuar criando orçamentos
          profissionais, gerenciando clientes e aproveitando nossos recursos com Inteligência
          Artificial, escolha o plano ideal abaixo:
        </p>

        {/* Os 3 planos com destaque especial para o Profissional */}
        <div className="my-7 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {PLANOS_LISTA.map((p) => {
            const isProfissional = p.id === 'profissional'
            return (
              <div
                key={p.id}
                onClick={() => navigate('/planos')}
                className={`cursor-pointer rounded-2xl p-5 transition-all relative flex flex-col justify-between ${
                  isProfissional
                    ? 'bg-gradient-to-b from-blue-50/70 to-indigo-50/40 border-2 border-blue-600 shadow-md ring-1 ring-blue-600/20 md:-translate-y-1'
                    : 'bg-slate-50/80 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {isProfissional && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-blue-600 shadow-sm flex items-center gap-1 whitespace-nowrap">
                      <Star className="w-3 h-3 fill-white" /> Mais Escolhido
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isProfissional
                          ? 'bg-blue-100 text-blue-800'
                          : p.id === 'premium'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-200/80 text-slate-700'
                      }`}
                    >
                      {p.posicionamento}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-base">{p.nome}</h3>
                  <div className="mt-2 mb-3">
                    <span className="text-2xl font-extrabold text-slate-900">
                      {p.precoFormatado}
                    </span>
                    <span className="text-xs text-slate-500">/mês</span>
                  </div>

                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {p.recursos.slice(0, 3).map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60">
                  <span
                    className={`block text-center text-xs font-bold py-1.5 rounded-lg ${
                      isProfissional
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    Escolher {p.nome}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Botão de Contratação Geral */}
        <div className="space-y-3">
          <Button
            size="lg"
            onClick={() => navigate('/planos')}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 text-white font-bold text-base shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all"
          >
            <span>Ver Todos os Planos e Desbloquear Acesso</span>
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
              onClick={() => restaurarTeste()}
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
