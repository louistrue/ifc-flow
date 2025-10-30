/**
 * Refactored Workflow Executor using Executor Registry
 * This replaces the large switch statement with a clean executor-based approach
 */

import { executorRegistry } from './execution/executor-registry'
import { ExecutionContext } from './execution/execution-context'
import type { Node, Edge } from 'reactflow'

// Import executors to register them
import './execution/executors/index'

export class WorkflowExecutor {
  private nodes: Node[] = []
  private edges: Edge[] = []
  private nodeResults: Map<string, any> = new Map()
  private isRunning = false
  private abortController: AbortController | null = null
  private onNodeUpdate?: (nodeId: string, data: any) => void

  constructor(nodes: Node[], edges: Edge[], onNodeUpdate?: (nodeId: string, data: any) => void) {
    this.nodes = nodes
    this.edges = edges
    this.onNodeUpdate = onNodeUpdate
  }

  public getUpdatedNodes(): Node[] {
    return this.nodes
  }

  public async execute(): Promise<Map<string, any>> {
    if (this.isRunning) {
      throw new Error('Workflow is already running')
    }

    this.isRunning = true
    this.nodeResults.clear()
    this.abortController = new AbortController()

    try {
      console.log('Starting workflow execution...')

      // Find all nodes that need to be processed (topological sort)
      const sortedNodes = this.topologicalSort()

      // Process each node in order
      for (const nodeId of sortedNodes) {
        if (this.abortController?.signal.aborted) {
          throw new Error('Workflow execution aborted')
        }
        
        console.log(`Processing node ${nodeId}`)
        await this.processNode(nodeId)
      }

      console.log('Workflow execution completed')
      return this.nodeResults
    } catch (error) {
      console.error('Error executing workflow:', error)
      throw error
    } finally {
      this.isRunning = false
      this.abortController = null
    }
  }

  public stop(): void {
    if (this.isRunning && this.abortController) {
      this.abortController.abort()
      this.isRunning = false
    }
  }

  private findInputNodes(): string[] {
    const nodesWithIncomingEdges = new Set(
      this.edges.map((edge) => edge.target)
    )

    return this.nodes
      .filter((node) => !nodesWithIncomingEdges.has(node.id))
      .map((node) => node.id)
  }

  private async processNode(nodeId: string): Promise<any> {
    // If we already processed this node, return the cached result
    if (this.nodeResults.has(nodeId)) {
      return this.nodeResults.get(nodeId)
    }

    // Find the node
    const node = this.nodes.find((n) => n.id === nodeId)
    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    // Get input values by processing upstream nodes
    const inputValues = await this.getInputValues(nodeId)

    // Get executor for this node type
    const executor = executorRegistry.getForNode(node)
    
    if (!executor) {
      throw new Error(`No executor found for node type: ${node.type}`)
    }

    // Create execution context
    const context = new ExecutionContext(
      node,
      nodeId,
      inputValues,
      this.nodeResults,
      this.onNodeUpdate,
      (nodeId: string, data: any) => this.updateNodeDataInList(nodeId, data),
      (nodeId: string) => this.hasDownstreamGLBExport(nodeId),
      (nodeId: string) => this.hasDownstreamViewer(nodeId),
    )

    // Execute the node
    let result
    try {
      result = await executor.execute(context)
    } catch (error) {
      console.error(`Error executing node ${nodeId}:`, error)
      throw error
    }

    // Cache and return result
    this.nodeResults.set(nodeId, result)
    
    // Call update callback if provided
    if (this.onNodeUpdate) {
      this.onNodeUpdate(nodeId, result)
    }

    return result
  }

  private async getInputValues(nodeId: string): Promise<Record<string, any>> {
    const inputEdges = this.edges.filter((edge) => edge.target === nodeId)
    const inputValues: Record<string, any> = {}

    for (const edge of inputEdges) {
      const sourceNodeId = edge.source
      const handleName = edge.targetHandle || 'input'

      // Process upstream node if not already processed
      if (!this.nodeResults.has(sourceNodeId)) {
        await this.processNode(sourceNodeId)
      }

      const upstreamResult = this.nodeResults.get(sourceNodeId)
      inputValues[handleName] = upstreamResult
    }

    // Default to 'input' handle if no specific handle is specified
    if (inputEdges.length > 0 && !inputValues.input && inputValues[Object.keys(inputValues)[0]]) {
      inputValues.input = inputValues[Object.keys(inputValues)[0]]
    }

    return inputValues
  }

  private topologicalSort(): string[] {
    const sorted: string[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected involving node ${nodeId}`)
      }
      if (visited.has(nodeId)) {
        return
      }

      visiting.add(nodeId)

      // Visit all dependencies first
      const dependencies = this.edges
        .filter((edge) => edge.target === nodeId)
        .map((edge) => edge.source)

      for (const depId of dependencies) {
        visit(depId)
      }

      visiting.delete(nodeId)
      visited.add(nodeId)
      sorted.push(nodeId)
    }

    // Visit all nodes
    for (const node of this.nodes) {
      if (!visited.has(node.id)) {
        visit(node.id)
      }
    }

    return sorted
  }

  // Helper methods for downstream detection (used by executors)
  public hasDownstreamGLBExport(nodeId: string): boolean {
    return this.findDownstreamNodes(nodeId, (node) => {
      return node.type === 'exportNode' && node.data.properties?.format === 'glb'
    })
  }

  public hasDownstreamViewer(nodeId: string): boolean {
    return this.findDownstreamNodes(nodeId, (node) => node.type === 'viewerNode')
  }

  private findDownstreamNodes(nodeId: string, predicate: (node: Node) => boolean): boolean {
    const visited = new Set<string>()

    const visit = (currentId: string): boolean => {
      if (visited.has(currentId)) {
        return false
      }
      visited.add(currentId)

      const downstreamEdges = this.edges.filter((edge) => edge.source === currentId)
      for (const edge of downstreamEdges) {
        const targetNode = this.nodes.find((n) => n.id === edge.target)
        if (targetNode && predicate(targetNode)) {
          return true
        }
        if (visit(edge.target)) {
          return true
        }
      }
      return false
    }

    return visit(nodeId)
  }

  // Helper method for updating node data
  public updateNodeDataInList(nodeId: string, data: any): void {
    const nodeIndex = this.nodes.findIndex((n) => n.id === nodeId)
    if (nodeIndex !== -1) {
      this.nodes[nodeIndex] = {
        ...this.nodes[nodeIndex],
        data: {
          ...this.nodes[nodeIndex].data,
          ...data,
        },
      }
    }
  }

  // Keep legacy methods for backward compatibility
  private async executeGeometryNodeWithViewer(node: Node, inputValues: Record<string, any>): Promise<any> {
    // This method is kept for compatibility with geometry executor
    // Implementation would delegate to viewer
    const { extractGeometryWithGeom } = await import('@/lib/ifc-utils')
    return extractGeometryWithGeom(
      inputValues.input,
      node.data.properties?.elementType || 'all',
      node.data.properties?.includeOpenings !== 'false'
    )
  }

  private async executeGeometryNode(node: Node): Promise<any> {
    // This method is kept for compatibility
    const { extractGeometryWithGeom } = await import('@/lib/ifc-utils')
    const model = this.nodeResults.get(this.edges.find(e => e.target === node.id)?.source || '')
    return extractGeometryWithGeom(
      model,
      node.data.properties?.elementType || 'all',
      node.data.properties?.includeOpenings !== 'false'
    )
  }
}

