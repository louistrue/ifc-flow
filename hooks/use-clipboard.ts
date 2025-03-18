"use client"

import { useState } from "react"
import type { Node, Edge } from "reactflow"
import { useToast } from "@/hooks/use-toast"

export function useClipboard() {
  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null)
  const { toast } = useToast()

  const copyNodes = (nodes: Node[], edges: Edge[]) => {
    const selectedNodes = nodes.filter((node) => node.selected)

    if (selectedNodes.length === 0) {
      toast({
        title: "Nothing to copy",
        description: "Select nodes to copy first",
      })
      return
    }

    // Get all edges between selected nodes
    const nodeIds = selectedNodes.map((node) => node.id)
    const relevantEdges = edges.filter((edge) => nodeIds.includes(edge.source) && nodeIds.includes(edge.target))

    // Store in clipboard
    setClipboard({
      nodes: selectedNodes,
      edges: relevantEdges,
    })

    toast({
      title: "Copied",
      description: `Copied ${selectedNodes.length} nodes to clipboard`,
    })
  }

  const cutNodes = (
    nodes: Node[],
    edges: Edge[],
    setNodes: (nodes: Node[]) => void,
    setEdges: (edges: Edge[]) => void,
    setSelectedNode: (node: Node | null) => void,
    addToHistory: (nodes: Node[], edges: Edge[]) => void,
  ) => {
    const selectedNodes = nodes.filter((node) => node.selected)

    if (selectedNodes.length === 0) {
      toast({
        title: "Nothing to cut",
        description: "Select nodes to cut first",
      })
      return
    }

    // Get all edges between selected nodes
    const nodeIds = selectedNodes.map((node) => node.id)
    const relevantEdges = edges.filter((edge) => nodeIds.includes(edge.source) && nodeIds.includes(edge.target))

    // Store in clipboard
    setClipboard({
      nodes: selectedNodes,
      edges: relevantEdges,
    })

    // Remove the nodes and edges
    setNodes(nodes.filter((node) => !node.selected))
    setEdges(edges.filter((edge) => !nodeIds.includes(edge.source) || !nodeIds.includes(edge.target)))

    // Clear selected node if it was cut
    const selectedNode = nodes.find((node) => node.selected && nodeIds.includes(node.id))
    if (selectedNode) {
      setSelectedNode(null)
    }

    // Add to history
    const newNodes = nodes.filter((node) => !nodeIds.includes(node.id))
    const newEdges = edges.filter((edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target))
    addToHistory(newNodes, newEdges)

    toast({
      title: "Cut",
      description: `Cut ${selectedNodes.length} nodes to clipboard`,
    })
  }

  const pasteNodes = (
    nodes: Node[],
    edges: Edge[],
    setNodes: (nodes: Node[]) => void,
    setEdges: (edges: Edge[]) => void,
    addToHistory: (nodes: Node[], edges: Edge[]) => void,
    nodeStyle: any,
  ) => {
    if (!clipboard || clipboard.nodes.length === 0) {
      toast({
        title: "Nothing to paste",
        description: "Copy or cut nodes first",
      })
      return
    }

    // Create new IDs for the pasted nodes
    const idMap = {}
    const newNodes = clipboard.nodes.map((node) => {
      const newId = `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      idMap[node.id] = newId

      // Offset position slightly to make it clear it's a copy
      const position = {
        x: node.position.x + 50,
        y: node.position.y + 50,
      }

      return {
        ...node,
        id: newId,
        position,
        selected: true,
        style: { ...node.style, ...nodeStyle.selected },
      }
    })

    // Update edges with new IDs
    const newEdges = clipboard.edges.map((edge) => ({
      ...edge,
      id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      source: idMap[edge.source],
      target: idMap[edge.target],
    }))

    // Deselect all current nodes
    setNodes((nds) => {
      const deselectedNodes = nds.map((n) => ({
        ...n,
        selected: false,
        style: { ...n.style },
      }))

      // Add the new nodes
      const updatedNodes = [...deselectedNodes, ...newNodes]

      // Add to history
      addToHistory(updatedNodes, [...edges, ...newEdges])

      return updatedNodes
    })

    // Add the new edges
    setEdges((eds) => [...eds, ...newEdges])

    toast({
      title: "Pasted",
      description: `Pasted ${newNodes.length} nodes from clipboard`,
    })
  }

  return {
    clipboard,
    setClipboard,
    copyNodes,
    cutNodes,
    pasteNodes,
  }
}

