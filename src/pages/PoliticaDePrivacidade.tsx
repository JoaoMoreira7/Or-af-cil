import React from 'react'
import { Link } from 'react-router-dom'
import { COMPANY_LEGAL } from '@/config/company'
import { AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react'

export default function PoliticaDePrivacidade() {
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
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Política de Privacidade
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">Última atualização: {dataAtualizacao}</p>
        </div>

        {/* BLOCO DE DADOS LEGAIS DA EMPRESA */}
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
              <span className="font-semibold">E-mail do DPO / Jurídico:</span>{' '}
              {COMPANY_LEGAL.emailJuridico}
            </div>
            <div>
              <span className="font-semibold">Responsável Legal:</span>{' '}
              {COMPANY_LEGAL.responsavelLegal}
            </div>
          </div>
        </div>

        {/* SEÇÕES DE PRIVACIDADE */}
        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">1. Dados Coletados</h2>
            <p>Para prestar nossos serviços de gestão e geração de orçamentos, coletamos:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600 text-xs sm:text-sm">
              <li>Dados de cadastro: Nome completo, endereço de e-mail e senha criptografada;</li>
              <li>
                Dados de clientes do usuário: Nome, e-mail, telefone, empresa e endereço físico;
              </li>
              <li>
                Dados de propostas comerciais: Itens, quantitativos, preços unitários e descrição de
                serviços;
              </li>
              <li>
                Comandos de voz: Áudio transcrito pelo navegador via Web Speech API exclusivamente
                para preenchimento de campos de texto.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">2. Uso dos Dados</h2>
            <p>Os dados coletados são utilizados estritamente para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600 text-xs sm:text-sm">
              <li>Autenticar o acesso com segurança e manter sessões ativas;</li>
              <li>Calcular e formatar propostas comerciais em moeda corrente (BRL);</li>
              <li>
                Permitir que o agente de inteligência artificial recomende itens e vincule clientes
                pertinentes;
              </li>
              <li>Gerenciar preferências do plano de assinatura escolhido.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">3. Compartilhamento</h2>
            <p>
              A {COMPANY_LEGAL.nomeFantasia} não vende, aluga nem repassa dados de clientes a
              empresas de publicidade. O compartilhamento ocorre exclusivamente com provedores
              essenciais de infraestrutura em nuvem e processamento computacional para a execução do
              serviço.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">
              4. Armazenamento e Segurança
            </h2>
            <p>
              Todos os dados são transmitidos com criptografia SSL/TLS e armazenados em banco de
              dados com políticas rigorosas de isolamento por usuário (Row-Level Security / RLS).
              Senhas são hasheadas com algoritmos de alta resistência (Bcrypt/Argon2).
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">5. Cookies e Sessão</h2>
            <p>
              Utilizamos armazenamento local seguro (Local Storage) e cookies de sessão essenciais
              para manter a autenticação ativa do usuário entre recarregamentos de página.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">
              6. Direitos do Titular (LGPD — Lei nº 13.709/2018)
            </h2>
            <p>
              Em conformidade com a LGPD, o titular dos dados possui o direito de confirmar a
              existência de tratamento, acessar seus dados, corrigir dados incompletos ou inexatos,
              e solicitar a exclusão definitiva de sua conta e histórico.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">7. Alterações na Política</h2>
            <p>
              Esta Política de Privacidade poderá ser revisada conforme evolução técnica dos
              recursos de IA e novos requisitos legais.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">
              8. Contato e Encarregado (DPO)
            </h2>
            <p>
              Para exercer qualquer um de seus direitos previstos na LGPD, entre em contato com
              nosso departamento jurídico:{' '}
              <a href={`mailto:${COMPANY_LEGAL.emailJuridico}`} className="text-blue-600 underline">
                {COMPANY_LEGAL.emailJuridico}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
