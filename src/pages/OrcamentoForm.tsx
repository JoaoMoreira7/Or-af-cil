import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Check,
  HelpCircle,
  MessageSquare,
  UserCheck,
  Send,
  AlertTriangle,
  FileCheck2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { orcamentosService } from '@/services/orcamentos'
import { clientesService } from '@/services/clientes'
import { aiInterpretarService, InterpretacaoResultado } from '@/services/aiInterpretar'
import { Cliente, OrçamentoItem, formatarMoedaBRL } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VoiceRecorder } from '@/components/VoiceRecorder'

export default function OrcamentoForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [saving, setSaving] = useState(false)

  const location = useLocation()
  // Form Fields
  const [clienteId, setClienteId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [status, setStatus] = useState<'rascunho' | 'enviado'>('rascunho')
  const [itens, setItens] = useState<OrçamentoItem[]>([
    { descricao: '', quantidade: 1, valor_unitario: 0 },
  ])
  const [impostos, setImpostos] = useState<number>(0)
  const [numero, setNumero] = useState('#001')

  // AI & Voice Interpretation State
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [interpretacao, setInterpretacao] = useState<InterpretacaoResultado | null>(null)
  const [editableCardItens, setEditableCardItens] = useState<OrçamentoItem[]>([])
  const [editableCardDescricao, setEditableCardDescricao] = useState('')
  const [editableCardClienteId, setEditableCardClienteId] = useState<string | null>(null)

  // Resposta a dúvidas da IA
  const [respostaDuvida, setRespostaDuvida] = useState('')
  const reviewCardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const clientesList = await clientesService.listar()
        setClientes(clientesList)

        if (isEditing && id) {
          const orc = await orcamentosService.buscarPorId(id)
          setClienteId(orc.cliente_id)
          setDescricao(orc.descricao)
          setStatus(orc.status === 'enviado' ? 'enviado' : 'rascunho')
          setItens(
            Array.isArray(orc.itens) && orc.itens.length > 0
              ? orc.itens
              : [{ descricao: '', quantidade: 1, valor_unitario: 0 }],
          )
          setImpostos(orc.impostos || 0)
          setNumero(orc.numero || '#001')
        } else if (user?.id) {
          const prox = await orcamentosService.obterProximoNumero(user.id)
          setNumero(prox)
        }

        // Se veio de reaproveitar áudio salvo:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const locState = location.state as any
        if (locState?.interpretacaoSalva) {
          const savedInterp = locState.interpretacaoSalva as InterpretacaoResultado
          setInterpretacao(savedInterp)
          setEditableCardDescricao(
            savedInterp?.descricao_servico || locState.textoReaproveitado || '',
          )
          const safeItens = Array.isArray(savedInterp?.itens)
            ? savedInterp.itens.map((it) => ({
                descricao: String(it?.descricao || '').trim(),
                quantidade: Math.max(1, Number(it?.quantidade) || 1),
                valor_unitario: Math.max(0, Number(it?.valor_unitario) || 0),
              }))
            : []
          setEditableCardItens(safeItens)
          setEditableCardClienteId(savedInterp?.cliente_sugerido_id || null)
        } else if (locState?.textoReaproveitado) {
          setAiPrompt(locState.textoReaproveitado)
          processVoiceOrTextWithAI(locState.textoReaproveitado)
        }
      } catch (err) {
        console.error('Erro ao carregar dados do formulário:', err)
      } finally {
        setLoadingInitial(false)
      }
    }

    init()
  }, [id, isEditing, user?.id])

  // Calculations
  const subtotal = itens.reduce(
    (acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
    0,
  )
  const valorImpostos = (subtotal * (Number(impostos) || 0)) / 100
  const valorTotal = subtotal + valorImpostos

  // Items manipulation
  const handleAddItem = () => {
    setItens((prev) => [...prev, { descricao: '', quantidade: 1, valor_unitario: 0 }])
  }

  const handleRemoveItem = (index: number) => {
    if (itens.length <= 1) {
      setItens([{ descricao: '', quantidade: 1, valor_unitario: 0 }])
      return
    }
    setItens((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateItem = (index: number, field: keyof OrçamentoItem, value: string | number) => {
    setItens((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  // Manipulação de itens no Card "O que entendi"
  const handleUpdateCardItem = (
    index: number,
    field: keyof OrçamentoItem,
    value: string | number,
  ) => {
    setEditableCardItens((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleRemoveCardItem = (index: number) => {
    setEditableCardItens((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddCardItem = () => {
    setEditableCardItens((prev) => [
      ...prev,
      { descricao: 'Novo item', quantidade: 1, valor_unitario: 0 },
    ])
  }

  // Chamar IA com a transcrição (seja por voz estilo WhatsApp ou por texto)
  const processVoiceOrTextWithAI = async (texto: string) => {
    if (!texto.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nenhum áudio ou texto detectado',
        description: 'Fale no microfone ou digite uma descrição para a IA interpretar.',
      })
      return
    }

    setAiLoading(true)
    try {
      const resultado = await aiInterpretarService.interpretar({
        transcricao: texto,
        contexto: 'orcamento',
        userId: user?.id,
      })

      const interp = resultado.interpretacao
      setInterpretacao(interp)
      setEditableCardDescricao(interp.descricao_servico || texto)
      const safeItens = Array.isArray(interp?.itens)
        ? interp.itens.map((it) => ({
            descricao: String(it?.descricao || '').trim(),
            quantidade: Math.max(1, Number(it?.quantidade) || 1),
            valor_unitario: Math.max(0, Number(it?.valor_unitario) || 0),
          }))
        : []
      setEditableCardItens(safeItens)
      setEditableCardClienteId(interp.cliente_sugerido_id || null)

      // Se a IA criou dados de um cliente novo em potencial, avisa
      if (interp.cliente_novo?.nome && !interp.cliente_sugerido_id) {
        toast({
          title: 'Cliente novo identificado na fala',
          description: `Identificado: ${interp.cliente_novo.nome}. Você pode confirmar no card de revisão.`,
        })
      }

      toast({
        title: 'Áudio compreendido pela IA!',
        description: 'Revise abaixo o que a IA assimilou e aplique com 1 clique.',
      })

      // Rola suavemente até o card de revisão
      setTimeout(() => {
        reviewCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar com IA'
      toast({
        variant: 'destructive',
        title: 'Erro na interpretação do áudio',
        description: msg,
      })
    } finally {
      setAiLoading(false)
    }
  }

  // Refinar interpretação respondendo a dúvida da IA
  const handleRefineWithAnswer = async () => {
    if (!respostaDuvida.trim()) return

    const contextoGeral = `${interpretacao?.transcricao_corrigida || aiPrompt}. Esclarecimento adicional: ${respostaDuvida.trim()}`
    setRespostaDuvida('')
    await processVoiceOrTextWithAI(contextoGeral)
  }

  // Aplicar interpretação nos campos oficiais do orçamento
  const handleApplyToForm = async () => {
    if (!interpretacao) return

    // 1. Descrição
    if (editableCardDescricao.trim()) {
      setDescricao(editableCardDescricao.trim())
    }

    // 2. Itens
    if (editableCardItens.length > 0) {
      setItens(editableCardItens)
    }

    // 3. Cliente sugerido
    if (editableCardClienteId) {
      setClienteId(editableCardClienteId)
    } else if (interpretacao.cliente_novo?.nome && user?.id) {
      // Cria cliente automaticamente caso o usuário tenha ditado dados de um novo cliente
      try {
        const nomeCli = String(interpretacao.cliente_novo.nome || '').trim()
        const emailDitado =
          interpretacao.cliente_novo.email && String(interpretacao.cliente_novo.email).trim()
            ? String(interpretacao.cliente_novo.email).trim()
            : ''

        const novoCli = await clientesService.criar({
          nome: nomeCli,
          email: emailDitado,
          telefone: interpretacao.cliente_novo.telefone
            ? String(interpretacao.cliente_novo.telefone).trim()
            : '',
          empresa: interpretacao.cliente_novo.empresa
            ? String(interpretacao.cliente_novo.empresa).trim()
            : '',
          endereco: interpretacao.cliente_novo.endereco
            ? String(interpretacao.cliente_novo.endereco).trim()
            : '',
          user_id: user.id,
        })
        const listaAtualizada = await clientesService.listar()
        setClientes(listaAtualizada)
        setClienteId(novoCli.id)
        toast({
          title: 'Cliente cadastrado automaticamente',
          description: `"${novoCli.nome}" foi salvo e selecionado neste orçamento.`,
        })
      } catch (eCli) {
        console.warn('Não foi possível auto-cadastrar cliente:', eCli)
      }
    }

    toast({
      title: 'Dados aplicados no orçamento!',
      description: 'Campos preenchidos com sucesso. Você pode salvar ou fazer ajustes finais.',
    })

    setInterpretacao(null)
  }

  const handleDiscardInterpretation = () => {
    setInterpretacao(null)
    setEditableCardItens([])
  }

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!clienteId) {
      toast({
        variant: 'destructive',
        title: 'Cliente obrigatório',
        description: 'Selecione um cliente para associar ao orçamento.',
      })
      return
    }

    if (!descricao.trim()) {
      toast({
        variant: 'destructive',
        title: 'Descrição obrigatória',
        description: 'Informe a descrição geral do serviço a ser orçado.',
      })
      return
    }

    // Valida itens
    const validItens = itens.filter((it) => it.descricao.trim().length > 0)
    if (validItens.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Adicione ao menos um item',
        description: 'O orçamento precisa de pelo menos um item válido com descrição.',
      })
      return
    }

    if (!user?.id) return

    setSaving(true)
    try {
      const payload = {
        cliente_id: clienteId,
        descricao: descricao.trim(),
        itens: validItens.map((it) => ({
          descricao: it.descricao.trim(),
          quantidade: Math.max(1, Number(it.quantidade) || 1),
          valor_unitario: Math.max(0, Number(it.valor_unitario) || 0),
        })),
        impostos: Number(impostos) || 0,
        subtotal: Number(subtotal.toFixed(2)),
        valor_total: Number(valorTotal.toFixed(2)),
        status: status,
        numero: numero,
        user_id: user.id,
      }

      if (isEditing && id) {
        await orcamentosService.atualizar(id, payload)
        toast({
          title: 'Orçamento atualizado',
          description: `O orçamento ${numero} foi atualizado com sucesso.`,
        })
        navigate(`/orcamentos/${id}`)
      } else {
        const created = await orcamentosService.criar(payload)
        toast({
          title: 'Orçamento gerado com sucesso!',
          description: `Orçamento ${numero} salvo na plataforma.`,
        })
        navigate(`/orcamentos/${created.id}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar orçamento.'
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar orçamento',
        description: msg,
      })
    } finally {
      setSaving(false)
    }
  }

  if (loadingInitial) {
    return (
      <div className="py-20 text-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
        <p className="text-sm">Carregando dados do orçamento...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate('/orcamentos')}
          className="h-9 px-2.5"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {isEditing ? `Editar Orçamento ${numero}` : `Novo Orçamento (${numero})`}
          </h2>
          <p className="text-xs text-slate-500">
            Fale por áudio estilo WhatsApp ou digite: nossa IA assimila tudo, corrige erros e coloca
            cada coisa no lugar certo.
          </p>
        </div>
      </div>

      {/* COMPONENTE PRINCIPAL DE ÁUDIO ESTILO WHATSAPP NO TOPO */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border-2 border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              Comando de Voz WhatsApp & IA Universal
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Grave o áudio falando normalmente com sotaque, valores e cliente. A IA normaliza erros
              de português e preenche o orçamento.
            </p>
          </div>
          {aiLoading && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-full self-start sm:self-auto">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Entendendo o que você falou...</span>
            </div>
          )}
        </div>

        {/* GRAVADOR ESTILO WHATSAPP */}
        <VoiceRecorder
          onSendTranscript={(transcript) => {
            setAiPrompt(transcript)
            processVoiceOrTextWithAI(transcript)
          }}
          isProcessing={aiLoading}
          placeholder="Ex: 'Instalação elétrica da sala 450 reais pro Carlos' ou 'Fotografia de evento 800 reais' ou 'Formatação de notebook 150 pro Pedro'..."
        />
      </div>

      {/* CARD DE REVISÃO 'O QUE ENTENDI' (SE A IA PROCESSOU O ÁUDIO) */}
      {interpretacao && (
        <div
          ref={reviewCardRef}
          className="bg-white rounded-2xl border-2 border-emerald-500 shadow-lg p-5 sm:p-6 space-y-5 animate-scale-in"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  O que a IA entendeu da sua fala
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Confiança: {interpretacao.confianca}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Revise ou edite os dados assimilados antes de jogar no orçamento oficial.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscardInterpretation}
                className="h-9 text-xs text-slate-600"
              >
                Descartar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApplyToForm}
                className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Aplicar no Orçamento
              </Button>
            </div>
          </div>

          {/* Transcrição corrigida & Fala original */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <span className="font-semibold text-slate-700">Transcrição tratada pela IA:</span>
            <p className="text-slate-800 italic font-medium">
              &ldquo;{interpretacao.transcricao_corrigida}&rdquo;
            </p>
          </div>

          {/* CAMPOS IDENTIFICADOS PELA IA (EDITÁVEIS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cliente sugerido / identificado */}
            <div className="space-y-1.5 p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
              <Label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Cliente Identificado:
              </Label>

              {editableCardClienteId ? (
                <div className="text-xs text-emerald-950 font-semibold bg-white p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
                  <span>
                    {clientes.find((c) => c.id === editableCardClienteId)?.nome ||
                      interpretacao.cliente_sugerido_nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditableCardClienteId(null)}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    Trocar
                  </button>
                </div>
              ) : interpretacao.cliente_novo?.nome ? (
                <div className="text-xs text-emerald-950 bg-white p-2.5 rounded-lg border border-emerald-200 space-y-1">
                  <span className="font-bold text-emerald-900 block">Novo cliente detectado:</span>
                  <p className="font-semibold text-slate-900">{interpretacao.cliente_novo.nome}</p>
                  <div className="text-[11px] text-slate-600 space-y-0.5 pt-0.5">
                    <p>
                      <span className="text-slate-400">Telefone:</span>{' '}
                      {interpretacao.cliente_novo.telefone || (
                        <span className="text-slate-400 italic">não informado</span>
                      )}
                    </p>
                    <p>
                      <span className="text-slate-400">E-mail:</span>{' '}
                      {interpretacao.cliente_novo.email || (
                        <span className="text-slate-400 italic">não informado</span>
                      )}
                    </p>
                    {interpretacao.cliente_novo.empresa && (
                      <p>
                        <span className="text-slate-400">Empresa:</span>{' '}
                        {interpretacao.cliente_novo.empresa}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-emerald-700 block font-medium pt-1 border-t border-emerald-100">
                    (Será cadastrado automaticamente com segurança ao aplicar)
                  </span>
                </div>
              ) : (
                <Select
                  value={editableCardClienteId || ''}
                  onValueChange={(v) => setEditableCardClienteId(v)}
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Vincular a um cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} {c.empresa ? `(${c.empresa})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Prazo e Observações */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="font-bold text-slate-700">Prazo detectado:</span>{' '}
                <span className="text-slate-900">{interpretacao.prazo || 'Não especificado'}</span>
              </div>
              {interpretacao.observacoes && (
                <div>
                  <span className="font-bold text-slate-700">Observações:</span>{' '}
                  <span className="text-slate-900">{interpretacao.observacoes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Descrição do serviço assimilada */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-800">Descrição Formal do Serviço:</Label>
            <Input
              value={editableCardDescricao}
              onChange={(e) => setEditableCardDescricao(e.target.value)}
              className="text-xs h-9 bg-white"
            />
          </div>

          {/* Itens assimilados (tabela editável) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800">
                Itens e Valores Extraídos ({editableCardItens.length}):
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCardItem}
                className="h-7 text-[11px]"
              >
                + Adicionar item
              </Button>
            </div>

            <div className="space-y-2">
              {editableCardItens.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <Input
                    value={it.descricao}
                    onChange={(e) => handleUpdateCardItem(idx, 'descricao', e.target.value)}
                    placeholder="Descrição do item"
                    className="h-8 text-xs flex-1 bg-white"
                  />
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      value={it.quantidade}
                      onChange={(e) =>
                        handleUpdateCardItem(
                          idx,
                          'quantidade',
                          Math.max(1, parseInt(e.target.value, 10) || 1),
                        )
                      }
                      className="h-8 text-xs text-center bg-white"
                      title="Qtd"
                    />
                  </div>
                  <div className="w-28 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={it.valor_unitario}
                      onChange={(e) =>
                        handleUpdateCardItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)
                      }
                      className="h-8 text-xs pl-7 bg-white"
                      title="Valor unitário"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCardItem(idx)}
                    className="text-slate-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* DÚVIDAS E PERGUNTAS DA IA (QUANDO FALTA DADO ESSENCIAL) */}
          {interpretacao.duvidas && interpretacao.duvidas.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>A IA ficou com dúvidas sobre alguns pontos:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-amber-800 pl-1">
                {interpretacao.duvidas.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
              <div className="pt-2 flex items-center gap-2">
                <Input
                  value={respostaDuvida}
                  onChange={(e) => setRespostaDuvida(e.target.value)}
                  placeholder="Responda aqui para esclarecer a IA (ex: 'O prazo é 5 dias e o cliente é o Carlos')"
                  className="h-8 text-xs bg-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleRefineWithAnswer()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRefineWithAnswer}
                  disabled={!respostaDuvida.trim() || aiLoading}
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Esclarecer
                </Button>
              </div>
            </div>
          )}

          {/* BOTÃO FINAL DO CARD */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <Button
              type="button"
              onClick={handleApplyToForm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 rounded-lg shadow"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Confirmar e Preencher no Orçamento
            </Button>
          </div>
        </div>
      )}

      {/* TWO COLUMNS: FORM (2/3) AND AI PANEL (1/3 STICKY) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN: FORM */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
              Dados Principais
            </h3>

            {/* Cliente */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cliente" className="text-xs font-semibold text-slate-700">
                  Cliente *
                </Label>
                <button
                  type="button"
                  onClick={() => navigate('/clientes')}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Cadastrar novo
                </button>
              </div>

              {clientes.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                  <span>Você ainda não possui clientes cadastrados.</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => navigate('/clientes')}
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Cadastrar
                  </Button>
                </div>
              ) : (
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Selecione um cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} {c.empresa ? `(${c.empresa})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Descrição do serviço */}
            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-xs font-semibold text-slate-700">
                Descrição do Serviço *
              </Label>
              <Textarea
                id="descricao"
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Pintura externa residencial, instalação elétrica, fotografia de casamento, marcenaria sob medida..."
                className="text-sm"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-semibold text-slate-700">
                Status Inicial
              </Label>
              <Select
                value={status}
                onValueChange={(val: 'rascunho' | 'enviado') => setStatus(val)}
              >
                <SelectTrigger className="h-10 text-sm w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* DYNAMIC ITEMS LIST */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Itens e Serviços do Orçamento
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="h-8 text-xs border-dashed border-blue-400 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar Item
              </Button>
            </div>

            <div className="space-y-3">
              {itens.map((item, idx) => {
                const itemTotal =
                  (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0)

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3"
                  >
                    {/* Descrição do item */}
                    <div className="flex-1">
                      <Input
                        value={item.descricao}
                        onChange={(e) => handleUpdateItem(idx, 'descricao', e.target.value)}
                        placeholder="Descrição do serviço ou material"
                        className="h-9 text-xs sm:text-sm bg-white"
                      />
                    </div>

                    {/* Quantidade */}
                    <div className="w-24 shrink-0">
                      <div className="relative">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) =>
                            handleUpdateItem(
                              idx,
                              'quantidade',
                              Math.max(1, parseInt(e.target.value, 10) || 1),
                            )
                          }
                          className="h-9 text-xs sm:text-sm bg-white pl-2 pr-6 tabular-nums"
                          title="Quantidade"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                          un
                        </span>
                      </div>
                    </div>

                    {/* Valor Unitário */}
                    <div className="w-32 shrink-0">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.valor_unitario}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)
                          }
                          className="h-9 text-xs sm:text-sm bg-white pl-8 tabular-nums"
                          title="Valor unitário"
                        />
                      </div>
                    </div>

                    {/* Total do Item */}
                    <div className="w-24 shrink-0 text-right font-semibold text-xs text-slate-700 tabular-nums">
                      {formatarMoedaBRL(itemTotal)}
                    </div>

                    {/* Excluir */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                      title="Remover linha"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* CÁLCULO AUTOMÁTICO (SUBTOTAL, IMPOSTOS, TOTAL) */}
            <div className="pt-4 border-t border-slate-100 flex flex-col items-end space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between w-64 text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {formatarMoedaBRL(subtotal)}
                </span>
              </div>

              <div className="flex items-center justify-between w-64 text-slate-600">
                <span className="flex items-center gap-1">Impostos (%):</span>
                <div className="w-20">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={impostos}
                    onChange={(e) => setImpostos(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs text-right tabular-nums bg-white"
                  />
                </div>
              </div>

              {impostos > 0 && (
                <div className="flex items-center justify-between w-64 text-slate-500 text-xs">
                  <span>Valor impostos:</span>
                  <span className="tabular-nums">+{formatarMoedaBRL(valorImpostos)}</span>
                </div>
              )}

              <div className="flex items-center justify-between w-64 pt-2 border-t border-slate-200 text-base font-bold text-blue-700">
                <span>Total:</span>
                <span className="text-lg tabular-nums">{formatarMoedaBRL(valorTotal)}</span>
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/orcamentos')}
              className="h-10"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-10 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold rounded-lg shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando Orçamento...
                </>
              ) : (
                'Salvar Orçamento'
              )}
            </Button>
          </div>
        </form>

        {/* RIGHT COLUMN: ALTERNATIVA POR TEXTO / INFORMAÇÕES */}
        <div className="lg:sticky lg:top-20 space-y-4">
          <div className="bg-gradient-to-b from-blue-900/5 via-violet-900/5 to-white rounded-2xl border-2 border-indigo-100 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-violet-600 text-white flex items-center justify-center shadow">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Digitação Rápida por IA
                  </h3>
                  <span className="text-[10px] text-violet-700 font-semibold tracking-wide uppercase">
                    Alternativa ao áudio
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={4}
                placeholder="Se preferir digitar, descreva aqui (ex: 'Instalação de 2 luminárias e troca de disjuntor pro Carlos por 280 reais')"
                className="text-xs bg-white resize-none"
              />
            </div>

            <Button
              type="button"
              disabled={aiLoading || !aiPrompt.trim()}
              onClick={() => processVoiceOrTextWithAI(aiPrompt)}
              className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-medium text-xs h-9 rounded-lg shadow"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Interpretando...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Processar Texto com IA
                </>
              )}
            </Button>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60 text-[11px] text-slate-500 space-y-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" /> Como o áudio WhatsApp funciona:
              </span>
              <p>
                1. <strong>Grave naturalmente:</strong> Diga o serviço, valores e o nome do cliente.
              </p>
              <p>
                2. <strong>Inteligência fonética:</strong> A IA perdoa sotaques, palavras cortadas e
                gírias (&ldquo;ar condiciado&rdquo; &rarr; ar-condicionado).
              </p>
              <p>
                3. <strong>Revisão transparente:</strong> O card &ldquo;O que entendi&rdquo; exibe
                os campos para sua aprovação.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
