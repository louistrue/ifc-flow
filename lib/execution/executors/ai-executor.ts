/**
 * AI Executor
 * AI nodes handle chat interactions - execution is mostly handled by the component
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'

export class AiExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'aiNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()

    // AI nodes handle execution through their chat interface
    // This executor just ensures data is available
    
    context.updateData?.({
      inputData: input,
    })

    return input
  }
}

