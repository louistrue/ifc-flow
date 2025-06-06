"use client"

import { useState, useCallback } from "react"
import type { Node, Edge } from "reactflow"

export function useNodeSelection(nodeStyle: any) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  const selectAllNodes = useCallback(
    (nodes: Node[], setNodes: React.Dispatch<React.SetStateAction<Node[]>>, toast: any) => {
      setNodes((nds: Node[]) => {
        const updatedNodes = nds.map((node: Node) => ({
          ...node,
          selected: true,
          style: { ...node.style, ...nodeStyle.selected },
        }))
        return updatedNodes
      })

      // Clear selected node since multiple are selected
      setSelectedNode(null)

      toast({
        title: "Select All",
        description: `Selected ${nodes.length} nodes`,
      })
    },
    [nodeStyle],
  )

  const deleteSelectedNodes = useCallback(
    (
      nodes: Node[],
      edges: Edge[],
      setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
      setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
      addToHistory: (nodes: Node[], edges: Edge[]) => void,
      toast: any,
    ) => {
      // Delete selected nodes
      const selectedNodes = nodes.filter((node) => node.selected)
      if (selectedNodes.length > 0) {
        const nodeIds = selectedNodes.map((node) => node.id)

        // Remove the nodes
        setNodes((nodes: Node[]) => nodes.filter((node) => !nodeIds.includes(node.id)))

        // Remove any connected edges
        setEdges((edges: Edge[]) => edges.filter((edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)))

        // Clear selected node if it was deleted
        if (selectedNode && nodeIds.includes(selectedNode.id)) {
          setSelectedNode(null)
        }

        // Add to history
        const newNodes = nodes.filter((node) => !nodeIds.includes(node.id))
        const newEdges = edges.filter((edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target))
        addToHistory(newNodes, newEdges)

        toast({
          title: "Nodes deleted",
          description: `Deleted ${selectedNodes.length} node${selectedNodes.length > 1 ? "s" : ""}`,
        })
      }
    },
    [selectedNode],
  )

  return {
    selectedNode,
    setSelectedNode,
    selectAllNodes,
    deleteSelectedNodes,
  }
}

