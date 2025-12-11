declare module 'cozy-ui/*'

declare module 'cozy-ui/transpiled/react/styles' {
  export function makeStyles<T>(styles: T): () => T
}

declare module 'cozy-ui/transpiled/react/Icons/*' {
  const Icon: React.ComponentType<{
    className?: string
    color?: string
    size?: string
  }>
  export default Icon
}

declare module 'cozy-ui/transpiled/react' {
  export const logger: {
    info: (message: string, ...rest: unknown[]) => void
  }

  export const BreakpointsProvider: React.ComponentType
  export const MuiCozyTheme: React.ComponentType
}

declare module 'twake-i18n' {
  export const useI18n: () => {
    t: (key: string, options?: Record<string, unknown>) => string
    f: (date: Date | number, format: string) => string
    lang: string
  }
}

declare module 'cozy-ui/transpiled/react/providers/Alert' {
  export interface showAlertProps {
    message: string
    severity?:
      | 'primary'
      | 'secondary'
      | 'success'
      | 'error'
      | 'warning'
      | 'info'
    action?: React.ReactNode
  }

  export type showAlertFunction = (props: showAlertProps) => void

  export const useAlert: () => {
    showAlert: showAlertFunction
  }
}

declare module 'cozy-ui/transpiled/react/providers/Breakpoints' {
  const useBreakpoints: () => {
    isMobile: boolean
    isTablet: boolean
    isDesktop: boolean
  }

  export default useBreakpoints
}

declare module 'models/index' {
  export const CozyFile: {
    splitFilename: (file: IOCozyFile) => { filename: string; extension: string }
  }
}

declare module 'cozy-client/dist/models/file' {
  export const splitFilename: (file: IOCozyFile) => {
    filename: string
    extension: string
  }
  export const isFile: (file: IOCozyFile) => boolean
  export const copy: (
    client: import('cozy-client/types/CozyClient').CozyClient,
    file: Partial<import('components/FolderPicker/types').File>,
    destination: import('components/FolderPicker/types').File
  ) => Promise<void>
  export const isDirectory: (
    file: import('components/FolderPicker/types').File
  ) => boolean
  export const isOnlyOfficeFile: (
    file: import('components/FolderPicker/types').File
  ) => boolean
  export const isShortcut: (
    file: import('components/FolderPicker/types').File
  ) => boolean
  export const isNote: (
    file: import('components/FolderPicker/types').File
  ) => boolean
  export const isDocs: (
    file: import('components/FolderPicker/types').File
  ) => boolean
  export const shouldBeOpenedByOnlyOffice: (
    file: import('components/FolderPicker/types').File
  ) => boolean
  export const getFullpath: (
    client: import('cozy-client/types/CozyClient').CozyClient,
    dirID: string,
    filename: string,
    driveId: string
  ) => Promise<string>
}

declare module 'cozy-client/dist/models/note' {
  export const fetchURL: (
    client: import('cozy-client/types/CozyClient').CozyClient,
    file: { id: string },
    options: { pathname: string }
  ) => Promise<string>
}

declare module 'cozy-client/dist/models/instance' {
  export const buildPremiumLink: (instanceInfo: InstanceInfo) => string
}

declare module 'cozy-ui-plus/dist/Paywall' {
  export const AiAssistantPaywall: React.ComponentType<{
    onClose: () => void
  }>
}

declare module '*.svg' {
  import { FC, SVGProps } from 'react'
  const content: FC<SVGProps<SVGElement>>
  export default content
}

declare module 'cozy-ui/transpiled/react/ActionsMenu/Actions' {
  export interface Action<T = import('cozy-client/types/types').IOCozyFile> {
    name: string
    label?: string
    icon: React.ComponentType | string
    displayInSelectionBar?: boolean
    displayCondition?: (
      docs: import('cozy-client/types/types').IOCozyFile[]
    ) => boolean
    disabled?: (docs: import('cozy-client/types/types').IOCozyFile[]) => boolean
    action?: (
      docs: T[],
      opts: { handleAction: HandleActionCallback }
    ) => Promise<void> | void
    Component: ForwardRefExoticComponent<RefAttributes<React.ComponentType>>
  }

  export function divider(): Action

  export function makeActions(
    arg1: (((props?: T) => Action) | boolean)[],
    T
  ): Record<string, Action>[]
}

declare module 'cozy-sharing' {
  export const useSharingContext: () => {
    allLoaded: boolean
    refresh: () => void
  }

  export const useNativeFileSharing: () => {
    isNativeFileSharingAvailable: boolean
    shareFilesNative: (
      files: import('cozy-client/types/CozyClient').CozyClient[]
    ) => void
  }

  export const shareNative: (props?: T) => Action
}

declare module 'cozy-ui/transpiled/react/Nav' {
  export const NavIcon: React.ComponentType<{
    icon: string | React.ComponentType
  }>
  export const NavText: React.ComponentType
  export const NavItem: React.ComponentType
  export const NavLink: { className: string; activeClassName: string }
}

declare module 'cozy-ui/transpiled/react/Typography' {
  const Typography: React.ComponentType<{
    variant?: string
    color?: string
    noWrap?: boolean
    className?: string
  }>
  export default Typography
}

declare module 'cozy-keys-lib' {
  export const useVaultClient: () => object
}

declare module '*.styl' {
  const content: Record<string, string>
  export default content
}

declare module 'cozy-realtime' {
  export default class CozyRealtime {
    constructor(options: {
      client: import('cozy-client').default
      sharedDriveId?: string
    })
    subscribe: (
      event: string,
      doctype: string,
      callback: () => void | Promise<void>
    ) => void
    unsubscribe: (
      event: string,
      doctype: string,
      callback: () => void | Promise<void>
    ) => void
    stop: () => void
  }
}

declare module 'cozy-viewer/dist/Panel/AI/AIAssistantPanel' {
  const AIAssistantPanel: React.ComponentType<{
    className?: string
  }>
  export default AIAssistantPanel
}

declare module 'cozy-viewer/dist/hoc/withViewerLocales' {
  const withViewerLocales: <P>(
    Component: React.ComponentType<P>
  ) => React.ComponentType<P>
  export { withViewerLocales }
}

declare module 'cozy-viewer/dist/providers/ViewerProvider' {
  export const useViewer: () => {
    isOpenAiAssistant: boolean
  }
}
