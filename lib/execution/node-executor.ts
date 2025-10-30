/**
 * Node Executor Interface
 * Defines the contract for executing node types in the workflow
 */

import type { Node, Edge } from 'reactflow'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface IExecutionContext {
  node: Node
  nodeId: string
  inputValues: Record<string, any>
  upstreamResults: Map<string, any>
  onNodeUpdate?: (nodeId: string, data: any) => void
  updateNodeDataInList?: (nodeId: string, data: any) => void
  hasDownstreamGLBExport?: (nodeId: string) => boolean
  hasDownstreamViewer?: (nodeId: string) => boolean
  getInput: (handleName?: string) => any
  getUpstreamResult: (nodeId: string) => any
  updateData: (data: Partial<any>) => void
}

export interface NodeExecutor {
  /**
   * Check if this executor can handle the given node type
   */
  canExecute(node: Node): boolean

  /**
   * Execute the node and return the result
   */
  execute(context: IExecutionContext): Promise<any>

  /**
   * Validate node configuration (optional)
   */
  validate?(node: Node): ValidationResult
}

// Re-export for backward compatibility
export type ExecutionContext = IExecutionContext

