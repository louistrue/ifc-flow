"use client"

import { useState, useEffect, useCallback } from "react"
import type { Node, Edge } from "reactflow"

export function useWorkflowHistory() {
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Update canUndo and canRedo
  useEffect(() => {
    setCanUndo(historyIndex > 0)
    setCanRedo(historyIndex < history.length - 1)
  }, [historyIndex, history])

  const addToHistory = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      setHistory((prev) => [...prev.slice(0, historyIndex + 1), { nodes, edges }])
      setHistoryIndex((prev) => prev + 1)
    },
    [historyIndex],
  )

  const undo = useCallback(
    (
      setNodes: (nodes: Node[]) => void,
      setEdges: (edges: Edge[]) => void,
      setSelectedNode: (node: Node | null) => void,
      nodeStyle: any,
    ) => {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        const { nodes: prevNodes, edges: prevEdges } = history[newIndex]

        // Apply selection styling to nodes
        const styledNodes = prevNodes.map((node) => {
          if (node.selected) {
            return {
              ...node,
              style: { ...node.style, ...nodeStyle.selected },
            }
          }
          return node
        })

        setNodes(styledNodes)
        setEdges(prevEdges)
        setHistoryIndex(newIndex)

        // Update selected node
        const selectedNodes = styledNodes.filter((node) => node.selected)
        if (selectedNodes.length === 1) {
          setSelectedNode(selectedNodes[0])
        } else {
          setSelectedNode(null)
        }
      }
    },
    [history, historyIndex],
  )

  const redo = useCallback(
    (
      setNodes: (nodes: Node[]) => void,
      setEdges: (edges: Edge[]) => void,
      setSelectedNode: (node: Node | null) => void,
      nodeStyle: any,
    ) => {
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        const { nodes: nextNodes, edges: nextEdges } = history[newIndex]

        // Apply selection styling to nodes
        const styledNodes = nextNodes.map((node) => {
          if (node.selected) {
            return {
              ...node,
              style: { ...node.style, ...nodeStyle.selected },
            }
          }
          return node
        })

        setNodes(styledNodes)
        setEdges(nextEdges)
        setHistoryIndex(newIndex)

        // Update selected node
        const selectedNodes = styledNodes.filter((node) => node.selected)
        if (selectedNodes.length === 1) {
          setSelectedNode(selectedNodes[0])
        } else {
          setSelectedNode(null)
        }
      }
    },
    [history, historyIndex],
  )

  return {
    history,
    historyIndex,
    canUndo,
    canRedo,
    addToHistory,
    undo,
    redo,
    setHistory,
    setHistoryIndex,
  }
}

