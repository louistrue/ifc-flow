/**
 * Parameter Executor
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'

export class ParameterExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'parameterNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context

    // Parameter nodes output static values
    const value = node.data.properties?.value || node.data.properties?.parameterValue || null

    return value
  }
}

