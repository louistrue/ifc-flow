/**
 * Hook for managing node resize functionality
 */

import { useState, useCallback } from 'react'
import { useReactFlow } from 'reactflow'

export function useNodeResize(nodeId: string) {
  const { setNodes } = useReactFlow()
  const [isResizing, setIsResizing] = useState(false)

  const updateNodeSize = useCallback(
    (width: number, height: number) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                width,
                height,
              },
            }
          }
          return node
        })
      )
    },
    [nodeId, setNodes]
  )

  const startResize = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResize = useCallback(() => {
    setIsResizing(false)
  }, [])

  return {
    isResizing,
    updateNodeSize,
    startResize,
    stopResize,
  }
}

