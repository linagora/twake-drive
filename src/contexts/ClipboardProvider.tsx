import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode
} from 'react'

import { IOCozyFile } from 'cozy-client/types/types'

export const OPERATION_CUT = 'cut' as const
export const OPERATION_COPY = 'copy' as const

interface MoveValidationModal {
  isVisible: boolean
  type: 'moveOutside' | 'moveInside' | 'moveSharedInside' | null
  file: IOCozyFile | null
  targetFolder: IOCozyFile
  onConfirm: (() => Promise<void>) | null
  onCancel: (() => void) | null
}

interface ClipboardState {
  files: IOCozyFile[]
  operation: typeof OPERATION_COPY | typeof OPERATION_CUT | null
  timestamp: number | null
  cutItemIds: Set<string>
  sourceFolderIds: Set<string> | null
  moveValidationModal: MoveValidationModal
  sourceDirectory: IOCozyFile
}

interface ClipboardContextValue {
  clipboardData: ClipboardState
  copyFiles: (files: IOCozyFile[], sourceFolderIds?: Set<string>) => void
  cutFiles: (
    files: IOCozyFile[],
    sourceFolderIds?: Set<string>,
    sourceDirectory?: IOCozyFile
  ) => void
  clearClipboard: () => void
  hasClipboardData: boolean
  isItemCut: (itemId: string) => boolean
  showMoveValidationModal: (
    type: MoveValidationModal['type'],
    file: IOCozyFile,
    targetFolder: IOCozyFile,
    onConfirm: () => Promise<void>,
    onCancel: () => void
  ) => void
  hideMoveValidationModal: () => void
  moveValidationModal: MoveValidationModal
}

const COPY_FILES = 'COPY_FILES'
const CUT_FILES = 'CUT_FILES'
const CLEAR_CLIPBOARD = 'CLEAR_CLIPBOARD'
const SHOW_SHARING_MODAL = 'SHOW_SHARING_MODAL'
const HIDE_SHARING_MODAL = 'HIDE_SHARING_MODAL'

type ClipboardAction =
  | {
      type: typeof COPY_FILES
      payload: {
        files: IOCozyFile[]
        sourceFolderIds?: Set<string>
        sourceDirectory?: IOCozyFile
      }
    }
  | {
      type: typeof CUT_FILES
      payload: {
        files: IOCozyFile[]
        sourceFolderIds?: Set<string>
        sourceDirectory?: IOCozyFile
      }
    }
  | { type: typeof CLEAR_CLIPBOARD }
  | {
      type: typeof SHOW_SHARING_MODAL
      payload: {
        type: MoveValidationModal['type']
        file: IOCozyFile
        targetFolder: IOCozyFile
        onConfirm: () => Promise<void>
        onCancel: () => void
      }
    }
  | { type: typeof HIDE_SHARING_MODAL }

const initialState: ClipboardState = {
  files: [],
  operation: null,
  timestamp: null,
  cutItemIds: new Set(),
  sourceFolderIds: new Set(),
  sourceDirectory: {} as IOCozyFile,
  moveValidationModal: {
    isVisible: false,
    type: null,
    file: null,
    targetFolder: {} as IOCozyFile,
    onConfirm: null,
    onCancel: null
  }
}

const clipboardReducer = (
  state: ClipboardState,
  action: ClipboardAction
): ClipboardState => {
  switch (action.type) {
    case COPY_FILES:
      return {
        ...state,
        files: [...action.payload.files],
        operation: OPERATION_COPY,
        timestamp: Date.now(),
        cutItemIds: new Set(),
        sourceFolderIds: action.payload.sourceFolderIds ?? null,
        sourceDirectory: action.payload.sourceDirectory ?? ({} as IOCozyFile)
      }
    case CUT_FILES:
      return {
        ...state,
        files: [...action.payload.files],
        operation: OPERATION_CUT,
        timestamp: Date.now(),
        cutItemIds: new Set(action.payload.files.map(file => file._id)),
        sourceFolderIds: action.payload.sourceFolderIds ?? null,
        sourceDirectory: action.payload.sourceDirectory ?? ({} as IOCozyFile)
      }
    case CLEAR_CLIPBOARD:
      return {
        ...initialState
      }
    case SHOW_SHARING_MODAL:
      return {
        ...state,
        moveValidationModal: {
          isVisible: true,
          type: action.payload.type,
          file: action.payload.file,
          targetFolder: action.payload.targetFolder,
          onConfirm: action.payload.onConfirm,
          onCancel: action.payload.onCancel
        }
      }
    case HIDE_SHARING_MODAL:
      return {
        ...state,
        moveValidationModal: {
          ...initialState.moveValidationModal
        }
      }
    default:
      return state
  }
}

const ClipboardContext = createContext<ClipboardContextValue | undefined>(
  undefined
)

interface ClipboardProviderProps {
  children: ReactNode
}

const ClipboardProvider: React.FC<ClipboardProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(clipboardReducer, initialState)

  const copyFiles = useCallback(
    (files: IOCozyFile[], sourceFolderIds?: Set<string>) => {
      dispatch({
        type: COPY_FILES,
        payload: { files, sourceFolderIds }
      })
    },
    []
  )

  const cutFiles = useCallback(
    (
      files: IOCozyFile[],
      sourceFolderIds?: Set<string>,
      sourceDirectory?: IOCozyFile
    ) => {
      dispatch({
        type: CUT_FILES,
        payload: { files, sourceFolderIds, sourceDirectory }
      })
    },
    []
  )

  const clearClipboard = useCallback(() => {
    dispatch({ type: CLEAR_CLIPBOARD })
  }, [])

  const showMoveValidationModal = useCallback(
    (
      type: MoveValidationModal['type'],
      file: IOCozyFile,
      targetFolder: IOCozyFile,
      onConfirm: () => Promise<void>,
      onCancel: () => void
    ) => {
      dispatch({
        type: SHOW_SHARING_MODAL,
        payload: { type, file, targetFolder, onConfirm, onCancel }
      })
    },
    []
  )

  const hideMoveValidationModal = useCallback(() => {
    dispatch({ type: HIDE_SHARING_MODAL })
  }, [])

  const hasClipboardData = state.files.length > 0 && Boolean(state.operation)

  const isItemCut = useCallback(
    (itemId: string) => {
      return state.cutItemIds.has(itemId)
    },
    [state.cutItemIds]
  )

  const value: ClipboardContextValue = {
    clipboardData: state,
    copyFiles,
    cutFiles,
    clearClipboard,
    hasClipboardData,
    isItemCut,
    showMoveValidationModal,
    hideMoveValidationModal,
    moveValidationModal: state.moveValidationModal
  }

  return (
    <ClipboardContext.Provider value={value}>
      {children}
    </ClipboardContext.Provider>
  )
}

export const useClipboardContext = (): ClipboardContextValue => {
  const context = useContext(ClipboardContext)
  if (!context) {
    throw new Error(
      'useClipboardContext must be used within a ClipboardProvider'
    )
  }
  return context
}

export default ClipboardProvider
