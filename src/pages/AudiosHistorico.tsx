import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  FileText,
  UserPlus,
  RefreshCw,
  Trash2,
  Calendar,
  Volume2,
  CheckCircle2,
  HelpCircle,
  Smartphone,
} from 'lucide-react'
import { audiosService } from '@/services/audios'
import { AudioRegistro, formatarDataHora, AudioContexto } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export default function AudiosHistorico() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [audios, setAudios] = useState<AudioRegistro[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [contextoFiltro, setContextoFiltro] = useState<string>('todos')
  const [selectedAudio, setSelectedAudio] = useState<AudioRegistro | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAudios = async () => {
    try {
      const lista = await audiosService.listar({
        contexto: contextoFiltro as AudioContexto | 'todos',
        busca,
      })
      setAudios(lista)
    } catch (err) {
      console.error('Erro ao carregar histórico de áudios:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAudios()
  }, [contextoFiltro])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAudios()
    }, 250)
    return () => clearTimeout(timer)
  }, [busca])

  const handleDeleteAudio = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setDeletingId(id)
    try {
      await audiosService.excluir(id)
      setAudios((prev) => prev.filter((a) => a.id !== id))
      if (selectedAudio?.id === id) {
        setSelectedAudio(null)
      }
      toast({
        title: 'Áudio removido',
        description: 'Registro excluído do histórico.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir áudio'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    } finally {
      setDeletingId(null)
    }
  }

  // Reaproveitar ditado antigo para preencher novo orçamento ou cliente
  const handleReaproveitar = (audio: AudioRegistro) => {
    const texto = audio.transcricao_corrigida || audio.transcricao_bruta
    if (audio.contexto === 'cliente') {
      navigate('/clientes', {
        state: {
          textoReaproveitado: texto,
          interpretacaoSalva: audio.resultado_json,
        },
      })
      toast({
        title: 'Ditado carregado',
        description: 'Preenchendo cliente a partir do áudio salvo.',
      })
    } else {
      // Padrão: orcamento
      navigate('/orcamentos/novo', {
        state: {
          textoReaproveitado: texto,
          interpretacaoSalva: audio.resultado_json,
        },
      })
      toast({
        title: 'Ditado carregado',
        description: 'Preenchendo orçamento a partir do áudio salvo.',
      })
    }
  }

  const getContextoBadge = (contexto: AudioContexto) => {
    switch (contexto) {
      case 'orcamento':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none font-semibold text-[11px]">
            <FileText className="w-3 h-3 mr-1" />
            Orçamento
          </Badge>
        )
      case 'cliente':
        return (
          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-none font-semibold text-[11px]">
            <UserPlus className="w-3 h-3 mr-1" />
            Cliente
          </Badge>
        )
      case 'comando_status':
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none font-semibold text-[11px]">
            <RefreshCw className="w-3 h-3 mr-1" />
            Comando de Status
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200 border-none font-semibold text-[11px]">
            Geral
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-emerald-600" />
            Histórico de Ditados & Áudios
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Todos os comandos e gravações enviados para a IA são arquivados para você reaproveitar a
            qualquer momento
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/modo-voz')}
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs sm:text-sm"
          >
            <Smartphone className="w-4 h-4 mr-1.5" />
            Modo Só Falar
          </Button>

          <Button
            onClick={() => navigate('/orcamentos/novo')}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium text-xs sm:text-sm shadow-sm"
          >
            <Mic className="w-4 h-4 mr-1.5" />
            Gravar Novo Áudio
          </Button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por palavras na fala ou transcrição..."
            className="h-9 pl-9 text-xs sm:text-sm bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-[170px] shrink-0">
            <Select value={contextoFiltro} onValueChange={setContextoFiltro}>
              <SelectTrigger className="h-9 text-xs">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <SelectValue placeholder="Contexto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="orcamento">Orçamentos</SelectItem>
                <SelectItem value="cliente">Clientes</SelectItem>
                <SelectItem value="comando_status">Comando Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* LIST SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : audios.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Mic className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Nenhum áudio gravado ainda</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Suas falas no Novo Orçamento, Cadastro de Clientes ou no Modo Só Falar ficarão salvas
              aqui com transcrição completa.
            </p>
            <Button
              onClick={() => navigate('/orcamentos/novo')}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
            >
              <Mic className="w-4 h-4 mr-1.5" />
              Fazer primeira gravação
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {audios.map((audio) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const resultadoJson = (audio.resultado_json || {}) as any
              const temItens = Array.isArray(resultadoJson.itens) && resultadoJson.itens.length > 0
              const clienteSugerido =
                resultadoJson.cliente_sugerido_nome || resultadoJson.cliente_novo?.nome

              return (
                <div
                  key={audio.id}
                  onClick={() => setSelectedAudio(audio)}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getContextoBadge(audio.contexto)}
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatarDataHora(audio.created)}
                      </span>
                      {audio.confianca && (
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Confiança {audio.confianca}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReaproveitar(audio)
                        }}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Reaproveitar Ditado
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={deletingId === audio.id}
                        onClick={(e) => handleDeleteAudio(audio.id, e)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Transcrição Bruta & Corrigida */}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900 leading-snug">
                      &ldquo;
                      {audio.transcricao_corrigida || audio.transcricao_bruta}
                      &rdquo;
                    </p>
                    {audio.transcricao_corrigida &&
                      audio.transcricao_corrigida !== audio.transcricao_bruta && (
                        <p className="text-xs text-slate-500 italic">
                          Áudio original transcrito: &ldquo;{audio.transcricao_bruta}&rdquo;
                        </p>
                      )}
                  </div>

                  {/* Resumo Interpretado pela IA */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
                    {clienteSugerido && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                        Cliente: <strong>{clienteSugerido}</strong>
                      </span>
                    )}

                    {temItens && (
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-medium">
                        {resultadoJson.itens.length}{' '}
                        {resultadoJson.itens.length === 1 ? 'item extraído' : 'itens extraídos'}
                      </span>
                    )}

                    {resultadoJson.comando_status?.novo_status && (
                      <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-medium">
                        Comando: Alterar para &quot;
                        {resultadoJson.comando_status.novo_status}&quot;
                      </span>
                    )}

                    <span className="text-slate-400 text-[11px] ml-auto flex items-center gap-0.5">
                      Ver detalhes <ArrowRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DETALHE DO ÁUDIO */}
      <Dialog open={!!selectedAudio} onOpenChange={(open) => !open && setSelectedAudio(null)}>
        <DialogContent className="max-w-[620px] rounded-2xl bg-white text-slate-900 p-6 max-h-[90vh] overflow-y-auto">
          {selectedAudio && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pb-1">
                  {getContextoBadge(selectedAudio.contexto)}
                  <span className="text-xs text-slate-500">
                    {formatarDataHora(selectedAudio.created)}
                  </span>
                </div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  Detalhes do Ditado por Voz
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Estrutura assimilada pelo agente de inteligência artificial.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-2 text-xs">
                {/* Fala Original */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">
                    Transcrição Bruta (Captura do Microfone):
                  </span>
                  <p className="text-slate-800 italic">
                    &ldquo;{selectedAudio.transcricao_bruta}&rdquo;
                  </p>
                </div>

                {/* Fala Corrigida */}
                {selectedAudio.transcricao_corrigida && (
                  <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                    <span className="font-bold text-emerald-900 block mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Interpretação e Correção Gramatical:
                    </span>
                    <p className="text-emerald-950 font-medium">
                      &ldquo;{selectedAudio.transcricao_corrigida}&rdquo;
                    </p>
                  </div>
                )}

                {/* JSON Interpretado */}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {selectedAudio.resultado_json && (
                  <div className="space-y-2">
                    <span className="font-bold text-slate-700 block">
                      Campos Estruturados Identificados:
                    </span>

                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(() => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const res = selectedAudio.resultado_json as any
                      return (
                        <div className="space-y-2.5">
                          {res.descricao_servico && (
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                              <span className="text-slate-500 font-semibold block">
                                Descrição formal:
                              </span>
                              <span className="text-slate-900">{res.descricao_servico}</span>
                            </div>
                          )}

                          {res.cliente_sugerido_nome && (
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                              <span className="text-slate-500 font-semibold block">
                                Cliente associado:
                              </span>
                              <span className="text-slate-900 font-medium">
                                {res.cliente_sugerido_nome}
                              </span>
                            </div>
                          )}

                          {res.cliente_novo?.nome && (
                            <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                              <span className="text-purple-800 font-semibold block">
                                Novo cliente identificado:
                              </span>
                              <span className="text-purple-950 font-medium">
                                {res.cliente_novo.nome}{' '}
                                {res.cliente_novo.telefone ? `(${res.cliente_novo.telefone})` : ''}
                              </span>
                            </div>
                          )}

                          {Array.isArray(res.itens) && res.itens.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-slate-500 font-semibold block">
                                Itens do orçamento:
                              </span>
                              <div className="space-y-1">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {res.itens.map((it: any, i: number) => (
                                  <div
                                    key={i}
                                    className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-200"
                                  >
                                    <span>
                                      {it.quantidade}x {it.descricao}
                                    </span>
                                    <span className="font-bold text-slate-800">
                                      R$ {Number(it.valor_unitario).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {res.comando_status?.novo_status && (
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                              <span className="text-amber-800 font-bold block mb-1">
                                Comando de Alteração de Status:
                              </span>
                              <p className="text-amber-900">
                                {res.comando_status.mensagem_confirmacao ||
                                  `Alterar para status ${res.comando_status.novo_status}`}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteAudio(selectedAudio.id)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 h-9"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Excluir Registro
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAudio(null)}
                    className="h-9"
                  >
                    Fechar
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const item = selectedAudio
                      setSelectedAudio(null)
                      handleReaproveitar(item)
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-9"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Reaproveitar no Formulário
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
