"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import type { CloudFile } from "@/lib/cloud-providers/types"

interface ModelSourceContextValue {
  openModelSourceDialog: (nodeId: string) => void
  closeModelSourceDialog: () => void
  isDialogOpen: boolean
  targetNodeId: string | null
}

const ModelSourceContext = createContext<ModelSourceContextValue | null>(null)

export function useModelSource() {
  const context = useContext(ModelSourceContext)
  if (!context) {
    throw new Error("useModelSource must be used within a ModelSourceProvider")
  }
  return context
}

interface ModelSourceProviderProps {
  children: ReactNode
  onFileSelected: (nodeId: string, file: File) => void
  onCloudFileSelected: (nodeId: string, cloudFile: CloudFile, data: ArrayBuffer) => void
}

export function ModelSourceProvider({
  children,
  onFileSelected,
  onCloudFileSelected,
}: ModelSourceProviderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [targetNodeId, setTargetNodeId] = useState<string | null>(null)

  const openModelSourceDialog = useCallback((nodeId: string) => {
    setTargetNodeId(nodeId)
    setIsDialogOpen(true)
  }, [])

  const closeModelSourceDialog = useCallback(() => {
    setIsDialogOpen(false)
    setTargetNodeId(null)
  }, [])

  const handleFileSelected = useCallback((file: File) => {
    if (targetNodeId) {
      onFileSelected(targetNodeId, file)
    }
    closeModelSourceDialog()
  }, [targetNodeId, onFileSelected, closeModelSourceDialog])

  const handleCloudFileSelected = useCallback((cloudFile: CloudFile, data: ArrayBuffer) => {
    if (targetNodeId) {
      onCloudFileSelected(targetNodeId, cloudFile, data)
    }
    closeModelSourceDialog()
  }, [targetNodeId, onCloudFileSelected, closeModelSourceDialog])

  return (
    <ModelSourceContext.Provider
      value={{
        openModelSourceDialog,
        closeModelSourceDialog,
        isDialogOpen,
        targetNodeId,
      }}
    >
      {children}
      {/* The dialog will be rendered in page.tsx using the context values */}
    </ModelSourceContext.Provider>
  )
}

// Export types for use in other components
export type { ModelSourceContextValue }
