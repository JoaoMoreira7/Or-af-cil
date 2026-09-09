import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Sparkles,
  Mic,
  MicOff,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Check,
  RotateCcw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { orcamentosService } from '@/services/orcamentos'
import { clientesService } from '@/services/clientes'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function OrcamentoForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form Fields
  const [clienteId, setClienteId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [status, setStatus] = useState<'rascunho' | 'enviado'>('rascunho')
  const [itens, setItens] = useState<OrçamentoItem[]>([
    { descricao: '', quantidade: 1, valor_unitario: 0 },
  ])
  const [impostos, setImpostos] = useState<number>(0)
  const [numero, setNumero] = useState('#001')

  // AI State
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{
    itens: OrçamentoItem[]
    cliente_sugerido: string | null
  } | null>(null)

  // Voice State (Web Speech API)
  const [isRecording, setIsRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Check Web Speech API support
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setSpeechSupported(false)
    }

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

  // Voice Recognition Handler
  const toggleRecording = () => {
    if (!speechSupported) return

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setIsRecording(false)
      return
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.lang = 'pt-BR'
      recognition.continuous = false
      recognition.interimResults = false

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        if (transcript) {
          setAiPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript))
          toast({
            title: 'Áudio capturado',
            description: 'Voz transcrita para a caixa da IA.',
          })
        }
      }

      recognition.onerror = () => {
        setIsRecording(false)
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current = recognition
      recognition.start()
      setIsRecording(true)
    } catch {
      setIsRecording(false)
    }
  }

  // Call Skip Cloud Native AI Agent
  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast({
        variant: 'destructive',
        title: 'Descrição necessária',
        description: 'Digite ou dite pelo microfone o serviço para a IA orçar.',
      })
      return
    }
    if (!user?.id) return

    setAiLoading(true)
    try {
      const resultado = await orcamentosService.gerarComIA(aiPrompt, user.id)
      setAiSuggestion(resultado)

      // Preenche automaticamente itens e pré-seleciona cliente caso haja recomendação
      if (resultado.itens && resultado.itens.length > 0) {
        setItens(resultado.itens)
      }

      if (resultado.cliente_sugerido) {
        const matched = clientes.find((c) => c.id === resultado.cliente_sugerido)
        if (matched) {
          setClienteId(matched.id)
        }
      }

      if (!descricao.trim()) {
        setDescricao(aiPrompt.trim())
      }

      toast({
        title: 'Orçamento gerado pela IA com sucesso',
        description: 'Os itens sugeridos foram inseridos na proposta.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar com IA'
      toast({
        variant: 'destructive',
        title: 'Erro na IA',
        description: msg,
      })
    } finally {
      setAiLoading(false)
    }
  }

  const handleUseSuggestion = () => {
    if (aiSuggestion?.itens) {
      setItens(aiSuggestion.itens)
      if (aiSuggestion.cliente_sugerido) {
        setClienteId(aiSuggestion.cliente_sugerido)
      }
      toast({
        title: 'Sugestão aplicada',
        description: 'Itens atualizados conforme sugestão da IA.',
      })
    }
  }

  const handleDiscardSuggestion = () => {
    setAiSuggestion(null)
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
            Preencha os detalhes da proposta ou utilize nossa IA e comando de voz para gerar
            automaticamente.
          </p>
        </div>
      </div>

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
                placeholder="Ex: Instalação de infraestrutura de rede e configuração de servidores corporativos..."
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

        {/* RIGHT COLUMN: AI ASSISTANT PANEL (STICKY ON DESKTOP) */}
        <div className="lg:sticky lg:top-20 space-y-4">
          <div className="bg-gradient-to-b from-blue-900/5 via-violet-900/5 to-white rounded-2xl border-2 border-indigo-100 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-violet-600 text-white flex items-center justify-center shadow">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Assistente de IA
                  </h3>
                  <span className="text-[10px] text-violet-700 font-semibold tracking-wide uppercase">
                    Skip Cloud Native
                  </span>
                </div>
              </div>

              {/* VOICE MICROPHONE BUTTON */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      {speechSupported ? (
                        <button
                          type="button"
                          onClick={toggleRecording}
                          className={`p-2 rounded-full transition-all ${
                            isRecording
                              ? 'bg-red-600 text-white animate-pulse-ring'
                              : 'bg-white text-slate-600 hover:text-blue-600 border border-slate-200 shadow-sm'
                          }`}
                          aria-label={isRecording ? 'Parar gravação' : 'Falar por comando de voz'}
                        >
                          {isRecording ? (
                            <MicOff className="w-4 h-4" />
                          ) : (
                            <Mic className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="p-2 rounded-full bg-slate-100 text-slate-400 cursor-not-allowed"
                        >
                          <MicOff className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">
                      {speechSupported
                        ? isRecording
                          ? 'Ouvindo... fale agora'
                          : 'Clique para falar (Comando de voz)'
                        : 'Não suportado neste navegador'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {isRecording && (
              <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-600" />
                <span className="font-semibold">Ouvindo... fale agora o serviço desejado</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={4}
                placeholder="Descreva o serviço que você quer orçar... (Ex: Manutenção de 10 computadores, troca de pasta térmica e configuração de backup para clínica médica)"
                className="text-xs bg-white resize-none"
              />
            </div>

            <Button
              type="button"
              disabled={aiLoading}
              onClick={handleGenerateWithAI}
              className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-medium text-xs h-9 rounded-lg shadow"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Gerando orçamento...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Gerar Orçamento com IA
                </>
              )}
            </Button>

            {/* AI SUGGESTION BANNER IF GENERATED */}
            {aiSuggestion && (
              <div className="p-3 rounded-xl bg-violet-50/80 border border-violet-200 text-violet-900 text-xs space-y-2">
                <div className="font-semibold flex items-center gap-1.5 text-violet-800">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Sugestão pronta da IA
                </div>
                <p className="text-[11px] text-violet-700">
                  {aiSuggestion.itens.length} itens estruturados com valores em BRL sugeridos.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleUseSuggestion}
                    className="h-7 text-[11px] bg-violet-600 hover:bg-violet-700 text-white font-medium"
                  >
                    Usar sugestão
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDiscardSuggestion}
                    className="h-7 text-[11px] border-violet-200 text-violet-700 hover:bg-violet-100"
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60 text-[11px] text-slate-500 space-y-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-blue-500" /> Como funciona:
              </span>
              <p>
                O agente nativo da JM Sistemas analisa a descrição, precifica serviços e identifica
                clientes compatíveis na sua base em tempo real.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
