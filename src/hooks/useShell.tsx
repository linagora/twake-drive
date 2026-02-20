// Imports
import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BarLeft } from 'cozy-bar'
import type { File } from '@/components/FolderPicker/types'

// Types
interface ShellContextType {
  runsInShell: boolean
  setRunsInShell: React.Dispatch<React.SetStateAction<boolean>>
  selectedFile: string | null
  setSelectedFile: React.Dispatch<React.SetStateAction<string | null>>
  openFileInParent: (file: File) => void
}

// Context
const ShellContext = createContext<ShellContextType | undefined>(undefined)

export const ShellProvider = ({
  children
}: {
  children: React.ReactNode
}): JSX.Element => {
  const navigate = useNavigate()

  const [runsInShell, setRunsInShell] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  useEffect(() => {
    if (window.top) {
      window.top.postMessage('loaded', '*')
    }

    window.onmessage = function (e: MessageEvent): void {
      if (e.data == undefined || e.data == null || typeof e.data !== 'string')
        return
      if (e.data === 'inShell:true') {
        setRunsInShell(true)
      }
      if (e.data.startsWith('selectedFile:')) {
        const fileId = e.data.split('selectedFile:')[1].trim()
        setSelectedFile(fileId)
      }
      if (e.data.startsWith('openFolder:')) {
        const folderId = e.data.split('openFolder:')[1].trim()
        navigate(`/folder/${folderId}`)
      }
    }
  }, [navigate])

  if (runsInShell) {
    const CSS = `
      .coz-bar-container nav, .coz-bar-container a {
        display: none !important;
      }

      .coz-bar-container button[aria-label="Rechercher"] {
        margin-right: -12px;
      }
    `

    const style = document.createElement('style')
    style.type = 'text/css'
    style.appendChild(document.createTextNode(CSS))
    document.head.appendChild(style)
  }

  const openFileInParent = (file: File): void => {
    if ('metadata' in file && window.top) {
      const id = file.metadata.externalId || ''
      window.top.postMessage('openFile:' + id, '*')
    }
  }

  const contextValue: ShellContextType = {
    runsInShell,
    setRunsInShell,
    selectedFile,
    setSelectedFile,
    openFileInParent
  }

  return (
    <ShellContext.Provider value={contextValue}>
      {runsInShell && (
        <BarLeft>
          <div style={{ width: 12 }}></div>
        </BarLeft>
      )}

      {children}
    </ShellContext.Provider>
  )
}

// Hook
export const useShell = (): ShellContextType => {
  const context = useContext(ShellContext)
  if (!context) {
    return {
      runsInShell: false,
      setRunsInShell: (): void => {
        return
      },
      selectedFile: null,
      setSelectedFile: (): void => {
        return
      },
      openFileInParent: (): void => {
        return
      }
    }
  }
  return context
}
