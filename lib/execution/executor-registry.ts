/**
 * Executor Registry
 * Manages registration and lookup of node executors
 */

import type { Node } from 'reactflow'
import type { NodeExecutor } from './node-executor'

class ExecutorRegistry {
  private executors = new Map<string, NodeExecutor>()

  /**
   * Register an executor for a node type
   */
  register(nodeType: string, executor: NodeExecutor): void {
    this.executors.set(nodeType, executor)
  }

  /**
   * Get executor for a node type
   */
  get(nodeType: string): NodeExecutor | undefined {
    return this.executors.get(nodeType)
  }

  /**
   * Get executor for a node (checks canExecute)
   */
  getForNode(node: Node): NodeExecutor | undefined {
    for (const executor of this.executors.values()) {
      if (executor.canExecute(node)) {
        return executor
      }
    }
    if (node.type) {
      return this.executors.get(node.type)
    }
    return undefined
  }

  /**
   * Check if executor exists for node type
   */
  has(nodeType: string): boolean {
    return this.executors.has(nodeType)
  }

  /**
   * Get all registered node types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.executors.keys())
  }
}

// Singleton instance
export const executorRegistry = new ExecutorRegistry()

