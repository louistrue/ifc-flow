"use client"

import { useState } from "react"
import type { Node } from "reactflow"

export function useNodeDragging() {
  const [nodeMovementStart, setNodeMovementStart] = useState<{ [key: string]: { x: number; y: number } }>({})
  const [isNodeDragging, setIsNodeDragging] = useState(false)

  const trackNodeDragStart = (nodes: Node[]) => {
    // Store the starting positions of all selected nodes
    const startPositions: { [key: string]: { x: number; y: number } } = {}
    nodes.forEach((node) => {
      if (node.selected) {
        startPositions[node.id] = { ...node.position }
      }
    })

    if (Object.keys(startPositions).length > 0 && Object.keys(nodeMovementStart).length === 0) {
      setNodeMovementStart(startPositions)
    }
  }

  const resetNodeDragTracking = () => {
    setNodeMovementStart({})
  }

  return {
    nodeMovementStart,
    isNodeDragging,
    setIsNodeDragging,
    trackNodeDragStart,
    resetNodeDragTracking,
  }
}

