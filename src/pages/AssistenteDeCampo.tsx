import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Camera,
  Upload,
  FileText,
  DollarSign,
  Save,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Loader2,
  Receipt,
  Eye,
  Info,
  Calendar,
  Building,
  Plus,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Pencil,
  FileCheck2,
  Layers,
  History,
  X,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useToast } from '@/hooks/use-toast'
import { documentosLidosService } from '@/services/documentosLidos'
import { orcamentosService } from '@/services/orcamentos'
import { clientesService } from '@/services/clientes'
import { acoesVozService } from '@/services/acoesVoz'
import { preferenciasIaService } from '@/services/preferenciasIa'
import { ReciboAcaoVoz } from '@/components/ReciboAcaoVoz'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DocumentoLido,
  DocumentoTipo,
  DocumentoDadosExtraidos,
  DocumentoItemExtraido,
  Orçamento,
  Cliente,
  AcaoVozRegistro,
  formatarMoedaBRL,
  formatarData,
} from '@/types'

export default function AssistenteDeCampo() {
  const { user } = useAuth()
  const { isBloqueado } = useSubscription()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  // REGRA DE PROJETO OBRIGATÓRIA: isMountedRef e limpeza de streams/timers
  const isMountedRef = useRef(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)

  // Upload e Câmera
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)

  // Processamento e IA
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{
    leitura_automatica: boolean
    modo_visao_suportado: boolean
    mensagem_assistente: string
  } | null>(null)

  // Dados Extraídos Editáveis ("O que a IA leu na foto")
  const [tipoDoc, setTipoDoc] = useState<DocumentoTipo>('nota_fiscal')
  const [fornecedor, setFornecedor] = useState('')
  const [dataDocumento, setDataDocumento] = useState('')
  const [itens, setItens] = useState<DocumentoItemExtraido[]>([])
  const [valorTotal, setValorTotal] = useState<number>(0)
  const [valorImpostos, setValorImpostos] = useState<number>(0)
  const [observacoes, setObservacoes] = useState('')
  const [confianca, setConfianca] = useState<'alta' | 'media' | 'baixa'>('alta')
  const [showReviewCard, setShowReviewCard] = useState(false)

  // Ações Concretas
  const [isApplying, setIsApplying] = useState(false)
  const [modalOrcamentoOpen, setModalOrcamentoOpen] = useState(false)
  const [modalDespesaOpen, setModalDespesaOpen] = useState(false)
  const [modalFotoVisualizar, setModalFotoVisualizar] = useState<string | null>(null)

  // Clientes e Orçamentos para vínculo
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [orcamentos, setOrcamentos] = useState<Orçamento[]>([])
  const [selectedClienteId, setSelectedClienteId] = useState<string>('')
  const [selectedOrcamentoId, setSelectedOrcamentoId] = useState<string>('')
  const [clienteNovoNome, setClienteNovoNome] = useState('')

  // Histórico de Documentos Lidos e Recibos das últimas 24h
  const [documentosHistorico, setDocumentosHistorico] = useState<DocumentoLido[]>([])
  const [acoesRecentes, setAcoesRecentes] = useState<AcaoVozRegistro[]>([])
  const [ultimoRecibo, setUltimoRecibo] = useState<AcaoVozRegistro | null>(null)
  const [loadingHistorico, setLoadingHistorico] = useState(true)
  const [undoingAcaoId, setUndoingAcaoId] = useState<string | null>(null)

  // Limpeza de streams e timers no desmonte
  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
  }, [])

  // Carregar dados iniciais (histórico, clientes, orçamentos, ações 24h)
  const carregarDados = async () => {
    if (!user?.id) return
    setLoadingHistorico(true)
    try {
      const [docs, clis, orcs, acoes] = await Promise.all([
        documentosLidosService.listar(user.id),
        clientesService.listar(),
        orcamentosService.listar({ filtroStatus: 'todos' }),
        acoesVozService.listarUltimas24Horas(user.id),
      ])

      if (isMountedRef.current) {
        setDocumentosHistorico(docs)
        setClientes(clis)
        setOrcamentos(orcs)
        // Filtra ações do tipo documento_orcamento, documento_despesa ou criacao_orcamento
        setAcoesRecentes(acoes)
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do assistente de campo:', err)
    } finally {
      if (isMountedRef.current) {
        setLoadingHistorico(false)
      }
    }
  }

  useEffect(() => {
    carregarDados()
  }, [user?.id])

  // Recalcular totais quando itens mudam
  useEffect(() => {
    const totalItens = itens.reduce(
      (acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
      0,
    )
    if (totalItens > 0) {
      setValorTotal(Number(totalItens.toFixed(2)))
    }
  }, [itens])

  // Iniciar câmera ao vivo (se o usuário optar por vídeo direto)
  const iniciarCameraAoVivo = async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      mediaStreamRef.current = stream
      setCameraActive(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err) {
      console.warn('Não foi possível abrir câmera ao vivo diretamente:', err)
      // Fallback para input file com capture='environment'
      cameraInputRef.current?.click()
    }
  }

  const pararCameraAoVivo = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    setCameraActive(false)
  }

  const capturarFrameCamera = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob || !isMountedRef.current) return
          const file = new File([blob], `foto_campo_${Date.now()}.jpg`, { type: 'image/jpeg' })
          processarArquivoSelecionado(file)
          pararCameraAoVivo()
        },
        'image/jpeg',
        0.85,
      )
    }
  }

  // Tratamento de arquivo selecionado (galeria ou foto)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processarArquivoSelecionado(file)
    }
  }

  const processarArquivoSelecionado = (file: File) => {
    setSelectedFile(file)
    const preview = URL.createObjectURL(file)
    setImagePreviewUrl(preview)

    // Converte para Base64 para tentar leitura multimodal se suportada
    const reader = new FileReader()
    reader.onloadend = () => {
      if (isMountedRef.current && typeof reader.result === 'string') {
        setImageBase64(reader.result)
        // Dispara análise automaticamente
        analisarFotoComIA(file, reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  // Análise da foto com IA
  const analisarFotoComIA = async (file: File, b64?: string) => {
    setIsAnalyzing(true)
    setAnalysisResult(null)
    try {
      const res = await documentosLidosService.analisarDocumento({
        arquivo: file,
        imagemBase64: b64 || imageBase64 || undefined,
        nomeArquivo: file.name,
      })

      if (!isMountedRef.current) return

      setAnalysisResult({
        leitura_automatica: res.leitura_automatica,
        modo_visao_suportado: res.modo_visao_suportado,
        mensagem_assistente: res.mensagem_assistente,
      })

      const d = res.dados_extraidos
      setTipoDoc(d.tipo_documento || 'nota_fiscal')
      setFornecedor(d.fornecedor || '')
      setDataDocumento(d.data_documento || new Date().toLocaleDateString('pt-BR'))
      setValorTotal(Number(d.valor_total) || 0)
      setValorImpostos(Number(d.valor_impostos) || 0)
      setObservacoes(d.observacoes || '')
      setConfianca(d.confianca || 'alta')

      if (Array.isArray(d.itens) && d.itens.length > 0) {
        setItens(
          d.itens.map((it) => ({
            descricao: it.descricao || 'Item identificado',
            quantidade: Math.max(1, Number(it.quantidade) || 1),
            valor_unitario: Math.max(0, Number(it.valor_unitario) || 0),
            valor_total:
              Number(it.valor_total) ||
              (Number(it.quantidade) || 1) * (Number(it.valor_unitario) || 0),
          })),
        )
      } else {
        setItens([
          {
            descricao: 'Item principal da nota/recibo',
            quantidade: 1,
            valor_unitario: Number(d.valor_total) || 0,
            valor_total: Number(d.valor_total) || 0,
          },
        ])
      }

      setShowReviewCard(true)

      toast({
        title: res.leitura_automatica ? 'Foto Analisada com IA!' : 'Conferência Assistida Pronta',
        description: res.mensagem_assistente,
      })
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg = err instanceof Error ? err.message : 'Falha ao analisar imagem'
      toast({
        variant: 'destructive',
        title: 'Erro na análise',
        description: msg,
      })
      // Em caso de falha completa, abre card de conferência assistida com valores zerados para o usuário digitar
      setShowReviewCard(true)
      setAnalysisResult({
        leitura_automatica: false,
        modo_visao_suportado: false,
        mensagem_assistente:
          'Não foi possível processar a foto automaticamente. Você pode conferir a imagem ao lado e digitar os itens manualmente.',
      })
      setItens([{ descricao: 'Item a conferir', quantidade: 1, valor_unitario: 0, valor_total: 0 }])
    } finally {
      if (isMountedRef.current) {
        setIsAnalyzing(false)
      }
    }
  }

  // Manipulação de itens no Card Editável
  const handleAddItem = () => {
    setItens((prev) => [
      ...prev,
      { descricao: 'Novo item', quantidade: 1, valor_unitario: 0, valor_total: 0 },
    ])
  }

  const handleUpdateItem = (
    index: number,
    field: keyof DocumentoItemExtraido,
    value: string | number,
  ) => {
    setItens((prev) => {
      const next = [...prev]
      const current = { ...next[index], [field]: value }
      if (field === 'quantidade' || field === 'valor_unitario') {
        const q = Math.max(1, Number(field === 'quantidade' ? value : current.quantidade) || 1)
        const u = Math.max(
          0,
          Number(field === 'valor_unitario' ? value : current.valor_unitario) || 0,
        )
        current.valor_total = Number((q * u).toFixed(2))
      }
      next[index] = current
      return next
    })
  }

  const handleRemoveItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index))
  }

  // Descartar leitura atual
  const handleDescartar = () => {
    setShowReviewCard(false)
    setSelectedFile(null)
    setImagePreviewUrl(null)
    setImageBase64(null)
    setAnalysisResult(null)
    setItens([])
    setFornecedor('')
    setDataDocumento('')
    setValorTotal(0)
    setValorImpostos(0)
    setObservacoes('')
    pararCameraAoVivo()
    toast({
      title: 'Leitura descartada',
      description: 'A foto foi limpa e não foi salva.',
    })
  }

  // Reaproveitar documento já salvo no histórico
  const handleReaproveitarDocumento = (doc: DocumentoLido) => {
    setShowReviewCard(true)
    setTipoDoc(doc.tipo_documento)
    setFornecedor(doc.fornecedor || '')
    setDataDocumento(doc.data_documento || '')
    setValorTotal(doc.valor_total || 0)
    setValorImpostos(doc.valor_impostos || 0)
    setObservacoes(doc.observacoes || '')

    const urlFoto = documentosLidosService.obterUrlFoto(doc)
    setImagePreviewUrl(urlFoto)

    const itensDoc = doc.dados_extraidos?.itens || []
    if (itensDoc.length > 0) {
      setItens(itensDoc)
    } else {
      setItens([
        {
          descricao: doc.fornecedor ? `Compra de ${doc.fornecedor}` : 'Item do documento',
          quantidade: 1,
          valor_unitario: doc.valor_total || 0,
          valor_total: doc.valor_total || 0,
        },
      ])
    }

    setAnalysisResult({
      leitura_automatica: true,
      modo_visao_suportado: true,
      mensagem_assistente: `Documento "${doc.fornecedor || doc.tipo_documento}" carregado do histórico para reaproveitamento.`,
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast({
      title: 'Documento carregado do histórico',
      description: 'Você pode gerar um novo orçamento ou despesa com estes dados.',
    })
  }

  // Ação (a): Criar NOVO ORÇAMENTO com os dados extraídos
  const handleConfirmarCriarOrcamento = async () => {
    if (!user?.id) return
    setIsApplying(true)
    try {
      // 1. Resolve cliente
      let cliId = selectedClienteId
      if (!cliId && clienteNovoNome.trim()) {
        const novoCli = await clientesService.criar({
          nome: clienteNovoNome.trim(),
          email: `${clienteNovoNome.toLowerCase().replace(/\s+/g, '.')}@cliente.com`,
          user_id: user.id,
        })
        cliId = novoCli.id
      }

      if (!cliId && clientes.length > 0) {
        cliId = clientes[0].id
      }

      if (!cliId) {
        const nomePadrao = fornecedor || 'Cliente de Campo'
        const defaultCli = await clientesService.criar({
          nome: nomePadrao,
          email: `${nomePadrao.toLowerCase().replace(/\s+/g, '.')}@cliente.com`,
          user_id: user.id,
        })
        cliId = defaultCli.id
      }

      // 2. Cria orçamento
      const itensOrc = itens.map((it) => ({
        descricao: it.descricao,
        quantidade: it.quantidade,
        valor_unitario: it.valor_unitario,
      }))

      const sub = itensOrc.reduce((acc, it) => acc + it.quantidade * it.valor_unitario, 0)
      const proxNum = await orcamentosService.obterProximoNumero(user.id)

      const novoOrc = await orcamentosService.criar({
        cliente_id: cliId,
        descricao: `Orçamento gerado da foto: ${fornecedor || tipoDoc} (${dataDocumento || 'recibo'})`,
        itens: itensOrc,
        impostos: valorImpostos,
        subtotal: Number(sub.toFixed(2)),
        valor_total: Number(valorTotal.toFixed(2)),
        status: 'rascunho',
        numero: proxNum,
        user_id: user.id,
      })

      // 3. Salva documento na coleção documentos_lidos
      const docSalvo = await documentosLidosService.salvar({
        user_id: user.id,
        foto: selectedFile || undefined,
        tipo_documento: tipoDoc,
        fornecedor: fornecedor,
        data_documento: dataDocumento,
        valor_total: valorTotal,
        valor_impostos: valorImpostos,
        dados_extraidos: {
          tipo_documento: tipoDoc,
          fornecedor,
          data_documento: dataDocumento,
          itens,
          valor_total: valorTotal,
          valor_impostos: valorImpostos,
          observacoes,
          confianca,
        },
        acao_aplicada: 'orcamento_criado',
        orcamento_gerado_id: novoOrc.id,
        observacoes,
      })

      // 4. Gera RECIBO na coleção acoes_voz com validade de 24h e suporte a Desfazer
      const recibo = await acoesVozService.registrar({
        tipo_acao: 'documento_orcamento',
        titulo: `Orçamento ${novoOrc.numero} criado a partir de foto`,
        descricao_resumo: `${fornecedor ? `Fornecedor: ${fornecedor} · ` : ''}Total: ${formatarMoedaBRL(valorTotal)} (${itens.length} itens)`,
        registro_id: novoOrc.id,
        dados_aplicados: {
          orcamento_id: novoOrc.id,
          documento_lido_id: docSalvo.id,
          numero: novoOrc.numero,
          valor_total: valorTotal,
          fornecedor,
        },
        user_id: user.id,
      })

      setUltimoRecibo(recibo)
      setModalOrcamentoOpen(false)
      handleDescartar()
      await carregarDados()

      toast({
        title: 'Orçamento Criado com Sucesso!',
        description: `Orçamento ${novoOrc.numero} gerado a partir da foto. Recibo emitido.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar orçamento'
      toast({
        variant: 'destructive',
        title: 'Erro ao criar orçamento',
        description: msg,
      })
    } finally {
      setIsApplying(false)
    }
  }

  // Ação (b): Registrar como DESPESA / custo vinculado a um orçamento existente
  const handleConfirmarVincularDespesa = async () => {
    if (!user?.id) return
    if (!selectedOrcamentoId) {
      toast({
        variant: 'destructive',
        title: 'Selecione um orçamento',
        description: 'Escolha a qual orçamento este custo/recibo será vinculado.',
      })
      return
    }

    setIsApplying(true)
    try {
      const orcAlvo = orcamentos.find((o) => o.id === selectedOrcamentoId)

      // Salva documento na coleção documentos_lidos
      const docSalvo = await documentosLidosService.salvar({
        user_id: user.id,
        foto: selectedFile || undefined,
        tipo_documento: tipoDoc,
        fornecedor: fornecedor,
        data_documento: dataDocumento,
        valor_total: valorTotal,
        valor_impostos: valorImpostos,
        dados_extraidos: {
          tipo_documento: tipoDoc,
          fornecedor,
          data_documento: dataDocumento,
          itens,
          valor_total: valorTotal,
          valor_impostos: valorImpostos,
          observacoes,
          confianca,
        },
        acao_aplicada: 'despesa_vinculada',
        orcamento_vinculado_id: selectedOrcamentoId,
        observacoes:
          `Custo/Despesa vinculada ao orçamento ${orcAlvo?.numero || ''}. ${observacoes}`.trim(),
      })

      // Gera RECIBO na coleção acoes_voz com suporte a Desfazer
      const recibo = await acoesVozService.registrar({
        tipo_acao: 'documento_despesa',
        titulo: `Despesa de campo vinculada ao Orçamento ${orcAlvo?.numero || ''}`,
        descricao_resumo: `${fornecedor ? `${fornecedor} · ` : ''}Valor: ${formatarMoedaBRL(valorTotal)}`,
        registro_id: docSalvo.id,
        dados_aplicados: {
          documento_lido_id: docSalvo.id,
          orcamento_id: selectedOrcamentoId,
          orcamento_numero: orcAlvo?.numero,
          valor_total: valorTotal,
          fornecedor,
        },
        user_id: user.id,
      })

      setUltimoRecibo(recibo)
      setModalDespesaOpen(false)
      handleDescartar()
      await carregarDados()

      toast({
        title: 'Despesa Vinculada!',
        description: `Recibo registrado como custo do orçamento ${orcAlvo?.numero || ''}.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao vincular despesa'
      toast({
        variant: 'destructive',
        title: 'Erro ao vincular despesa',
        description: msg,
      })
    } finally {
      setIsApplying(false)
    }
  }

  // Ação (c): Apenas SALVAR no histórico
  const handleApenasSalvar = async () => {
    if (!user?.id) return
    setIsApplying(true)
    try {
      await documentosLidosService.salvar({
        user_id: user.id,
        foto: selectedFile || undefined,
        tipo_documento: tipoDoc,
        fornecedor: fornecedor,
        data_documento: dataDocumento,
        valor_total: valorTotal,
        valor_impostos: valorImpostos,
        dados_extraidos: {
          tipo_documento: tipoDoc,
          fornecedor,
          data_documento: dataDocumento,
          itens,
          valor_total: valorTotal,
          valor_impostos: valorImpostos,
          observacoes,
          confianca,
        },
        acao_aplicada: 'apenas_salvo',
        observacoes,
      })

      toast({
        title: 'Documento Salvo no Histórico!',
        description: 'Você poderá consultá-lo ou reaproveitá-lo a qualquer momento.',
      })

      handleDescartar()
      await carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar documento'
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: msg,
      })
    } finally {
      setIsApplying(false)
    }
  }

  // Desfazer Ação via Recibo (24h)
  const handleDesfazerAcao = async (acao: AcaoVozRegistro) => {
    setUndoingAcaoId(acao.id)
    try {
      const res = await acoesVozService.desfazer(acao)
      if (res.sucesso) {
        toast({
          title: 'Ação desfeita com sucesso!',
          description: res.mensagem,
        })
        if (ultimoRecibo?.id === acao.id) {
          setUltimoRecibo((prev) => (prev ? { ...prev, status: 'desfeito' } : null))
        }
        await carregarDados()
      } else {
        toast({
          variant: 'destructive',
          title: 'Não foi possível desfazer',
          description: res.mensagem,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao desfazer'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    } finally {
      setUndoingAcaoId(null)
    }
  }

  const handleEditarAcao = (acao: AcaoVozRegistro) => {
    const dados = (acao.dados_aplicados || {}) as Record<string, unknown>
    if (dados.orcamento_id) {
      navigate(`/orcamentos/${dados.orcamento_id}/editar`)
    } else if (acao.registro_id) {
      navigate(`/orcamentos/${acao.registro_id}/editar`)
    }
  }

  const getTipoLabel = (tipo: DocumentoTipo) => {
    switch (tipo) {
      case 'nota_fiscal':
        return 'Nota Fiscal'
      case 'recibo':
        return 'Recibo'
      case 'orcamento_papel':
        return 'Orçamento em Papel'
      case 'lista_materiais':
        return 'Lista de Materiais'
      case 'comprovante':
        return 'Comprovante'
      default:
        return 'Documento'
    }
  }

  const getAcaoBadge = (acao?: string) => {
    switch (acao) {
      case 'orcamento_criado':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
            Orçamento Criado
          </Badge>
        )
      case 'despesa_vinculada':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
            Despesa Vinculada
          </Badge>
        )
      case 'apenas_salvo':
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
            Salvo no Histórico
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            Pendente
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-5xl mx-auto">
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Assistente de Campo
            </h2>
            <Badge className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold">
              Persona Luna
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Tire foto de notas fiscais, recibos, orçamentos em papel ou listas de materiais. A IA
            extrai os dados para criar orçamentos ou registrar custos de obra.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/orcamentos')}
            className="text-xs text-slate-600"
          >
            Ver Orçamentos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/modo-voz')}
            className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            Modo Só Falar
          </Button>
        </div>
      </div>

      {/* ÁREA DE CAPTURA / UPLOAD DE FOTO */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-violet-600" />
              Tirar ou Enviar Foto de Documento
            </h3>
            <p className="text-xs text-slate-500">
              Fotos com boa iluminação e texto legível garantem a melhor precisão na leitura.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Input escondido para Câmera nativa (capture="environment") */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Input escondido para Galeria / Arquivos / PDFs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            <Button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="bg-violet-600 hover:bg-violet-700 text-white text-xs sm:text-sm shadow-sm"
              disabled={isAnalyzing}
            >
              <Camera className="w-4 h-4 mr-1.5" />
              Tirar Foto
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm"
              disabled={isAnalyzing}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Galeria / Arquivo
            </Button>
          </div>
        </div>

        {/* FEED DE CÂMERA AO VIVO SE ATIVO */}
        {cameraActive && (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-[380px] flex items-center justify-center border-2 border-violet-500">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
              <Button
                type="button"
                onClick={capturarFrameCamera}
                className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-6 py-2 rounded-full shadow-lg text-sm"
              >
                Capturar Foto
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={pararCameraAoVivo}
                className="rounded-full text-xs"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* PREVIEW DA FOTO SELECIONADA OU LOADER DE ANÁLISE */}
        {isAnalyzing && (
          <div className="p-8 rounded-2xl bg-violet-50/70 border border-violet-200 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-violet-600" />
            <h4 className="text-sm font-bold text-violet-950">
              Assistente de Campo analisando a imagem...
            </h4>
            <p className="text-xs text-violet-700 max-w-md mx-auto">
              Identificando tipo de documento, emissor, valores, impostos e discriminando cada item
              da foto.
            </p>
          </div>
        )}
      </div>

      {/* CARD PRINCIPAL "O QUE A IA LEU NA FOTO" (EDITÁVEL ANTES DE APLICAR) */}
      {showReviewCard && (
        <div className="bg-white rounded-2xl border-2 border-violet-500/80 shadow-lg p-4 sm:p-6 space-y-5 animate-scale-in">
          {/* TOPO DO CARD: STATUS DA LEITURA E FOTO VISÍVEL AO LADO (CONFERÊNCIA ASSISTIDA) */}
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            {/* MINIATURA DA FOTO (SEMPRE VISÍVEL AO LADO PARA CONFERÊNCIA TRANSPARENTE) */}
            {imagePreviewUrl && (
              <div className="w-full lg:w-[220px] shrink-0 bg-slate-900 rounded-xl overflow-hidden border border-slate-300 relative group">
                <img
                  src={imagePreviewUrl}
                  alt="Foto do documento analisado"
                  className="w-full h-48 lg:h-64 object-contain bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => setModalFotoVisualizar(imagePreviewUrl)}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-semibold gap-1"
                >
                  <Eye className="w-5 h-5" />
                  Clique para ampliar
                </button>
                <div className="p-1.5 bg-slate-800 text-center">
                  <span className="text-[10px] text-slate-300 flex items-center justify-center gap-1">
                    <Info className="w-3 h-3 text-violet-400" />
                    Foto original para conferência
                  </span>
                </div>
              </div>
            )}

            {/* DADOS EXTRAÍDOS E CAMPOS EDITÁVEIS */}
            <div className="flex-1 space-y-4 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shadow-xs">
                      <FileCheck2 className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">O que a IA leu na foto</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {analysisResult?.mensagem_assistente ||
                      'Confira e ajuste os dados abaixo antes de aplicar.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-bold py-0.5 px-2 ${
                      analysisResult?.modo_visao_suportado
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}
                  >
                    {analysisResult?.modo_visao_suportado
                      ? 'Visão IA Ativa'
                      : 'Conferência Assistida'}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDescartar}
                    className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Descartar
                  </Button>
                </div>
              </div>

              {/* CAMPOS CABEÇALHO DO DOCUMENTO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Tipo de Documento
                  </label>
                  <Select value={tipoDoc} onValueChange={(v) => setTipoDoc(v as DocumentoTipo)}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nota_fiscal">Nota Fiscal / Cupom</SelectItem>
                      <SelectItem value="recibo">Recibo de Pagamento</SelectItem>
                      <SelectItem value="orcamento_papel">Orçamento em Papel</SelectItem>
                      <SelectItem value="lista_materiais">Lista de Materiais</SelectItem>
                      <SelectItem value="comprovante">Comprovante</SelectItem>
                      <SelectItem value="outro">Outro Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Fornecedor / Emissor
                  </label>
                  <Input
                    value={fornecedor}
                    onChange={(e) => setFornecedor(e.target.value)}
                    placeholder="Ex: Madeireira São José"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Data do Documento
                  </label>
                  <Input
                    value={dataDocumento}
                    onChange={(e) => setDataDocumento(e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>

              {/* TABELA DE ITENS EXTRAÍDOS EDITÁVEIS */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-violet-600" />
                    Itens e Valores Identificados ({itens.length})
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    className="h-7 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Item
                  </Button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
                  {itens.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs hover:bg-white transition-colors"
                    >
                      <div className="flex-1">
                        <Input
                          value={it.descricao}
                          onChange={(e) => handleUpdateItem(idx, 'descricao', e.target.value)}
                          placeholder="Descrição do material ou serviço"
                          className="h-8 text-xs bg-white"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-20">
                          <Input
                            type="number"
                            min="1"
                            value={it.quantidade}
                            onChange={(e) =>
                              handleUpdateItem(idx, 'quantidade', Number(e.target.value) || 1)
                            }
                            placeholder="Qtd"
                            className="h-8 text-xs text-center bg-white"
                          />
                        </div>

                        <div className="w-28">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.valor_unitario}
                            onChange={(e) =>
                              handleUpdateItem(idx, 'valor_unitario', Number(e.target.value) || 0)
                            }
                            placeholder="R$ Unit"
                            className="h-8 text-xs text-right bg-white"
                          />
                        </div>

                        <div className="w-28 text-right font-bold text-slate-800 tabular-nums pr-1">
                          {formatarMoedaBRL(it.valor_total)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                          title="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TOTAIS E IMPOSTOS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600">Impostos (R$):</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorImpostos}
                    onChange={(e) => setValorImpostos(Number(e.target.value) || 0)}
                    className="h-8 w-28 text-xs text-right bg-white"
                  />
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500 mr-2">Valor Total do Documento:</span>
                  <span className="text-lg font-black text-slate-900 tabular-nums">
                    {formatarMoedaBRL(valorTotal)}
                  </span>
                </div>
              </div>

              {/* BARRA DE AÇÕES CONCRETAS (REQUISITO 4) */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleApenasSalvar}
                  disabled={isApplying}
                  className="h-9 text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <Save className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Apenas Salvar no Histórico
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalDespesaOpen(true)}
                  disabled={isApplying}
                  className="h-9 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold"
                >
                  <DollarSign className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Vincular como Despesa
                </Button>

                <Button
                  type="button"
                  onClick={() => setModalOrcamentoOpen(true)}
                  disabled={isApplying}
                  className="h-9 text-xs bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 text-white font-bold shadow-md"
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  Criar Novo Orçamento com Estes Itens
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECIBO DA ÚLTIMA AÇÃO APLICADA (24h, DESFAZER E EDITAR) */}
      {ultimoRecibo && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Recibo da Última Ação do Assistente
            </h4>
            <span className="text-[11px] text-slate-400">Desfizável nas últimas 24h</span>
          </div>
          <ReciboAcaoVoz
            acao={ultimoRecibo}
            onDesfazer={handleDesfazerAcao}
            onEditar={handleEditarAcao}
            isUndoing={undoingAcaoId === ultimoRecibo.id}
          />
        </div>
      )}

      {/* HISTÓRICO DE DOCUMENTOS LIDOS DESTE USUÁRIO */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-violet-600" />
              Histórico de Fotos & Documentos Lidos
            </h3>
            <p className="text-xs text-slate-500">
              Cada usuário só visualiza seus próprios documentos. Clique para reaproveitar itens em
              novos orçamentos.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={carregarDados}
            className="h-8 text-xs text-slate-600 hover:text-slate-900"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Atualizar
          </Button>
        </div>

        {loadingHistorico ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-violet-600 mb-2" />
            Carregando documentos lidos...
          </div>
        ) : documentosHistorico.length === 0 ? (
          <div className="py-10 text-center text-slate-400 space-y-2">
            <Receipt className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs sm:text-sm font-medium text-slate-600">
              Nenhum documento lido ainda
            </p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Tire uma foto de uma nota de material ou recibo acima para iniciar o histórico do
              assistente de campo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documentosHistorico.map((doc) => {
              const urlFoto = documentosLidosService.obterUrlFoto(doc)
              const qtdItens = doc.dados_extraidos?.itens?.length || 0

              return (
                <div
                  key={doc.id}
                  className="p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-violet-300 hover:shadow-sm transition-all bg-slate-50/50 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    {urlFoto ? (
                      <img
                        src={urlFoto}
                        alt="Miniatura do documento"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-300 shrink-0 bg-slate-900 cursor-pointer"
                        onClick={() => setModalFotoVisualizar(urlFoto)}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {doc.fornecedor || getTipoLabel(doc.tipo_documento)}
                        </span>
                        {getAcaoBadge(doc.acao_aplicada)}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{getTipoLabel(doc.tipo_documento)}</span>
                        <span>•</span>
                        <span>{formatarData(doc.created)}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-slate-900 tabular-nums">
                          {formatarMoedaBRL(doc.valor_total || 0)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {qtdItens} {qtdItens === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    {urlFoto && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setModalFotoVisualizar(urlFoto)}
                        className="h-7 text-[11px] text-slate-600 px-2"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Ver Foto
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleReaproveitarDocumento(doc)}
                      className="h-7 text-[11px] bg-violet-600 hover:bg-violet-700 text-white font-medium ml-auto px-3"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Reaproveitar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DE CRIAÇÃO DE ORÇAMENTO (AÇÃO A) */}
      <Dialog open={modalOrcamentoOpen} onOpenChange={setModalOrcamentoOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Criar Orçamento com Itens da Foto
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Selecione o cliente que receberá a proposta. Os itens extraídos da foto já serão
              pré-preenchidos automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700">Selecione um Cliente:</label>
              <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                <SelectTrigger className="mt-1 h-9 text-xs">
                  <SelectValue placeholder="Escolha um cliente cadastrado..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.empresa ? `(${c.empresa})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-center text-xs text-slate-400 font-semibold">— OU CRIE NOVO —</div>

            <div>
              <label className="text-xs font-bold text-slate-700">Nome do Novo Cliente:</label>
              <Input
                value={clienteNovoNome}
                onChange={(e) => {
                  setClienteNovoNome(e.target.value)
                  if (e.target.value) setSelectedClienteId('')
                }}
                placeholder="Ex: João da Obra Jardim América"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
              <div className="flex justify-between font-bold">
                <span>Total de Itens:</span>
                <span>{itens.length}</span>
              </div>
              <div className="flex justify-between font-bold text-sm">
                <span>Valor Total da Proposta:</span>
                <span>{formatarMoedaBRL(valorTotal)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOrcamentoOpen(false)}
              disabled={isApplying}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarCriarOrcamento}
              disabled={isApplying}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Gerando Orçamento...
                </>
              ) : (
                'Gerar Orçamento Agora'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE VINCULAR COMO DESPESA (AÇÃO B) */}
      <Dialog open={modalDespesaOpen} onOpenChange={setModalDespesaOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              Vincular Despesa a um Orçamento
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Associe o custo deste recibo/nota a uma proposta comercial em andamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700">
                Selecione o Orçamento Alvo:
              </label>
              <Select value={selectedOrcamentoId} onValueChange={setSelectedOrcamentoId}>
                <SelectTrigger className="mt-1 h-9 text-xs">
                  <SelectValue placeholder="Escolha o orçamento..." />
                </SelectTrigger>
                <SelectContent>
                  {orcamentos.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.numero} - {o.descricao.slice(0, 35)} ({formatarMoedaBRL(o.valor_total)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Fornecedor:</span>
                <span>{fornecedor || 'Não especificado'}</span>
              </div>
              <div className="flex justify-between font-bold text-sm">
                <span>Valor do Custo:</span>
                <span>{formatarMoedaBRL(valorTotal)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalDespesaOpen(false)}
              disabled={isApplying}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarVincularDespesa}
              disabled={isApplying || !selectedOrcamentoId}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Vinculando...
                </>
              ) : (
                'Vincular Despesa'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE VISUALIZAÇÃO AMPLIADA DA FOTO */}
      <Dialog
        open={!!modalFotoVisualizar}
        onOpenChange={(open) => !open && setModalFotoVisualizar(null)}
      >
        <DialogContent className="max-w-2xl bg-slate-950 p-2 border-slate-800 text-white">
          <div className="relative flex flex-col items-center justify-center">
            {modalFotoVisualizar && (
              <img
                src={modalFotoVisualizar}
                alt="Documento ampliado"
                className="max-h-[80vh] w-auto object-contain rounded-lg"
              />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalFotoVisualizar(null)}
              className="mt-3 bg-white/10 hover:bg-white/20 text-white text-xs border-white/20"
            >
              Fechar Visualização
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
