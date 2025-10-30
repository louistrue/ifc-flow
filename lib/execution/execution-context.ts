/**
 * Execution Context
 * Provides execution context to node executors
 */

import type { Node, Edge } from 'reactflow'
import type { IExecutionContext } from './node-executor'

export class ExecutionContext implements IExecutionContext {
  constructor(
    public node: Node,
    public nodeId: string,
    public inputValues: Record<string, any>,
    public upstreamResults: Map<string, any>,
    public onNodeUpdate?: (nodeId: string, data: any) => void,
    public updateNodeDataInList?: (nodeId: string, data: any) => void,
    public hasDownstreamGLBExport?: (nodeId: string) => boolean,
    public hasDownstreamViewer?: (nodeId: string) => boolean,
  ) {}

  /**
   * Get input value by handle name
   */
  getInput(handleName: string = 'input'): any {
    return this.inputValues[handleName]
  }

  /**
   * Get upstream node result
   */
  getUpstreamResult(nodeId: string): any {
    return this.upstreamResults.get(nodeId)
  }

  /**
   * Update node data
   */
  updateData(data: Partial<any>): void {
    if (this.updateNodeDataInList) {
      this.updateNodeDataInList(this.nodeId, {
        ...this.node.data,
        ...data,
      })
    }
  }
}

