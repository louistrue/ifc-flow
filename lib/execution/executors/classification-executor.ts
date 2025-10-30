/**
 * Classification Executor
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { manageClassifications } from '@/lib/ifc-utils'

export class ClassificationExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'classificationNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()

    if (!input) {
      return []
    }

    return manageClassifications(
      input,
      node.data.properties?.system || 'uniclass',
      node.data.properties?.action || 'get',
      node.data.properties?.code || ''
    )
  }
}

