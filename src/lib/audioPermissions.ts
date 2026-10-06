export type PlatformType =
  | 'ios-safari'
  | 'ios-other'
  | 'android'
  | 'desktop-chrome'
  | 'desktop-other'

export interface PlatformPermissionGuide {
  platform: PlatformType
  title: string
  subtitle: string
  steps: string[]
  alternativeStep?: string
  badge: string
}

/**
 * Detecta plataforma/navegador com precisão no client-side
 */
export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop-other'
  }

  const ua = navigator.userAgent || ''
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  const isAndroid = /Android/.test(ua)

  if (isIOS) {
    // Safari no iOS geralmente contém Version/X e Safari/X sem CriOS (Chrome iOS) ou FxiOS (Firefox iOS)
    const isWebKitSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
    return isWebKitSafari ? 'ios-safari' : 'ios-other'
  }

  if (isAndroid) {
    return 'android'
  }

  const isChromeOrEdge = /Chrome|Chromium|Edg\//.test(ua)
  return isChromeOrEdge ? 'desktop-chrome' : 'desktop-other'
}

/**
 * Retorna as instruções passo a passo em português adequadas a cada ambiente
 */
export function getPermissionGuide(
  platform: PlatformType = detectPlatform(),
): PlatformPermissionGuide {
  switch (platform) {
    case 'ios-safari':
      return {
        platform: 'ios-safari',
        badge: 'iPhone / iPad (Safari)',
        title: 'Como permitir o microfone no Safari do iPhone:',
        subtitle:
          'O Safari no iOS bloqueia o áudio até você autorizar pelo menu de endereço ou ajustes.',
        steps: [
          'Toque no botão "aA" (ou ícone de página) no lado esquerdo da barra de endereço.',
          'Toque em "Configurações do Site" (ou Ajustes do Site).',
          'Na opção Microfone, selecione "Permitir" (ou "Perguntar").',
          'Recarregue esta página e toque em "TOCAR P/ FALAR" novamente.',
        ],
        alternativeStep:
          'Se preferir: abra o app Ajustes do iPhone → role até Safari → Microfone → mude para "Permitir".',
      }

    case 'ios-other':
      return {
        platform: 'ios-other',
        badge: 'iPhone / iPad (Outro navegador)',
        title: 'Como permitir o microfone no iPhone:',
        subtitle: 'No iOS, o microfone precisa estar liberado nos Ajustes do aparelho.',
        steps: [
          'Abra o app Ajustes do seu iPhone.',
          'Role a lista de aplicativos e localize o seu navegador (ex: Chrome).',
          'Ative a chave verde ao lado de "Microfone".',
          'Volte aqui e toque em "Tentar novamente".',
        ],
      }

    case 'android':
      return {
        platform: 'android',
        badge: 'Android (Chrome)',
        title: 'Como permitir o microfone no Android:',
        subtitle: 'Conceda a permissão na barra de endereços do Chrome.',
        steps: [
          'Toque no ícone de configurações ao lado da URL (ícone de cadeado ou controles deslizantes).',
          'Toque em "Permissões" → "Microfone".',
          'Selecione "Permitir".',
          'Toque no botão abaixo para tentar novamente.',
        ],
      }

    case 'desktop-chrome':
    default:
      return {
        platform: 'desktop-chrome',
        badge: 'Computador (Chrome / Edge)',
        title: 'Como permitir o microfone no computador:',
        subtitle: 'Conceda a permissão na barra de navegação superior.',
        steps: [
          'Clique no ícone de cadeado ou controles de site à esquerda do endereço do site.',
          'Localize "Microfone" e mude a chave para "Permitir".',
          'Recarregue a página se solicitado e tente falar novamente.',
        ],
      }
  }
}
