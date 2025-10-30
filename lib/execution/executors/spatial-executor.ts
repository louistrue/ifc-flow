/**
 * Spatial Executor
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { spatialQuery } from '@/lib/ifc-utils'

export class SpatialExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'spatialNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()
    const reference = context.getInput('reference') || []

    if (!input) {
      return []
    }

    return spatialQuery(
      input,
      reference,
      node.data.properties?.queryType || 'contained',
      Number.parseFloat(node.data.properties?.distance || '1.0')
    )
  }
}

