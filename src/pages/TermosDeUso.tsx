import React from 'react'
import { Link } from 'react-router-dom'
import { COMPANY_LEGAL } from '@/config/company'
import { PLANO_CONFIG } from '@/config/plans'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export default function TermosDeUso() {
  const dataAtualizacao = '09 de Setembro de 2026'

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[800px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10">
        <div className="mb-6">
          <Link
            to="/login"
            className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Voltar ao início / login
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Termos de Uso
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Última atualização: {dataAtualizacao}
          </p>
        </div>

        {/* BLOCO DE DADOS LEGAIS COM DESTAQUE ÂMBAR / BORDA TRACEJADA */}
        <div className="my-6 p-4 rounded-xl bg-amber-50 border-2 border-dashed border-amber-300 text-amber-900 text-xs sm:text-sm">
          <div className="flex items-center gap-2 font-bold text-amber-800 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>⚠️ Dados Legais da Empresa (Placeholders Configuráveis)</span>
          </div>
          <p className="text-amber-800 text-xs mb-3">
            Estes dados são placeholders para demonstração e testes do sistema. Eles são
            centralizados e editáveis diretamente no arquivo de configuração{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">
              src/config/company.ts
            </code>{' '}
            antes da publicação oficial da plataforma.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-semibold">Razão Social:</span> {COMPANY_LEGAL.razaoSocial}
            </div>
            <div>
              <span className="font-semibold">Nome Fantasia:</span> {COMPANY_LEGAL.nomeFantasia}
            </div>
            <div>
              <span className="font-semibold">CNPJ:</span> {COMPANY_LEGAL.cnpj}
            </div>
            <div>
              <span className="font-semibold">Comarca:</span> {COMPANY_LEGAL.comarca}
            </div>
            <div className="sm:col-span-2">
              <span className="font-semibold">Endereço:</span> {COMPANY_LEGAL.endereco}
            </div>
            <div>
              <span className="font-semibold">E-mail de Contato:</span> {COMPANY_LEGAL.emailContato}
            </div>
            <div>
              <span className="font-semibold">E-mail Jurídico:</span> {COMPANY_LEGAL.emailJuridico}
            </div>
            {COMPANY_LEGAL.telefone && (
              <div>
                <span className="font-semibold">Telefone:</span> {COMPANY_LEGAL.telefone}
              </div>
            )}
          </div>
        </div>

        {/* SEÇÕES DE TERMOS */}
        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar, cadastrar-se ou utilizar a plataforma da {COMPANY_LEGAL.nomeFantasia},
              você concorda integralmente com estes Termos de Uso. Caso não concorde com qualquer
              disposição aqui estipulada, solicitamos que não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">2. Descrição do Serviço</h2>
            <p>
              A {COMPANY_LEGAL.nomeFantasia} disponibiliza uma plataforma web SaaS para gestão de
              clientes, estruturação de propostas comerciais e orçamentos, assistida por recursos de
              inteligência artificial generativa e reconhecimento de comandos de voz. Os orçamentos
              gerados são de exclusiva responsabilidade e conferência do usuário emissor.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">3. Cadastro e Conta</h2>
            <p>
              O usuário se compromete a fornecer informações verídicas, completas e atualizadas. A
              guarda e sigilo das credenciais de acesso (e-mail e senha) são de inteira
              responsabilidade do titular da conta, respondendo por quaisquer atividades sob sua
              autenticação.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">
              4. Planos, Teste Grátis e Cobrança (Simulada)
            </h2>
            <p>
              A plataforma oferece acesso completo através do plano{' '}
              <strong>
                {PLANO_CONFIG.nome} ({PLANO_CONFIG.precoMensalExtenso})
              </strong>
              , antecedido por um período de teste grátis de <strong>7 dias</strong> para novos
              usuários. Após a conclusão do período de teste, o acesso é bloqueado até a contratação
              do plano via PIX, Cartão de Crédito ou Boleto. Nesta versão de demonstração e
              homologação, toda a cobrança, processamento de cartões e transações financeiras são
              estritamente <strong>SIMULADAS</strong>. Nenhuma transação bancária ou débito real é
              efetuado nos dados fornecidos nos formulários de pagamento.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">5. Propriedade Intelectual</h2>
            <p>
              Todo o código-fonte, layout, marcas, logotipos, monigramas e algoritmos pertencem à{' '}
              {COMPANY_LEGAL.nomeFantasia}. Os dados cadastrados pelo usuário, incluindo informações
              de seus clientes e valores de orçamentos, permanecem sob propriedade e titularidade do
              usuário.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">
              6. Limitação de Responsabilidade
            </h2>
            <p>
              As sugestões fornecidas pela inteligência artificial e os cálculos de propostas
              comerciais são ferramentas de apoio. O usuário deve revisar quantitativos, descrições
              e precificações antes de enviar qualquer orçamento a terceiros. A plataforma não se
              responsabiliza por prejuízos operacionais decorrentes de erros de cálculo não
              revisados.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">7. Rescisão</h2>
            <p>
              O usuário pode cancelar sua conta a qualquer momento por meio do painel de
              configurações ou solicitando ao canal de suporte. A {COMPANY_LEGAL.nomeFantasia}{' '}
              reserva-se o direito de suspender contas que violem estes termos ou a legislação
              vigente.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">8. Alterações nos Termos</h2>
            <p>
              Estes termos poderão ser modificados periodicamente para refletir melhorias no sistema
              ou adequações legais. O uso continuado após a publicação de novos termos implicará
              aceitação tácita.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">9. Contato</h2>
            <p>
              Em caso de dúvidas a respeito destes Termos de Uso, contate-nos através do e-mail:{' '}
              <a href={`mailto:${COMPANY_LEGAL.emailSuporte}`} className="text-blue-600 underline">
                {COMPANY_LEGAL.emailSuporte}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
